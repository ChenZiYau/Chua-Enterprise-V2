"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { notionCreate, notionUpdate, notionDelete, isNotionId } from "@/lib/notionClient";
import {
  revenueCreateFields,
  revenuePatchFields,
  expenseCreateFields,
  expensePatchFields,
  tenantCreateFields,
  tenantPatchFields,
  propertyCreateFields,
  propertyPatchFields,
  unitCreateFields,
  unitPatchFields,
} from "@/lib/notionSync";
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
  MaintenanceEntry,
  MaintenanceStatus,
  MaintenancePriority,
} from "@/types/rental";
type PropertyInput = Omit<Property, "id" | "slug"> & {
  id?: string;
  slug?: string;
};

type RevenueInput = Omit<RevenueEntry, "id" | "created_at">;
type ExpenseInput = Omit<ExpenseEntry, "id" | "created_at">;
type TenantInput = Omit<Tenant, "id" | "created_at"> & { id?: string };

interface RentalContextValue {
  notionLoadError: string | null;
  // -- Properties ---------------------------------------------------
  properties: Property[];
  visibleProperties: Property[];
  getProperty: (id: string) => Property | undefined;
  createProperty: (input: PropertyInput) => Promise<Property>;
  updateProperty: (id: string, patch: Partial<Property>) => Promise<Property | undefined>;
  softDeleteProperty: (id: string) => Promise<void>;
  /** Update a property's cover URL in local state only (no Notion write). Used
   *  after an uploaded cover so the fresh signed URL shows immediately without
   *  persisting an expiring URL — the page cover is re-read fresh on reload. */
  setPropertyCoverLocal: (id: string, url: string) => void;
  /** Update a property's gallery URLs in local state only (no Notion write).
   *  Used after uploaded gallery images so they show immediately; the "Gallery"
   *  files property is re-read fresh on reload. */
  setPropertyGalleryLocal: (id: string, galleryUrls: string) => void;

  // -- Units --------------------------------------------------------
  units: Unit[];
  getUnitsForProperty: (propertyId: string) => Unit[];
  getUnit: (unitId: string) => Unit | undefined;
  updateUnit: (id: string, patch: Partial<Unit>) => Promise<void>;

  // -- Revenue entries ----------------------------------------------
  revenueEntries: RevenueEntry[];
  addRevenueEntry: (input: RevenueInput) => Promise<RevenueEntry>;
  updateRevenueEntry: (id: string, patch: Partial<RevenueEntry>) => Promise<void>;
  deleteRevenueEntry: (id: string) => Promise<void>;
  getRevenueEntry: (unitId: string, year: number, month: number) => RevenueEntry | undefined;
  getRevenueForUnit: (unitId: string, year: number) => RevenueEntry[];
  getRevenueForProperty: (propertyId: string, year: number) => RevenueEntry[];

  // -- Expense entries ----------------------------------------------
  expenseEntries: ExpenseEntry[];
  addExpenseEntry: (input: ExpenseInput) => Promise<ExpenseEntry>;
  updateExpenseEntry: (id: string, patch: Partial<ExpenseEntry>) => Promise<void>;
  deleteExpenseEntry: (id: string) => Promise<void>;
  getExpensesForProperty: (propertyId: string, year: number) => ExpenseEntry[];
  getExpensesForMonth: (propertyId: string, year: number, month: number) => ExpenseEntry[];

  // -- Tenants ------------------------------------------------------
  tenants: Tenant[];
  getTenant: (id: string) => Tenant | undefined;
  addTenant: (input: TenantInput) => Promise<Tenant>;
  updateTenant: (id: string, patch: Partial<Tenant>) => Promise<void>;
  deleteTenant: (id: string) => Promise<void>;

  // -- Maintenance ---------------------------------------------------
  maintenanceEntries: MaintenanceEntry[];
  setMaintenanceEntriesFromPage: (entries: MaintenanceEntry[]) => void;
  upsertMaintenanceEntry: (entry: MaintenanceEntry) => void;
  removeMaintenanceEntry: (id: string) => void;

  // -- Aggregates ---------------------------------------------------
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

function normalizeMaintenanceStatus(value: string): MaintenanceStatus {
  const v = value.trim().toLowerCase();
  if (v === "in progress" || v === "in_progress") return "in_progress";
  if (v === "completed") return "completed";
  return "pending";
}

function normalizeMaintenancePriority(value: string): MaintenancePriority {
  const v = value.trim().toLowerCase();
  if (v === "urgent") return "urgent";
  if (v === "high") return "high";
  if (v === "medium") return "medium";
  return "low";
}

export function RentalProvider({ children }: { children: React.ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [revenueEntries, setRevenueEntries] = useState<RevenueEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [maintenanceEntries, setMaintenanceEntries] = useState<MaintenanceEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [notionLoadError, setNotionLoadError] = useState<string | null>(null);

  // Latest properties/units in refs so the (stable) CRUD callbacks can resolve
  // property/unit names when syncing to Notion without re-creating themselves.
  const propsRef = useRef(properties);
  propsRef.current = properties;
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const revenueEntriesRef = useRef(revenueEntries);
  revenueEntriesRef.current = revenueEntries;
  const expenseEntriesRef = useRef(expenseEntries);
  expenseEntriesRef.current = expenseEntries;
  const tenantsRef = useRef(tenants);
  tenantsRef.current = tenants;
  const maintenanceEntriesRef = useRef(maintenanceEntries);
  maintenanceEntriesRef.current = maintenanceEntries;

  const propNameById = useCallback((id?: string | null) => {
    if (!id) return "";
    return propsRef.current.find((p) => p.id === id)?.name ?? "";
  }, []);
  const unitNameById = useCallback((id?: string | null) => {
    if (!id) return "";
    return unitsRef.current.find((u) => u.id === id)?.name ?? "";
  }, []);
  const propNameForUnit = useCallback((unitId?: string | null) => {
    if (!unitId) return "";
    const u = unitsRef.current.find((x) => x.id === unitId);
    return u ? propNameById(u.property_id) : "";
  }, [propNameById]);

  // -- Mark client hydration before loading Notion --------------------
  useEffect(() => {
    setHydrated(true);
  }, []);

  // -- Hydrate from Notion (source of truth) -------------------------
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const nowIso = new Date().toISOString();

    type ApiResp<T> = { data: T[]; error?: string };
    type NPProperty = {
      id: string; name: string; slug: string; shortName: string;
      address: string; city: string; state: string; postcode: string;
      rentalModel: string; propertyType: string; status: string;
      imageUrl: string; galleryUrls: string; shareUrl: string; description: string;
      totalUnits: number; rentedUnits: number;
      ytdRevenue: number; ytdExpenses: number;
    };
    type NPUnit = {
      id: string; name: string; property: string; label: string;
      sortOrder: number; isRented: boolean; tenantName: string;
      rentalRate: number; electricityFreeUnits: number; galleryUrls: string; shareUrl: string;
    };
    type NPRevenue = {
      id: string; name: string; property: string; unit: string;
      year: number; month: number;
      rentalAmount: number; electricityUnits: number;
      electricityAmount: number; otherCharges: number; totalAmount: number;
      paymentDate: string; paymentMethod: string; paymentStatus: string;
      invoiceGenerated: boolean; notes: string;
      invoiceNumber: string; invoiceSent: boolean; invoiceSentAt: string;
    };
    type NPExpense = {
      id: string; name: string; property: string; unit: string;
      year: number; month: number; expenseDate: string;
      category: string; customCategory: string;
      amount: number; description: string;
      isRecurring: boolean; isIrregular: boolean; isFixed: boolean;
    };
    type NPTenant = {
      id: string; name: string; icNumber: string; email: string; phone: string;
      previousAddress: string; unit: string; property: string;
      leaseStart: string; leaseEnd: string; notes: string;
    };
    type NPMaintenance = {
      id: string; name: string; property: string; unit: string; tenant: string;
      category: string; priority: string; status: string;
      reportedDate: string; dueDate: string; assignedTo: string; description: string;
    };

    async function loadJson<T>(url: string): Promise<T[]> {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return [];
      const j = (await r.json()) as ApiResp<T>;
      return Array.isArray(j.data) ? j.data : [];
    }

    (async () => {
      try {
        const [pData, uData, rData, eData, tData, mData] = await Promise.all([
          loadJson<NPProperty>("/api/notion/properties"),
          loadJson<NPUnit>("/api/notion/units"),
          loadJson<NPRevenue>("/api/notion/revenue"),
          loadJson<NPExpense>("/api/notion/expenses"),
          loadJson<NPTenant>("/api/notion/tenants"),
          loadJson<NPMaintenance>("/api/notion/maintenance"),
        ]);
        if (cancelled) return;
        setNotionLoadError(null);

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
          gallery_urls: p.galleryUrls || null,
          share_url: p.shareUrl || null,
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
          gallery_urls: u.galleryUrls || null,
          share_url: u.shareUrl || null,
        }));
        const unitIdByKey = new Map<string, string>();
        for (const u of uData) {
          unitIdByKey.set(`${u.property}|${u.label}`, u.id);
          // Also index by unit name so links stored as the unit's name resolve.
          if (u.name) unitIdByKey.set(`${u.property}|${u.name}`, u.id);
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
          invoice_number: r.invoiceNumber || null,
          invoice_sent: !!r.invoiceSent,
          invoice_sent_at: r.invoiceSentAt || null,
          created_at: nowIso,
        }));

        const exps: ExpenseEntry[] = eData.map((e) => ({
          id: e.id,
          property_id: propIdByName.get(e.property) || "",
          unit_id: unitIdByKey.get(`${e.property}|${e.unit}`) || null,
          year: e.year,
          month: e.month,
          expense_date: e.expenseDate || null,
          category: (e.category as ExpenseCategory) || "other",
          custom_category: e.customCategory || null,
          amount: e.amount,
          description: e.description || null,
          is_recurring: !!e.isRecurring,
          is_irregular: !!e.isIrregular,
          is_fixed: !!e.isFixed,
          created_at: nowIso,
        }));

        const maint: MaintenanceEntry[] = mData.map((m) => ({
          id: m.id,
          property: m.property,
          unit: m.unit,
          tenant: m.tenant,
          issue: m.name,
          category: m.category || "General",
          priority: normalizeMaintenancePriority(m.priority),
          status: normalizeMaintenanceStatus(m.status),
          reported_date: m.reportedDate || "",
          due_date: m.dueDate || "",
          assigned_to: m.assignedTo || null,
          description: m.description || null,
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
        setMaintenanceEntries(maint);
      } catch (err) {
        setNotionLoadError(err instanceof Error ? err.message : String(err));
        console.warn("Notion hydration failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  // -- Property CRUD --------------------------------------------------
  const createProperty = useCallback(async (input: PropertyInput): Promise<Property> => {
    const id = input.id ?? generateId("prop");
    const slug = input.slug ?? (slugify(input.name) || id);
    const draft: Property = {
      ...input,
      id,
      slug,
      deleted_at: input.deleted_at ?? null,
      delete_expires_at: input.delete_expires_at ?? null,
    };
    const realId = await notionCreate("properties", propertyCreateFields(draft));
    const next = { ...draft, id: realId };
    const unitCount = Math.max(1, next.total_units || 1);
    const createdUnits: Unit[] = [];
    for (let i = 0; i < unitCount; i += 1) {
      const label = next.rental_model === "whole_unit" ? "Unit" : `Room ${i + 1}`;
      const unitDraft: Unit = {
        id: generateId("unit"),
        property_id: realId,
        name: label,
        label,
        sort_order: i + 1,
        is_rented: false,
        tenant_name: null,
        rental_rate: null,
        electricity_free_units: 0,
      };
      const unitId = await notionCreate("units", unitCreateFields(unitDraft, { property: next.name }));
      createdUnits.push({ ...unitDraft, id: unitId });
    }
    setProperties((prev) => [next, ...prev]);
    setUnits((prev) => [...prev, ...createdUnits]);
    return next;
  }, []);

  const updateProperty = useCallback(async (id: string, patch: Partial<Property>) => {
    const current = propsRef.current.find((p) => p.id === id);
    if (!current) return undefined;
    const updated = { ...current, ...patch };
    if (isNotionId(id)) {
      await notionUpdate("properties", id, propertyPatchFields(patch));
    }
    const currentUnits = unitsRef.current
      .filter((unit) => unit.property_id === id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const targetUnits = Math.max(1, updated.total_units || 1);
    const createdUnits: Unit[] = [];
    if (targetUnits > currentUnits.length) {
      for (let i = currentUnits.length; i < targetUnits; i += 1) {
        const label = updated.rental_model === "whole_unit" ? "Unit" : `Room ${i + 1}`;
        const unitDraft: Unit = {
          id: generateId("unit"),
          property_id: id,
          name: label,
          label,
          sort_order: i + 1,
          is_rented: false,
          tenant_name: null,
          rental_rate: null,
          electricity_free_units: 0,
        };
        const unitId = await notionCreate("units", unitCreateFields(unitDraft, { property: updated.name }));
        createdUnits.push({ ...unitDraft, id: unitId });
      }
    }
    const removedUnitIds = targetUnits < currentUnits.length ? currentUnits.slice(targetUnits).map((unit) => unit.id) : [];
    for (const unitId of removedUnitIds) {
      if (isNotionId(unitId)) await notionDelete("units", unitId);
    }
    if (patch.name) {
      await Promise.all(
        currentUnits
          .filter((unit) => !removedUnitIds.includes(unit.id) && isNotionId(unit.id))
          .map((unit) => notionUpdate("units", unit.id, unitPatchFields({ property_id: id }, { property: updated.name })))
      );
    }
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? updated : p))
    );
    setUnits((prev) => [
      ...prev.filter((unit) => !removedUnitIds.includes(unit.id)),
      ...createdUnits,
    ]);
    return updated;
  }, []);

  const setPropertyCoverLocal = useCallback((id: string, url: string) => {
    setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, image_url: url } : p)));
  }, []);

  const setPropertyGalleryLocal = useCallback((id: string, galleryUrls: string) => {
    setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, gallery_urls: galleryUrls } : p)));
  }, []);

  const softDeleteProperty = useCallback(async (id: string) => {
    const unitIds = unitsRef.current.filter((unit) => unit.property_id === id).map((unit) => unit.id);
    if (isNotionId(id)) {
      await notionDelete("properties", id);
    }
    await Promise.all(unitIds.filter(isNotionId).map((unitId) => notionDelete("units", unitId)));
    setProperties((prev) => prev.filter((p) => p.id !== id));
    setUnits((prev) => prev.filter((unit) => unit.property_id !== id));
  }, []);

  // -- Unit helpers ---------------------------------------------------
  const updateUnit = useCallback(async (id: string, patch: Partial<Unit>) => {
    const current = unitsRef.current.find((u) => u.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    if (isNotionId(id)) {
      await notionUpdate(
        "units",
        id,
        unitPatchFields(patch, { property: propNameById(patch.property_id ?? current.property_id) })
      );
    }
    setUnits((prev) =>
      prev.map((u) => (u.id === id ? updated : u))
    );
  }, [propNameById]);

  // -- Revenue CRUD ---------------------------------------------------
  const addRevenueEntry = useCallback(async (input: RevenueInput): Promise<RevenueEntry> => {
    const draft: RevenueEntry = {
      ...input,
      id: generateId("rev"),
      created_at: new Date().toISOString(),
    };
    const realId = await notionCreate(
      "revenue",
      revenueCreateFields(draft, {
        property: propNameById(draft.property_id),
        unit: unitNameById(draft.unit_id),
      })
    );
    const entry = { ...draft, id: realId };
    setRevenueEntries((prev) => {
      const filtered = prev.filter(
        (e) => !(e.unit_id === input.unit_id && e.year === input.year && e.month === input.month)
      );
      return [entry, ...filtered];
    });
    return entry;
  }, [propNameById, unitNameById]);

  const updateRevenueEntry = useCallback(async (id: string, patch: Partial<RevenueEntry>) => {
    const current = revenueEntriesRef.current.find((e) => e.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    if (isNotionId(id)) {
      await notionUpdate(
        "revenue",
        id,
        revenuePatchFields(patch, {
          property: propNameById(patch.property_id ?? current.property_id),
          unit: unitNameById(patch.unit_id ?? current.unit_id),
        })
      );
    }
    setRevenueEntries((prev) =>
      prev.map((e) => (e.id === id ? updated : e))
    );
  }, [propNameById, unitNameById]);

  const deleteRevenueEntry = useCallback(async (id: string) => {
    if (isNotionId(id)) {
      await notionDelete("revenue", id);
    }
    setRevenueEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // -- Expense CRUD ---------------------------------------------------
  const addExpenseEntry = useCallback(async (input: ExpenseInput): Promise<ExpenseEntry> => {
    const draft: ExpenseEntry = {
      ...input,
      id: generateId("exp"),
      created_at: new Date().toISOString(),
    };
    const realId = await notionCreate(
      "expenses",
      expenseCreateFields(draft, { property: propNameById(draft.property_id), unit: unitNameById(draft.unit_id) })
    );
    const entry = { ...draft, id: realId };
    setExpenseEntries((prev) => [entry, ...prev]);
    return entry;
  }, [propNameById, unitNameById]);

  const updateExpenseEntry = useCallback(async (id: string, patch: Partial<ExpenseEntry>) => {
    const current = expenseEntriesRef.current.find((e) => e.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    if (isNotionId(id)) {
      await notionUpdate(
        "expenses",
        id,
        expensePatchFields(patch, {
          property: propNameById(patch.property_id ?? current.property_id),
          unit: unitNameById(patch.unit_id ?? current.unit_id),
        })
      );
    }
    setExpenseEntries((prev) =>
      prev.map((e) => (e.id === id ? updated : e))
    );
  }, [propNameById, unitNameById]);

  const deleteExpenseEntry = useCallback(async (id: string) => {
    if (isNotionId(id)) {
      await notionDelete("expenses", id);
    }
    setExpenseEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // -- Tenant CRUD ----------------------------------------------------
  const addTenant = useCallback(async (input: TenantInput): Promise<Tenant> => {
    const draft: Tenant = {
      ...input,
      id: input.id ?? generateId("ten"),
      created_at: new Date().toISOString(),
    };
    const realId = await notionCreate(
      "tenants",
      tenantCreateFields(draft, {
        unit: unitNameById(draft.unit_id),
        property: propNameForUnit(draft.unit_id),
      })
    );
    const tenant = { ...draft, id: realId };
    setTenants((prev) => [tenant, ...prev]);
    if (tenant.unit_id) {
      if (isNotionId(tenant.unit_id)) {
        await notionUpdate(
          "units",
          tenant.unit_id,
          unitPatchFields({ is_rented: true, tenant_name: tenant.name }, { property: propNameForUnit(tenant.unit_id) })
        );
      }
      setUnits((prev) =>
        prev.map((unit) =>
          unit.id === tenant.unit_id ? { ...unit, is_rented: true, tenant_name: tenant.name } : unit
        )
      );
    }
    return tenant;
  }, [unitNameById, propNameForUnit]);

  const updateTenant = useCallback(async (id: string, patch: Partial<Tenant>) => {
    const current = tenantsRef.current.find((t) => t.id === id);
    if (!current) return;
    const unitId = patch.unit_id ?? current.unit_id;
    const nextTenant = { ...current, ...patch };
    if (isNotionId(id)) {
      await notionUpdate(
        "tenants",
        id,
        tenantPatchFields(patch, { unit: unitNameById(unitId), property: propNameForUnit(unitId) })
      );
    }
    const unitUpdates: Promise<void>[] = [];
    if (current.unit_id && current.unit_id !== nextTenant.unit_id && isNotionId(current.unit_id)) {
      unitUpdates.push(notionUpdate("units", current.unit_id, unitPatchFields({ is_rented: false, tenant_name: null }, { property: propNameForUnit(current.unit_id) })));
    }
    if (nextTenant.unit_id && isNotionId(nextTenant.unit_id)) {
      unitUpdates.push(notionUpdate("units", nextTenant.unit_id, unitPatchFields({ is_rented: true, tenant_name: nextTenant.name }, { property: propNameForUnit(nextTenant.unit_id) })));
    }
    await Promise.all(unitUpdates);
    setTenants((prev) => prev.map((t) => (t.id === id ? nextTenant : t)));
    setUnits((prev) =>
      prev.map((unit) => {
        if (unit.id === current.unit_id && current.unit_id !== nextTenant.unit_id) return { ...unit, is_rented: false, tenant_name: null };
        if (unit.id === nextTenant.unit_id) return { ...unit, is_rented: true, tenant_name: nextTenant.name };
        return unit;
      })
    );
  }, [unitNameById, propNameForUnit]);

  const deleteTenant = useCallback(async (id: string) => {
    const current = tenantsRef.current.find((t) => t.id === id);
    if (isNotionId(id)) {
      await notionDelete("tenants", id);
    }
    if (current?.unit_id) {
      if (isNotionId(current.unit_id)) {
        await notionUpdate("units", current.unit_id, unitPatchFields({ is_rented: false, tenant_name: null }, { property: propNameForUnit(current.unit_id) }));
      }
      setUnits((prev) =>
        prev.map((unit) => (unit.id === current.unit_id ? { ...unit, is_rented: false, tenant_name: null } : unit))
      );
    }
    setTenants((prev) => prev.filter((t) => t.id !== id));
  }, [propNameForUnit]);

  const setMaintenanceEntriesFromPage = useCallback((entries: MaintenanceEntry[]) => {
    setMaintenanceEntries(entries);
  }, []);

  const upsertMaintenanceEntry = useCallback((entry: MaintenanceEntry) => {
    setMaintenanceEntries((prev) => {
      const found = prev.some((item) => item.id === entry.id);
      return found ? prev.map((item) => (item.id === entry.id ? entry : item)) : [entry, ...prev];
    });
  }, []);

  const removeMaintenanceEntry = useCallback((id: string) => {
    setMaintenanceEntries((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // -- Derived context value ------------------------------------------
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
      notionLoadError,
      visibleProperties,
      getProperty: (id) => properties.find((p) => p.id === id),
      createProperty,
      updateProperty,
      softDeleteProperty,
      setPropertyCoverLocal,
      setPropertyGalleryLocal,

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

      maintenanceEntries,
      setMaintenanceEntriesFromPage,
      upsertMaintenanceEntry,
      removeMaintenanceEntry,

      getPropertyYTD,
      getUnitYTD,
    };
  }, [
    properties,
    units,
    revenueEntries,
    expenseEntries,
    tenants,
    maintenanceEntries,
    notionLoadError,
    createProperty,
    updateProperty,
    softDeleteProperty,
    setPropertyCoverLocal,
    setPropertyGalleryLocal,
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
    setMaintenanceEntriesFromPage,
    upsertMaintenanceEntry,
    removeMaintenanceEntry,
  ]);

  return <RentalContext.Provider value={value}>{children}</RentalContext.Provider>;
}

export function useRental() {
  const ctx = useContext(RentalContext);
  if (!ctx) throw new Error("useRental must be used inside RentalProvider");
  return ctx;
}
