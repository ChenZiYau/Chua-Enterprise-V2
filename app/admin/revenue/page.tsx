"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconSearch } from "@/components/admin/icons";
import { useRental } from "@/context/RentalContext";
import { RENTAL_MODEL_LABEL, type RentalModel } from "@/types/rental";

type RevenueStatus = "Paid" | "Partial" | "Missing" | "No tenant";
type RevenueFilterStatus = "all" | "paid" | "partial" | "missing" | "no_tenant";

type RevenueMonthMetric = {
  propertyId: string;
  paidUnits: number;
  missingUnits: number;
  currentMonthCollected: number;
  month: string;
  year: string;
};

type RevenueEntry = {
  id: string;
  date: string;
  propertyId: string;
  property: string;
  unit: string;
  tenant: string;
  month: string;
  year: string;
  amount: number;
  status: "Paid" | "Partial";
  invoice: "Generated" | "Pending";
};

type AttentionItem = {
  id: string;
  propertyId: string;
  property: string;
  unit: string;
  tenant: string;
  expectedAmount: number;
  status: Exclude<RevenueStatus, "Paid">;
  month: string;
  year: string;
};

type RevenueFilters = {
  search: string;
  property: string;
  status: RevenueFilterStatus;
  month: string;
  year: string;
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

const INITIAL_FILTERS: RevenueFilters = {
  search: "",
  property: "all",
  status: "all",
  month: "may",
  year: "2026",
};

// Sample month-level payment state until a real revenue ledger exists.
// Property identity, rental model, unit counts, and YTD totals come from RentalContext.
const SAMPLE_REVENUE_MONTH_METRICS: RevenueMonthMetric[] = [
  { propertyId: "prop_menjalara", paidUnits: 4, missingUnits: 2, currentMonthCollected: 1680, month: "may", year: "2026" },
  { propertyId: "prop_kayangan", paidUnits: 1, missingUnits: 0, currentMonthCollected: 1800, month: "may", year: "2026" },
  { propertyId: "prop_paramount", paidUnits: 3, missingUnits: 3, currentMonthCollected: 1220, month: "may", year: "2026" },
  { propertyId: "prop_nova", paidUnits: 1, missingUnits: 0, currentMonthCollected: 980, month: "may", year: "2026" },
];

const SAMPLE_ENTRIES: RevenueEntry[] = [
  { id: "rev_001", date: "2026-05-01", propertyId: "prop_menjalara", property: "27 Menjalara", unit: "Room A", tenant: "Ahmad Faizal", month: "may", year: "2026", amount: 400, status: "Paid", invoice: "Generated" },
  { id: "rev_002", date: "2026-05-01", propertyId: "prop_kayangan", property: "Kayangan", unit: "Whole Unit", tenant: "Lee Kah Fatt", month: "may", year: "2026", amount: 1800, status: "Paid", invoice: "Generated" },
  { id: "rev_003", date: "2026-05-03", propertyId: "prop_paramount", property: "Paramount", unit: "Room B", tenant: "Kumar", month: "may", year: "2026", amount: 250, status: "Partial", invoice: "Pending" },
  { id: "rev_004", date: "2026-05-05", propertyId: "prop_nova", property: "Nova", unit: "Whole Unit", tenant: "Nur Aina", month: "may", year: "2026", amount: 980, status: "Paid", invoice: "Generated" },
];

const SAMPLE_ATTENTION: AttentionItem[] = [
  { id: "att_001", propertyId: "prop_menjalara", property: "27 Menjalara", unit: "Room E", tenant: "Vacant", expectedAmount: 380, status: "No tenant", month: "may", year: "2026" },
  { id: "att_002", propertyId: "prop_paramount", property: "Paramount", unit: "Studio", tenant: "Vacant", expectedAmount: 550, status: "No tenant", month: "may", year: "2026" },
  { id: "att_003", propertyId: "prop_paramount", property: "Paramount", unit: "Room B", tenant: "Kumar", expectedAmount: 500, status: "Partial", month: "may", year: "2026" },
];

function formatMYR(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value);
}

function deriveUnits(total: number, rentalModel: RentalModel) {
  if (rentalModel === "whole_unit") return [{ id: "whole-unit", label: "Whole Unit" }];
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: Math.max(1, total) }, (_, i) => ({
    id: `room-${letters[i]?.toLowerCase() ?? i + 1}`,
    label: `Room ${letters[i] ?? i + 1}`,
  }));
}

function statusChipClass(status: RevenueStatus | RevenueEntry["invoice"]) {
  if (status === "Paid" || status === "Generated") return "ui-chip-success";
  if (status === "Partial" || status === "Pending") return "ui-chip-warning";
  if (status === "Missing") return "ui-chip-danger";
  return "";
}

function statusMatches(status: RevenueFilterStatus, value: RevenueStatus) {
  if (status === "all") return true;
  if (status === "paid") return value === "Paid";
  if (status === "partial") return value === "Partial";
  if (status === "missing") return value === "Missing";
  return value === "No tenant";
}

function periodLabel(month: string, year: string) {
  const monthLabel = MONTHS.find((item) => item.value === month)?.label ?? "All months";
  return `${monthLabel} ${year}`;
}

export default function RevenuePage() {
  const { visibleProperties } = useRental();
  const [filters, setFilters] = useState<RevenueFilters>(INITIAL_FILTERS);
  const [quickProperty, setQuickProperty] = useState(visibleProperties[0]?.id ?? "prop_menjalara");
  const [quickUnit, setQuickUnit] = useState("");
  const [quickMonth, setQuickMonth] = useState("may");
  const [quickYear, setQuickYear] = useState("2026");

  const selectedProperty = useMemo(
    () => visibleProperties.find((property) => property.id === quickProperty),
    [quickProperty, visibleProperties]
  );

  const quickUnits = useMemo(() => {
    if (!selectedProperty) return [];
    return deriveUnits(selectedProperty.total_units, selectedProperty.rental_model);
  }, [selectedProperty]);

  const selectedUnit = quickUnit || quickUnits[0]?.id || "";
  const quickHref = `/admin/revenue/new?property=${encodeURIComponent(quickProperty)}&unit=${encodeURIComponent(selectedUnit)}&month=${encodeURIComponent(quickMonth)}&year=${encodeURIComponent(quickYear)}`;

  const propertyRows = useMemo(() => {
    return visibleProperties.flatMap((property) => {
      const metrics = SAMPLE_REVENUE_MONTH_METRICS.filter(
        (item) => item.propertyId === property.id
      );

      if (metrics.length === 0) {
        return [
          {
            propertyId: property.id,
            name: property.name,
            rentalModel: property.rental_model,
            paidUnits: property.rented_units,
            totalUnits: property.total_units,
            missingUnits: Math.max(0, property.total_units - property.rented_units),
            ytdRevenue: property.ytd_revenue ?? 0,
            currentMonthCollected: 0,
            month: "may",
            year: "2026",
          },
        ];
      }

      return metrics.map((metric) => ({
        ...metric,
        name: property.name,
        rentalModel: property.rental_model,
        totalUnits: property.total_units,
        ytdRevenue: property.ytd_revenue ?? 0,
      }));
    });
  }, [visibleProperties]);

  const filteredEntries = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return SAMPLE_ENTRIES.filter((entry) => {
      if (filters.property !== "all" && entry.propertyId !== filters.property) return false;
      if (filters.month !== "all" && entry.month !== filters.month) return false;
      if (entry.year !== filters.year) return false;
      if (!statusMatches(filters.status, entry.status)) return false;
      if (!q) return true;
      return [entry.property, entry.unit, entry.tenant, entry.status, entry.invoice]
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [filters]);

  const filteredAttention = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return SAMPLE_ATTENTION.filter((item) => {
      if (filters.property !== "all" && item.propertyId !== filters.property) return false;
      if (filters.month !== "all" && item.month !== filters.month) return false;
      if (item.year !== filters.year) return false;
      if (!statusMatches(filters.status, item.status)) return false;
      if (!q) return true;
      return [item.property, item.unit, item.tenant, item.status]
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [filters]);

  const filteredPropertyRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const activePropertyIds = new Set([
      ...filteredEntries.map((entry) => entry.propertyId),
      ...filteredAttention.map((item) => item.propertyId),
    ]);

    return propertyRows.filter((row) => {
      if (filters.property !== "all" && row.propertyId !== filters.property) return false;
      if (filters.month !== "all" && row.month !== filters.month) return false;
      if (row.year !== filters.year) return false;
      if (filters.status !== "all" && !activePropertyIds.has(row.propertyId)) return false;
      if (!q) return true;
      return [row.name, RENTAL_MODEL_LABEL[row.rentalModel]]
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [filteredAttention, filteredEntries, filters, propertyRows]);

  const totalRevenue = filteredPropertyRows.reduce((sum, row) => sum + row.ytdRevenue, 0);
  const collectedThisMonth = filteredEntries
    .filter((entry) => entry.status === "Paid")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const pendingRent = filteredAttention.reduce((sum, item) => sum + item.expectedAmount, 0);
  const paidUnits = filteredPropertyRows.reduce((sum, row) => sum + row.paidUnits, 0);
  const totalUnits = filteredPropertyRows.reduce((sum, row) => sum + row.totalUnits, 0);
  const averageRent =
    filteredEntries.length > 0
      ? Math.round(filteredEntries.reduce((sum, entry) => sum + entry.amount, 0) / filteredEntries.length)
      : 0;

  const hasFilters =
    filters.search ||
    filters.property !== INITIAL_FILTERS.property ||
    filters.status !== INITIAL_FILTERS.status ||
    filters.month !== INITIAL_FILTERS.month ||
    filters.year !== INITIAL_FILTERS.year;

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
            Income ledger
          </p>
          <h2 className="text-2xl font-semibold mt-1 tracking-tight" style={{ color: "var(--text-primary)" }}>
            Revenue
          </h2>
          <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
            Record and review property income for {periodLabel(filters.month, filters.year)}.
          </p>
        </div>
        <Link href="/admin/revenue/new" className="ui-btn ui-btn-primary">
          <span className="text-base leading-none">+</span>
          <span>New Revenue Entry</span>
        </Link>
      </header>

      <FilterStrip filters={filters} properties={visibleProperties} onChange={setFilters} onReset={() => setFilters(INITIAL_FILTERS)} showReset={Boolean(hasFilters)} />

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <SummaryCard label="Total Revenue" value={formatMYR(totalRevenue)} hint="Filtered sample YTD income" />
        <SummaryCard label="Collected This Month" value={formatMYR(collectedThisMonth)} hint={periodLabel(filters.month, filters.year)} />
        <SummaryCard label="Pending / Missing Rent" value={formatMYR(pendingRent)} hint="Filtered attention amount" tone="warning" />
        <SummaryCard label="Paid Units" value={`${paidUnits} / ${totalUnits}`} hint="Units with rent recorded" />
        <SummaryCard label="Average Rent" value={formatMYR(averageRent)} hint="Based on filtered entries" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5">
        <div className="ui-card p-5 flex flex-col gap-5">
          <SectionTitle title="Quick Revenue Entry" description="Pick the property, room or unit, and collection month before continuing." />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
            <Field label="Property">
              <select className="ui-select" value={quickProperty} onChange={(event) => { setQuickProperty(event.target.value); setQuickUnit(""); }}>
                {visibleProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
              </select>
            </Field>
            <Field label="Unit / Room">
              <select className="ui-select" value={selectedUnit} onChange={(event) => setQuickUnit(event.target.value)}>
                {quickUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
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
          <Link href={quickHref} className="ui-btn ui-btn-primary w-full">Continue to Entry</Link>
        </div>

        <div className="ui-card p-5 flex flex-col gap-5">
          <SectionTitle title="Revenue by Property" description="Room rentals are tracked by room; whole-unit properties are tracked as one unit." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left" style={{ color: "var(--text-faint)" }}>
                  <TableHead>Property</TableHead>
                  <TableHead>Rental Model</TableHead>
                  <TableHead>Units Paid</TableHead>
                  <TableHead>Units Missing</TableHead>
                  <TableHead align="right">Revenue YTD</TableHead>
                  <TableHead align="right">This Month</TableHead>
                  <TableHead align="right">Action</TableHead>
                </tr>
              </thead>
              <tbody>
                {filteredPropertyRows.length === 0 ? (
                  <EmptyTableRow colSpan={7} text="No property revenue matches the current filters." />
                ) : filteredPropertyRows.map((row, index) => (
                  <tr key={row.propertyId} className={index !== filteredPropertyRows.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--border-soft)" }}>
                    <td className="py-3.5 pr-4"><p className="font-medium" style={{ color: "var(--text-primary)" }}>{row.name}</p></td>
                    <td className="py-3.5 pr-4" style={{ color: "var(--text-secondary)" }}>{RENTAL_MODEL_LABEL[row.rentalModel]}</td>
                    <td className="py-3.5 pr-4" style={{ color: "var(--text-secondary)" }}>{row.paidUnits}/{row.totalUnits} paid</td>
                    <td className="py-3.5 pr-4"><span className={"ui-chip " + (row.missingUnits > 0 ? "ui-chip-warning" : "ui-chip-success")}>{row.missingUnits}</span></td>
                    <td className="py-3.5 pr-4 text-right font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{formatMYR(row.ytdRevenue)}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums" style={{ color: "var(--success)" }}>{formatMYR(row.currentMonthCollected)}</td>
                    <td className="py-3.5 text-right"><Link href={`/admin/revenue/new?property=${encodeURIComponent(row.propertyId)}`} className="ui-btn">Add Revenue</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
        <div className="ui-card p-5 flex flex-col gap-5">
          <SectionTitle title="Recent Revenue Entries" description="Sample entries show how saved payments will later generate invoices." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left" style={{ color: "var(--text-faint)" }}>
                  <TableHead>Date</TableHead><TableHead>Property</TableHead><TableHead>Unit / Room</TableHead><TableHead>Tenant</TableHead><TableHead>Month</TableHead><TableHead align="right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Invoice</TableHead>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <EmptyTableRow colSpan={8} text="No revenue entries match the current filters." />
                ) : filteredEntries.map((entry, index) => (
                  <tr key={entry.id} className={index !== filteredEntries.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--border-soft)" }}>
                    <td className="py-3.5 pr-4" style={{ color: "var(--text-secondary)" }}>{entry.date}</td>
                    <td className="py-3.5 pr-4 font-medium" style={{ color: "var(--text-primary)" }}>{entry.property}</td>
                    <td className="py-3.5 pr-4" style={{ color: "var(--text-secondary)" }}>{entry.unit}</td>
                    <td className="py-3.5 pr-4" style={{ color: "var(--text-secondary)" }}>{entry.tenant}</td>
                    <td className="py-3.5 pr-4" style={{ color: "var(--text-secondary)" }}>{periodLabel(entry.month, entry.year)}</td>
                    <td className="py-3.5 pr-4 text-right font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{formatMYR(entry.amount)}</td>
                    <td className="py-3.5 pr-4"><span className={"ui-chip " + statusChipClass(entry.status)}>{entry.status}</span></td>
                    <td className="py-3.5"><span className={"ui-chip " + statusChipClass(entry.invoice)}>{entry.invoice}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ui-card p-5 flex flex-col gap-5">
          <SectionTitle title="Payment Attention" description="Rooms or units needing follow-up for the selected month." />
          {filteredAttention.length === 0 ? (
            <EmptyPanel text="No payment attention items match the current filters." />
          ) : (
            <ul className="flex flex-col">
              {filteredAttention.map((item, index) => (
                <li key={item.id} className="flex items-start gap-3 py-3.5" style={{ borderTop: index === 0 ? "none" : "1px solid var(--border-soft)" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}>{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.property} - {item.unit}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{item.tenant} - expected {formatMYR(item.expectedAmount)}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={"ui-chip " + statusChipClass(item.status)}>{item.status}</span>
                      <Link href={`/admin/revenue/new?property=${encodeURIComponent(item.propertyId)}&unit=${encodeURIComponent(item.unit.toLowerCase().replace(/\s+/g, "-"))}`} className="text-xs font-medium" style={{ color: "var(--accent)" }}>Add Revenue</Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
  filters: RevenueFilters;
  properties: { id: string; name: string }[];
  onChange: React.Dispatch<React.SetStateAction<RevenueFilters>>;
  onReset: () => void;
  showReset: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-faint)" } as React.CSSProperties} />
        <input className="ui-input" placeholder="Search property, tenant, unit..." value={filters.search} onChange={(event) => onChange((current) => ({ ...current, search: event.target.value }))} />
      </div>
      <select className="ui-select w-auto min-w-[150px]" value={filters.property} onChange={(event) => onChange((current) => ({ ...current, property: event.target.value }))}>
        <option value="all">All properties</option>
        {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
      </select>
      <select className="ui-select w-auto min-w-[140px]" value={filters.status} onChange={(event) => onChange((current) => ({ ...current, status: event.target.value as RevenueFilterStatus }))}>
        <option value="all">All statuses</option>
        <option value="paid">Paid</option>
        <option value="partial">Partial</option>
        <option value="missing">Missing</option>
        <option value="no_tenant">No tenant</option>
      </select>
      <select className="ui-select w-auto min-w-[140px]" value={filters.month} onChange={(event) => onChange((current) => ({ ...current, month: event.target.value }))}>
        {MONTHS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
      </select>
      <select className="ui-select w-auto min-w-[110px]" value={filters.year} onChange={(event) => onChange((current) => ({ ...current, year: event.target.value }))}>
        {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
      </select>
      {showReset ? <button type="button" className="ui-btn" onClick={onReset}>Reset</button> : null}
    </div>
  );
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "warning" }) {
  return (
    <div className="ui-kpi">
      <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-2xl font-bold tracking-tight tabular-nums" style={{ color: tone === "warning" ? "var(--warning)" : "var(--text-primary)" }}>{value}</span>
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

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-lg px-5 py-6 text-center text-xs" style={{ color: "var(--text-muted)", border: "1px dashed var(--border-strong)", background: "var(--surface-muted)" }}>
      {text}
    </div>
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
