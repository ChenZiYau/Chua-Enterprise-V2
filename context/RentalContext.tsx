"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  Property,
  Unit,
  RevenueEntry,
  ExpenseEntry,
  Tenant,
  RentalModel,
  PropertyStatus,
  PropertyType,
  PaymentMethod,
  PaymentStatus,
  ExpenseCategory,
} from "@/types/rental";
import { seedProperties, seedUnits } from "@/data/rentalData";

const STORAGE_KEY_PROPS = "chua.rental.properties.v2";
const STORAGE_KEY_UNITS = "chua.rental.units.v1";
const STORAGE_KEY_REVENUE = "chua.rental.revenue.v1";
const STORAGE_KEY_EXPENSES = "chua.rental.expenses.v1";
const STORAGE_KEY_TENANTS = "chua.rental.tenants.v1";

type PropertyInput = Omit<Property, "id" | "slug"> & {
  id?: string;
  slug?: string;
};

type RevenueInput = Omit<RevenueEntry, "id" | "created_at">;
type ExpenseInput = Omit<ExpenseEntry, "id" | "created_at">;
type TenantInput = Omit<Tenant, "id" | "created_at"> & { id?: string };

interface RentalContextValue {
  // ── Properties ───────────────────────────────────────────────────
  properties: Property[];
  visibleProperties: Property[];
  getProperty: (id: string) => Property | undefined;
  createProperty: (input: PropertyInput) => Property;
  updateProperty: (id: string, patch: Partial<Property>) => Property | undefined;
  softDeleteProperty: (id: string) => void;

  // ── Units ────────────────────────────────────────────────────────
  units: Unit[];
  getUnitsForProperty: (propertyId: string) => Unit[];
  getUnit: (unitId: string) => Unit | undefined;
  updateUnit: (id: string, patch: Partial<Unit>) => void;

  // ── Revenue entries ──────────────────────────────────────────────
  revenueEntries: RevenueEntry[];
  addRevenueEntry: (input: RevenueInput) => RevenueEntry;
  updateRevenueEntry: (id: string, patch: Partial<RevenueEntry>) => void;
  deleteRevenueEntry: (id: string) => void;
  getRevenueEntry: (unitId: string, year: number, month: number) => RevenueEntry | undefined;
  getRevenueForUnit: (unitId: string, year: number) => RevenueEntry[];
  getRevenueForProperty: (propertyId: string, year: number) => RevenueEntry[];

  // ── Expense entries ──────────────────────────────────────────────
  expenseEntries: ExpenseEntry[];
  addExpenseEntry: (input: ExpenseInput) => ExpenseEntry;
  updateExpenseEntry: (id: string, patch: Partial<ExpenseEntry>) => void;
  deleteExpenseEntry: (id: string) => void;
  getExpensesForProperty: (propertyId: string, year: number) => ExpenseEntry[];
  getExpensesForMonth: (propertyId: string, year: number, month: number) => ExpenseEntry[];

  // ── Tenants ──────────────────────────────────────────────────────
  tenants: Tenant[];
  getTenant: (id: string) => Tenant | undefined;
  addTenant: (input: TenantInput) => Tenant;
  updateTenant: (id: string, patch: Partial<Tenant>) => void;
  deleteTenant: (id: string) => void;

  // ── Aggregates ───────────────────────────────────────────────────
  getPropertyYTD: (propertyId: string, year: number) => { revenue: number; expenses: number; net: number };
  getUnitYTD: (unitId: string, year: number) => { revenue: number };
}

const RentalContext = createContext<RentalContextValue | null>(null);

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function generateId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as T;
    }
  } catch {/* ignore */}
  return fallback;
}

function saveToStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {/* ignore */}
}

export function RentalProvider({ children }: { children: React.ReactNode }) {
  const [properties, setProperties] = useState<Property[]>(seedProperties);
  const [units, setUnits] = useState<Unit[]>(seedUnits);
  const [revenueEntries, setRevenueEntries] = useState<RevenueEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // ── Hydrate from localStorage ──────────────────────────────────────
  useEffect(() => {
    setProperties(loadFromStorage(STORAGE_KEY_PROPS, seedProperties));
    setUnits(loadFromStorage(STORAGE_KEY_UNITS, seedUnits));
    setRevenueEntries(loadFromStorage<RevenueEntry[]>(STORAGE_KEY_REVENUE, []));
    setExpenseEntries(loadFromStorage<ExpenseEntry[]>(STORAGE_KEY_EXPENSES, []));
    setTenants(loadFromStorage<Tenant[]>(STORAGE_KEY_TENANTS, []));
    setHydrated(true);
  }, []);

  // ── Hydrate from Notion (source of truth) ─────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const nowIso = new Date().toISOString();

    type ApiResp<T> = { data: T[]; error?: string };
    type NPProperty = {
      id: string; name: string; slug: string; shortName: string;
      address: string; city: string; state: string; postcode: string;
      rentalModel: string; propertyType: string; status: string;
      imageUrl: string; description: string;
      totalUnits: number; rentedUnits: number;
      ytdRevenue: number; ytdExpenses: number;
    };
    type NPUnit = {
      id: string; name: string; property: string; label: string;
      sortOrder: number; isRented: boolean; tenantName: string;
      rentalRate: number; electricityFreeUnits: number;
    };
    type NPRevenue = {
      id: string; name: string; property: string; unit: string;
      year: number; month: number;
      rentalAmount: number; electricityUnits: number;
      electricityAmount: number; otherCharges: number; totalAmount: number;
      paymentDate: string; paymentMethod: string; paymentStatus: string;
      invoiceGenerated: boolean; notes: string;
    };
    type NPExpense = {
      id: string; name: string; property: string;
      year: number; month: number; expenseDate: string;
      category: string; customCategory: string;
      amount: number; description: string;
      isRecurring: boolean; isIrregular: boolean;
    };
    type NPTenant = {
      id: string; name: string; icNumber: string; email: string; phone: string;
      previousAddress: string; unit: string; property: string;
      leaseStart: string; leaseEnd: string; notes: string;
    };

    async function loadJson<T>(url: string): Promise<T[]> {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return [];
      const j = (await r.json()) as ApiResp<T>;
      return Array.isArray(j.data) ? j.data : [];
    }

    (async () => {
      try {
        const [pData, uData, rData, eData, tData] = await Promise.all([
          loadJson<NPProperty>("/api/notion/properties"),
          loadJson<NPUnit>("/api/notion/units"),
          loadJson<NPRevenue>("/api/notion/revenue"),
          loadJson<NPExpense>("/api/notion/expenses"),
          loadJson<NPTenant>("/api/notion/tenants"),
        ]);
        if (cancelled) return;

        const props: Property[] = pData.map((p) => ({
          id: p.id,
          slug: p.slug || p.id,
          name: p.name,
          short_name: p.shortName || p.name,
          address: p.address,
          city: p.city,
          state: p.state,
          postcode: p.postcode,
          rental_model: (p.rentalModel as RentalModel) || "room_rental",
          property_type: (p.propertyType as PropertyType) || "house",
          status: (p.status as PropertyStatus) || "active",
          image_url: p.imageUrl || null,
          description: p.description || null,
          total_units: p.totalUnits || 0,
          rented_units: p.rentedUnits || 0,
          ytd_revenue: p.ytdRevenue || 0,
          ytd_expenses: p.ytdExpenses || 0,
          deleted_at: null,
          delete_expires_at: null,
        }));
        const propIdByName = new Map(props.map((p) => [p.name, p.id]));

        const us: Unit[] = uData.map((u) => ({
          id: u.id,
          property_id: propIdByName.get(u.property) || "",
          name: u.name,
          label: u.label,
          sort_order: u.sortOrder || 0,
          is_rented: !!u.isRented,
          tenant_name: u.tenantName || null,
          rental_rate: u.rentalRate || 0,
          electricity_free_units: u.electricityFreeUnits || 0,
        }));
        const unitIdByKey = new Map<string, string>();
        for (const u of uData) {
          unitIdByKey.set(`${u.property}|${u.label}`, u.id);
        }

        const revs: RevenueEntry[] = rData.map((r) => ({
          id: r.id,
          property_id: propIdByName.get(r.property) || "",
          unit_id: unitIdByKey.get(`${r.property}|${r.unit}`) || "",
          year: r.year,
          month: r.month,
          rental_amount: r.rentalAmount,
          electricity_units: r.electricityUnits,
          electricity_amount: r.electricityAmount,
          other_charges_amount: r.otherCharges,
          total_amount: r.totalAmount,
          payment_date: r.paymentDate || null,
          payment_method: (r.paymentMethod as PaymentMethod) || null,
          custom_payment_method: null,
          payment_status: (r.paymentStatus as PaymentStatus) || "pending",
          notes: r.notes || null,
          invoice_generated: !!r.invoiceGenerated,
          created_at: nowIso,
        }));

        const exps: ExpenseEntry[] = eData.map((e) => ({
          id: e.id,
          property_id: propIdByName.get(e.property) || "",
          year: e.year,
          month: e.month,
          expense_date: e.expenseDate || null,
          category: (e.category as ExpenseCategory) || "other",
          custom_category: e.customCategory || null,
          amount: e.amount,
          description: e.description || null,
          is_recurring: !!e.isRecurring,
          is_irregular: !!e.isIrregular,
          created_at: nowIso,
        }));

        const tens: Tenant[] = tData.map((t) => ({
          id: t.id,
          name: t.name,
          ic_number: t.icNumber || null,
          email: t.email || null,
          phone: t.phone || null,
          previous_address: t.previousAddress || null,
          unit_id: unitIdByKey.get(`${t.property}|${t.unit}`) || null,
          lease_start: t.leaseStart || null,
          lease_end: t.leaseEnd || null,
          notes: t.notes || null,
          created_at: nowIso,
        }));

        if (props.length) setProperties(props);
        if (us.length) setUnits(us);
        setRevenueEntries(revs);
        setExpenseEntries(exps);
        setTenants(tens);
      } catch (err) {
        console.warn("Notion hydration failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  // ── Persist after hydration ────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(STORAGE_KEY_PROPS, properties);
  }, [properties, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(STORAGE_KEY_UNITS, units);
  }, [units, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(STORAGE_KEY_REVENUE, revenueEntries);
  }, [revenueEntries, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(STORAGE_KEY_EXPENSES, expenseEntries);
  }, [expenseEntries, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(STORAGE_KEY_TENANTS, tenants);
  }, [tenants, hydrated]);

  // ── Property CRUD ──────────────────────────────────────────────────
  const createProperty = useCallback((input: PropertyInput): Property => {
    const id = input.id ?? generateId("prop");
    const slug = input.slug ?? (slugify(input.name) || id);
    const next: Property = {
      ...input,
      id,
      slug,
      deleted_at: input.deleted_at ?? null,
      delete_expires_at: input.delete_expires_at ?? null,
    };
    setProperties((prev) => [next, ...prev]);
    return next;
  }, []);

  const updateProperty = useCallback((id: string, patch: Partial<Property>) => {
    let updated: Property | undefined;
    setProperties((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        updated = { ...p, ...patch };
        return updated;
      })
    );
    return updated;
  }, []);

  const softDeleteProperty = useCallback((id: string) => {
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setProperties((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, deleted_at: now, delete_expires_at: expires } : p
      )
    );
  }, []);

  // ── Unit helpers ───────────────────────────────────────────────────
  const updateUnit = useCallback((id: string, patch: Partial<Unit>) => {
    setUnits((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u))
    );
  }, []);

  // ── Revenue CRUD ───────────────────────────────────────────────────
  const addRevenueEntry = useCallback((input: RevenueInput): RevenueEntry => {
    const entry: RevenueEntry = {
      ...input,
      id: generateId("rev"),
      created_at: new Date().toISOString(),
    };
    setRevenueEntries((prev) => {
      // Replace if same unit/year/month already exists
      const filtered = prev.filter(
        (e) => !(e.unit_id === input.unit_id && e.year === input.year && e.month === input.month)
      );
      return [entry, ...filtered];
    });
    return entry;
  }, []);

  const updateRevenueEntry = useCallback((id: string, patch: Partial<RevenueEntry>) => {
    setRevenueEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  }, []);

  const deleteRevenueEntry = useCallback((id: string) => {
    setRevenueEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ── Expense CRUD ───────────────────────────────────────────────────
  const addExpenseEntry = useCallback((input: ExpenseInput): ExpenseEntry => {
    const entry: ExpenseEntry = {
      ...input,
      id: generateId("exp"),
      created_at: new Date().toISOString(),
    };
    setExpenseEntries((prev) => [entry, ...prev]);
    return entry;
  }, []);

  const updateExpenseEntry = useCallback((id: string, patch: Partial<ExpenseEntry>) => {
    setExpenseEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  }, []);

  const deleteExpenseEntry = useCallback((id: string) => {
    setExpenseEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ── Tenant CRUD ────────────────────────────────────────────────────
  const addTenant = useCallback((input: TenantInput): Tenant => {
    const tenant: Tenant = {
      ...input,
      id: input.id ?? generateId("ten"),
      created_at: new Date().toISOString(),
    };
    setTenants((prev) => [tenant, ...prev]);
    return tenant;
  }, []);

  const updateTenant = useCallback((id: string, patch: Partial<Tenant>) => {
    setTenants((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const deleteTenant = useCallback((id: string) => {
    setTenants((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Derived context value ──────────────────────────────────────────
  const value = useMemo<RentalContextValue>(() => {
    const visibleProperties = properties.filter((p) => !p.deleted_at);

    const getUnitsForProperty = (propertyId: string) =>
      units.filter((u) => u.property_id === propertyId).sort((a, b) => a.sort_order - b.sort_order);

    const getUnit = (unitId: string) => units.find((u) => u.id === unitId);

    const getRevenueEntry = (unitId: string, year: number, month: number) =>
      revenueEntries.find((e) => e.unit_id === unitId && e.year === year && e.month === month);

    const getRevenueForUnit = (unitId: string, year: number) =>
      revenueEntries.filter((e) => e.unit_id === unitId && e.year === year);

    const getRevenueForProperty = (propertyId: string, year: number) =>
      revenueEntries.filter((e) => e.property_id === propertyId && e.year === year);

    const getExpensesForProperty = (propertyId: string, year: number) =>
      expenseEntries.filter((e) => e.property_id === propertyId && e.year === year);

    const getExpensesForMonth = (propertyId: string, year: number, month: number) =>
      expenseEntries.filter(
        (e) => e.property_id === propertyId && e.year === year && e.month === month
      );

    const getPropertyYTD = (propertyId: string, year: number) => {
      const rev = getRevenueForProperty(propertyId, year).reduce((sum, e) => sum + e.total_amount, 0);
      const exp = getExpensesForProperty(propertyId, year).reduce((sum, e) => sum + e.amount, 0);
      return { revenue: rev, expenses: exp, net: rev - exp };
    };

    const getUnitYTD = (unitId: string, year: number) => {
      const rev = getRevenueForUnit(unitId, year).reduce((sum, e) => sum + e.total_amount, 0);
      return { revenue: rev };
    };

    return {
      properties,
      visibleProperties,
      getProperty: (id) => properties.find((p) => p.id === id),
      createProperty,
      updateProperty,
      softDeleteProperty,

      units,
      getUnitsForProperty,
      getUnit,
      updateUnit,

      revenueEntries,
      addRevenueEntry,
      updateRevenueEntry,
      deleteRevenueEntry,
      getRevenueEntry,
      getRevenueForUnit,
      getRevenueForProperty,

      expenseEntries,
      addExpenseEntry,
      updateExpenseEntry,
      deleteExpenseEntry,
      getExpensesForProperty,
      getExpensesForMonth,

      tenants,
      getTenant: (id) => tenants.find((t) => t.id === id),
      addTenant,
      updateTenant,
      deleteTenant,

      getPropertyYTD,
      getUnitYTD,
    };
  }, [
    properties,
    units,
    revenueEntries,
    expenseEntries,
    tenants,
    createProperty,
    updateProperty,
    softDeleteProperty,
    updateUnit,
    addRevenueEntry,
    updateRevenueEntry,
    deleteRevenueEntry,
    addExpenseEntry,
    updateExpenseEntry,
    deleteExpenseEntry,
    addTenant,
    updateTenant,
    deleteTenant,
  ]);

  return <RentalContext.Provider value={value}>{children}</RentalContext.Provider>;
}

export function useRental() {
  const ctx = useContext(RentalContext);
  if (!ctx) throw new Error("useRental must be used inside RentalProvider");
  return ctx;
}
