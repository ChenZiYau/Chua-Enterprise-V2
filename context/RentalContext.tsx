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
} from "@/types/rental";
import { seedProperties, seedUnits } from "@/data/rentalData";

const STORAGE_KEY_PROPS = "chua.rental.properties.v2";
const STORAGE_KEY_UNITS = "chua.rental.units.v1";
const STORAGE_KEY_REVENUE = "chua.rental.revenue.v1";
const STORAGE_KEY_EXPENSES = "chua.rental.expenses.v1";

type PropertyInput = Omit<Property, "id" | "slug"> & {
  id?: string;
  slug?: string;
};

type RevenueInput = Omit<RevenueEntry, "id" | "created_at">;
type ExpenseInput = Omit<ExpenseEntry, "id" | "created_at">;

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
  const [hydrated, setHydrated] = useState(false);

  // ── Hydrate from localStorage ──────────────────────────────────────
  useEffect(() => {
    setProperties(loadFromStorage(STORAGE_KEY_PROPS, seedProperties));
    setUnits(loadFromStorage(STORAGE_KEY_UNITS, seedUnits));
    setRevenueEntries(loadFromStorage<RevenueEntry[]>(STORAGE_KEY_REVENUE, []));
    setExpenseEntries(loadFromStorage<ExpenseEntry[]>(STORAGE_KEY_EXPENSES, []));
    setHydrated(true);
  }, []);

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

      getPropertyYTD,
      getUnitYTD,
    };
  }, [
    properties,
    units,
    revenueEntries,
    expenseEntries,
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
  ]);

  return <RentalContext.Provider value={value}>{children}</RentalContext.Provider>;
}

export function useRental() {
  const ctx = useContext(RentalContext);
  if (!ctx) throw new Error("useRental must be used inside RentalProvider");
  return ctx;
}
