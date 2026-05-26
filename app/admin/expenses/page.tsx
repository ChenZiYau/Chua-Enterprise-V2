"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconSearch } from "@/components/admin/icons";
import { useRental } from "@/context/RentalContext";

type ExpenseCategory =
  | "Repair / Fix"
  | "Water"
  | "Electricity"
  | "Internet"
  | "Indah Water"
  | "Assessment Fee"
  | "Quit Rent / Cukai Tanah"
  | "Insurance"
  | "DBKL / Local Council"
  | "General Maintenance"
  | "Cleaning"
  | "Other";

type ExpenseTypeFilter = "all" | "recurring" | "irregular";

type ExpenseMonthMetric = {
  propertyId: string;
  thisMonth: number;
  topCategory: ExpenseCategory;
  irregularCount: number;
  month: string;
  year: string;
};

type ExpenseEntry = {
  id: string;
  date: string;
  propertyId: string;
  property: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  recurring: boolean;
  irregular: boolean;
  month: string;
  year: string;
};

type ExpenseFilters = {
  search: string;
  property: string;
  category: string;
  month: string;
  year: string;
  type: ExpenseTypeFilter;
};

const MONTHS = [
  { value: "all", label: "All months" },
  { value: "january", label: "January" },
  { value: "february", label: "February" },
  { value: "march", label: "March" },
  { value: "april", label: "April" },
  { value: "may", label: "May" },
  { value: "june", label: "June" },
  { value: "july", label: "July" },
  { value: "august", label: "August" },
  { value: "september", label: "September" },
  { value: "october", label: "October" },
  { value: "november", label: "November" },
  { value: "december", label: "December" },
];

const ENTRY_MONTHS = MONTHS.filter((month) => month.value !== "all");
const YEARS = ["2026", "2025", "2024"];

const CATEGORIES: ExpenseCategory[] = [
  "Repair / Fix",
  "Water",
  "Electricity",
  "Internet",
  "Indah Water",
  "Assessment Fee",
  "Quit Rent / Cukai Tanah",
  "Insurance",
  "DBKL / Local Council",
  "General Maintenance",
  "Cleaning",
  "Other",
];

const INITIAL_FILTERS: ExpenseFilters = {
  search: "",
  property: "all",
  category: "all",
  month: "may",
  year: "2026",
  type: "all",
};

// Sample month-level expense state until a real expense ledger exists.
// Property identity and YTD totals come from RentalContext.
const SAMPLE_EXPENSE_MONTH_METRICS: ExpenseMonthMetric[] = [
  { propertyId: "prop_menjalara", thisMonth: 150, topCategory: "Internet", irregularCount: 2, month: "may", year: "2026" },
  { propertyId: "prop_kayangan", thisMonth: 90, topCategory: "General Maintenance", irregularCount: 1, month: "may", year: "2026" },
  { propertyId: "prop_paramount", thisMonth: 80, topCategory: "Water", irregularCount: 1, month: "may", year: "2026" },
  { propertyId: "prop_nova", thisMonth: 60, topCategory: "Internet", irregularCount: 0, month: "may", year: "2026" },
];

const SAMPLE_ENTRIES: ExpenseEntry[] = [
  { id: "exp_001", date: "2026-01-02", propertyId: "prop_menjalara", property: "27 Menjalara", category: "Internet", description: "Unifi Internet Jan", amount: 150, recurring: true, irregular: false, month: "january", year: "2026" },
  { id: "exp_002", date: "2026-02-18", propertyId: "prop_menjalara", property: "27 Menjalara", category: "Repair / Fix", description: "Water heater replacement Room C", amount: 280, recurring: false, irregular: true, month: "february", year: "2026" },
  { id: "exp_003", date: "2026-04-15", propertyId: "prop_menjalara", property: "27 Menjalara", category: "Assessment Fee", description: "Assessment Fee 2026 half year", amount: 480, recurring: false, irregular: true, month: "april", year: "2026" },
  { id: "exp_004", date: "2026-05-02", propertyId: "prop_nova", property: "Nova", category: "Internet", description: "Unifi Internet May", amount: 150, recurring: true, irregular: false, month: "may", year: "2026" },
  { id: "exp_005", date: "2026-05-04", propertyId: "prop_paramount", property: "Paramount", category: "Water", description: "Water bill May", amount: 80, recurring: true, irregular: false, month: "may", year: "2026" },
  { id: "exp_006", date: "2026-05-10", propertyId: "prop_kayangan", property: "Kayangan", category: "General Maintenance", description: "Common area touch-up", amount: 90, recurring: false, irregular: true, month: "may", year: "2026" },
];

function formatMYR(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value);
}

function slugifyParam(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function periodLabel(month: string, year: string) {
  const monthLabel = MONTHS.find((item) => item.value === month)?.label ?? "All months";
  return `${monthLabel} ${year}`;
}

function typeMatches(type: ExpenseTypeFilter, entry: ExpenseEntry) {
  if (type === "all") return true;
  if (type === "recurring") return entry.recurring;
  return entry.irregular;
}

export default function ExpensesPage() {
  const { visibleProperties } = useRental();
  const [filters, setFilters] = useState<ExpenseFilters>(INITIAL_FILTERS);
  const [quickProperty, setQuickProperty] = useState(visibleProperties[0]?.id ?? "prop_menjalara");
  const [quickCategory, setQuickCategory] = useState<ExpenseCategory>("Internet");
  const [quickMonth, setQuickMonth] = useState("may");
  const [quickYear, setQuickYear] = useState("2026");

  const propertyRows = useMemo(() => {
    return visibleProperties.flatMap((property) => {
      const metrics = SAMPLE_EXPENSE_MONTH_METRICS.filter(
        (item) => item.propertyId === property.id
      );

      if (metrics.length === 0) {
        return [
          {
            propertyId: property.id,
            name: property.name,
            totalYtd: property.ytd_expenses ?? 0,
            thisMonth: 0,
            topCategory: "Other" as ExpenseCategory,
            irregularCount: 0,
            month: "may",
            year: "2026",
          },
        ];
      }

      return metrics.map((metric) => ({
        ...metric,
        name: property.name,
        totalYtd: property.ytd_expenses ?? 0,
      }));
    });
  }, [visibleProperties]);

  const filteredEntries = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return SAMPLE_ENTRIES.filter((entry) => {
      if (filters.property !== "all" && entry.propertyId !== filters.property) return false;
      if (filters.category !== "all" && entry.category !== filters.category) return false;
      if (filters.month !== "all" && entry.month !== filters.month) return false;
      if (entry.year !== filters.year) return false;
      if (!typeMatches(filters.type, entry)) return false;
      if (!q) return true;
      return [entry.property, entry.category, entry.description]
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [filters]);

  const filteredPropertyRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const activePropertyIds = new Set(filteredEntries.map((entry) => entry.propertyId));

    return propertyRows.filter((row) => {
      if (filters.property !== "all" && row.propertyId !== filters.property) return false;
      if (filters.month !== "all" && row.month !== filters.month) return false;
      if (row.year !== filters.year) return false;
      if ((filters.category !== "all" || filters.type !== "all") && !activePropertyIds.has(row.propertyId)) return false;
      if (!q) return true;
      return [row.name, row.topCategory].some((value) => value.toLowerCase().includes(q)) ||
        activePropertyIds.has(row.propertyId);
    });
  }, [filteredEntries, filters, propertyRows]);

  const categoryBreakdown = useMemo(() => {
    return CATEGORIES.map((category) => ({
      category,
      amount: filteredEntries
        .filter((entry) => entry.category === category)
        .reduce((sum, entry) => sum + entry.amount, 0),
    }));
  }, [filteredEntries]);

  const totalExpenses = filteredPropertyRows.reduce((sum, row) => sum + row.totalYtd, 0);
  const thisMonth = filteredEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const recurringExpenses = filteredEntries.filter((entry) => entry.recurring).reduce((sum, entry) => sum + entry.amount, 0);
  const irregularExpenses = filteredEntries.filter((entry) => entry.irregular).reduce((sum, entry) => sum + entry.amount, 0);
  const highestExpenseProperty = filteredPropertyRows.length > 0
    ? filteredPropertyRows.reduce((highest, row) => row.totalYtd > highest.totalYtd ? row : highest)
    : null;
  const maxCategoryAmount = Math.max(1, ...categoryBreakdown.map((item) => item.amount));

  const quickHref = `/admin/expenses/new?property=${encodeURIComponent(quickProperty)}&category=${encodeURIComponent(slugifyParam(quickCategory))}&month=${encodeURIComponent(quickMonth)}&year=${encodeURIComponent(quickYear)}`;
  const hasFilters =
    filters.search ||
    filters.property !== INITIAL_FILTERS.property ||
    filters.category !== INITIAL_FILTERS.category ||
    filters.month !== INITIAL_FILTERS.month ||
    filters.year !== INITIAL_FILTERS.year ||
    filters.type !== INITIAL_FILTERS.type;

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
            Property costs
          </p>
          <h2 className="text-2xl font-semibold mt-1 tracking-tight" style={{ color: "var(--text-primary)" }}>
            Expenses
          </h2>
          <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
            Track property-level costs, recurring bills, and irregular repairs.
          </p>
        </div>
        <Link href="/admin/expenses/new" className="ui-btn ui-btn-primary">
          <span className="text-base leading-none">+</span>
          <span>Add Expense</span>
        </Link>
      </header>

      <FilterStrip filters={filters} properties={visibleProperties} onChange={setFilters} onReset={() => setFilters(INITIAL_FILTERS)} showReset={Boolean(hasFilters)} />

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <SummaryCard label="Total Expenses" value={formatMYR(totalExpenses)} hint="Filtered sample YTD costs" tone="danger" />
        <SummaryCard label="This Month" value={formatMYR(thisMonth)} hint={periodLabel(filters.month, filters.year)} />
        <SummaryCard label="Recurring Expenses" value={formatMYR(recurringExpenses)} hint="Filtered recurring bills" />
        <SummaryCard label="Irregular Expenses" value={formatMYR(irregularExpenses)} hint="Filtered one-off costs" tone="warning" />
        <SummaryCard label="Highest Expense Property" value={highestExpenseProperty?.name ?? "None"} hint={highestExpenseProperty ? formatMYR(highestExpenseProperty.totalYtd) : "No matches"} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5">
        <div className="ui-card p-5 flex flex-col gap-5">
          <SectionTitle title="Quick Expense Entry" description="Expenses are recorded against the whole property, not a room." />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
            <Field label="Property">
              <select className="ui-select" value={quickProperty} onChange={(event) => setQuickProperty(event.target.value)}>
                {visibleProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select className="ui-select" value={quickCategory} onChange={(event) => setQuickCategory(event.target.value as ExpenseCategory)}>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="Month">
              <select className="ui-select" value={quickMonth} onChange={(event) => setQuickMonth(event.target.value)}>
                {ENTRY_MONTHS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
              </select>
            </Field>
            <Field label="Year">
              <select className="ui-select" value={quickYear} onChange={(event) => setQuickYear(event.target.value)}>
                {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </Field>
          </div>
          <Link href={quickHref} className="ui-btn ui-btn-primary w-full">Continue to Add Expense</Link>
        </div>

        <div className="ui-card p-5 flex flex-col gap-5">
          <SectionTitle title="Expenses by Property" description="Costs are grouped at property level so room rentals stay clean." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left" style={{ color: "var(--text-faint)" }}>
                  <TableHead>Property</TableHead><TableHead align="right">Expenses YTD</TableHead><TableHead align="right">This Month</TableHead><TableHead>Top Category</TableHead><TableHead>Irregular</TableHead><TableHead align="right">Action</TableHead>
                </tr>
              </thead>
              <tbody>
                {filteredPropertyRows.length === 0 ? (
                  <EmptyTableRow colSpan={6} text="No property expenses match the current filters." />
                ) : filteredPropertyRows.map((row, index) => (
                  <tr key={row.propertyId} className={index !== filteredPropertyRows.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--border-soft)" }}>
                    <td className="py-3.5 pr-4"><p className="font-medium" style={{ color: "var(--text-primary)" }}>{row.name}</p></td>
                    <td className="py-3.5 pr-4 text-right font-semibold tabular-nums" style={{ color: "var(--danger)" }}>{formatMYR(row.totalYtd)}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{formatMYR(row.thisMonth)}</td>
                    <td className="py-3.5 pr-4" style={{ color: "var(--text-secondary)" }}>{row.topCategory}</td>
                    <td className="py-3.5 pr-4"><span className={"ui-chip " + (row.irregularCount > 0 ? "ui-chip-warning" : "")}>{row.irregularCount} irregular</span></td>
                    <td className="py-3.5 text-right"><Link href={`/admin/expenses/new?property=${encodeURIComponent(row.propertyId)}`} className="ui-btn">Add Expense</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
        <div className="ui-card p-5 flex flex-col gap-5">
          <SectionTitle title="Recent Expense Entries" description="Sample entries distinguish recurring bills from irregular property costs." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left" style={{ color: "var(--text-faint)" }}>
                  <TableHead>Date</TableHead><TableHead>Property</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead align="right">Amount</TableHead><TableHead>Recurring</TableHead><TableHead>Irregular</TableHead>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <EmptyTableRow colSpan={7} text="No expense entries match the current filters." />
                ) : filteredEntries.map((entry, index) => (
                  <tr key={entry.id} className={index !== filteredEntries.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--border-soft)" }}>
                    <td className="py-3.5 pr-4" style={{ color: "var(--text-secondary)" }}>{entry.date}</td>
                    <td className="py-3.5 pr-4 font-medium" style={{ color: "var(--text-primary)" }}>{entry.property}</td>
                    <td className="py-3.5 pr-4" style={{ color: "var(--text-secondary)" }}>{entry.category}</td>
                    <td className="py-3.5 pr-4" style={{ color: "var(--text-secondary)" }}>{entry.description}</td>
                    <td className="py-3.5 pr-4 text-right font-semibold tabular-nums" style={{ color: "var(--danger)" }}>{formatMYR(entry.amount)}</td>
                    <td className="py-3.5 pr-4"><span className={"ui-chip " + (entry.recurring ? "ui-chip-success" : "")}>{entry.recurring ? "Yes" : "No"}</span></td>
                    <td className="py-3.5"><span className={"ui-chip " + (entry.irregular ? "ui-chip-warning" : "")}>{entry.irregular ? "Yes" : "No"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ui-card p-5 flex flex-col gap-5">
          <SectionTitle title="Expense Categories" description="A simple breakdown of where filtered property costs are coming from." />
          <ul className="flex flex-col gap-3">
            {categoryBreakdown.map((item) => {
              const width = item.amount === 0 ? 0 : Math.max(8, Math.round((item.amount / maxCategoryAmount) * 100));
              return (
                <li key={item.category} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate" style={{ color: "var(--text-secondary)" }}>{item.category}</span>
                    <span className="font-semibold tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>{formatMYR(item.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-muted)" }}>
                    <div className="h-full rounded-full" style={{ width: `${width}%`, background: "color-mix(in srgb, var(--danger) 76%, var(--accent))" }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}

function FilterStrip({
  filters,
  properties,
  onChange,
  onReset,
  showReset,
}: {
  filters: ExpenseFilters;
  properties: { id: string; name: string }[];
  onChange: React.Dispatch<React.SetStateAction<ExpenseFilters>>;
  onReset: () => void;
  showReset: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-faint)" } as React.CSSProperties} />
        <input className="ui-input" placeholder="Search property, category, description..." value={filters.search} onChange={(event) => onChange((current) => ({ ...current, search: event.target.value }))} />
      </div>
      <select className="ui-select w-auto min-w-[150px]" value={filters.property} onChange={(event) => onChange((current) => ({ ...current, property: event.target.value }))}>
        <option value="all">All properties</option>
        {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
      </select>
      <select className="ui-select w-auto min-w-[170px]" value={filters.category} onChange={(event) => onChange((current) => ({ ...current, category: event.target.value }))}>
        <option value="all">All categories</option>
        {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
      <select className="ui-select w-auto min-w-[140px]" value={filters.month} onChange={(event) => onChange((current) => ({ ...current, month: event.target.value }))}>
        {MONTHS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
      </select>
      <select className="ui-select w-auto min-w-[110px]" value={filters.year} onChange={(event) => onChange((current) => ({ ...current, year: event.target.value }))}>
        {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
      </select>
      <select className="ui-select w-auto min-w-[150px]" value={filters.type} onChange={(event) => onChange((current) => ({ ...current, type: event.target.value as ExpenseTypeFilter }))}>
        <option value="all">All expense types</option>
        <option value="recurring">Recurring</option>
        <option value="irregular">Irregular</option>
      </select>
      {showReset ? <button type="button" className="ui-btn" onClick={onReset}>Reset</button> : null}
    </div>
  );
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "danger" | "warning" }) {
  const valueColor = tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : "var(--text-primary)";
  return (
    <div className="ui-kpi">
      <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-2xl font-bold tracking-tight tabular-nums truncate" style={{ color: valueColor }}>{value}</span>
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>{hint}</p>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{description}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

function EmptyTableRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>{text}</td>
    </tr>
  );
}

function TableHead({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={"font-medium text-[11px] uppercase tracking-wider pb-3 pr-4 " + (align === "right" ? "text-right" : "text-left")}>
      {children}
    </th>
  );
}
