"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { DatePickerField } from "@/components/ui/DatePicker";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { RevenueEntryDrawer } from "@/components/property/RevenueEntryDrawer";
import {
  MONTHS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  type PaymentStatus,
} from "@/types/rental";

type EntryState = {
  open: boolean;
  propertyId?: string;
  unitId?: string;
  month?: number;
  year?: number;
};

const CUR_YEAR = new Date().getFullYear();

function monthKey(y: number, m: number) {
  return y * 100 + m;
}
function parseMonthInput(s: string): { y: number; m: number } | null {
  if (!s) return null;
  const [y, m] = s.split("-").map(Number);
  if (!y || !m) return null;
  return { y, m };
}
function toMonthInput(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function fmt(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

const STATUS_COLORS: Record<PaymentStatus, { bg: string; text: string }> = {
  paid: { bg: "rgba(47,158,111,0.10)", text: "var(--success)" },
  partial: { bg: "rgba(224,162,61,0.10)", text: "var(--warning)" },
  pending: { bg: "rgba(93,95,239,0.10)", text: "var(--accent)" },
  overdue: { bg: "rgba(211,84,84,0.10)", text: "var(--danger)" },
};

export default function RevenuePage() {
  const { revenueEntries, visibleProperties, getUnit, deleteRevenueEntry } =
    useRental();
  const confirm = useConfirm();

  const [fromMonth, setFromMonth] = useState(toMonthInput(CUR_YEAR, 1));
  const [toMonth, setToMonth] = useState(toMonthInput(CUR_YEAR, 12));
  const [search, setSearch] = useState("");
  const [filterProp, setFilterProp] = useState("all");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [entry, setEntry] = useState<EntryState>({ open: false });
  const [actionError, setActionError] = useState<string | null>(null);

  // Units for selected property
  const unitOptions =
    filterProp === "all"
      ? []
      : revenueEntries
          .filter((e) => e.property_id === filterProp)
          .reduce<{ id: string; name: string }[]>((acc, e) => {
            if (!acc.find((x) => x.id === e.unit_id)) {
              const u = getUnit(e.unit_id);
              acc.push({ id: e.unit_id, name: u?.name ?? e.unit_id });
            }
            return acc;
          }, []);

  const filtered = useMemo(() => {
    const from = parseMonthInput(fromMonth);
    const to = parseMonthInput(toMonth);
    const q = search.trim().toLowerCase();

    return revenueEntries
      .filter((e) => {
        if (from && monthKey(e.year, e.month) < monthKey(from.y, from.m)) return false;
        if (to && monthKey(e.year, e.month) > monthKey(to.y, to.m)) return false;
        return true;
      })
      .filter((e) => filterProp === "all" || e.property_id === filterProp)
      .filter((e) => filterUnit === "all" || e.unit_id === filterUnit)
      .filter((e) => filterStatus === "all" || e.payment_status === filterStatus)
      .filter((e) => {
        if (!q) return true;
        const prop = visibleProperties.find((p) => p.id === e.property_id);
        const unit = getUnit(e.unit_id);
        return (
          (prop?.name ?? "").toLowerCase().includes(q) ||
          (unit?.name ?? "").toLowerCase().includes(q) ||
          (unit?.tenant_name ?? "").toLowerCase().includes(q) ||
          (e.notes ?? "").toLowerCase().includes(q) ||
          (e.custom_payment_method ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        if (a.property_id !== b.property_id)
          return a.property_id.localeCompare(b.property_id);
        return a.unit_id.localeCompare(b.unit_id);
      });
  }, [
    revenueEntries,
    fromMonth,
    toMonth,
    search,
    filterProp,
    filterUnit,
    filterStatus,
    visibleProperties,
    getUnit,
  ]);

  const totalRevenue = filtered.reduce((s, e) => s + e.total_amount, 0);

  const resetKey = `${fromMonth}|${toMonth}|${search}|${filterProp}|${filterUnit}|${filterStatus}`;
  const { page, setPage, totalPages, total, pageSize, pageItems } = usePagination(filtered, 10, resetKey);

  async function handleDelete(id: string, label: string) {
    const { confirmed } = await confirm({
      title: "Delete revenue entry?",
      message: `Delete the revenue entry for ${label}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteRevenueEntry(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete revenue from Notion.");
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Revenue Ledger
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            All rental income across all properties.
          </p>
        </div>
        <button type="button" className="ui-btn ui-btn-primary" onClick={() => setEntry({ open: true })}>
          + Enter Revenue
        </button>
      </div>

      {/* Filters */}
      <div className="ui-card p-4 flex flex-wrap gap-3 items-center">
        {/* Date range */}
        <DatePickerField
          granularity="month"
          className="w-[150px]"
          value={fromMonth}
          onChange={setFromMonth}
          placeholder="From month"
          ariaLabel="From month"
        />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
        <DatePickerField
          granularity="month"
          className="w-[150px]"
          value={toMonth}
          onChange={setToMonth}
          placeholder="To month"
          ariaLabel="To month"
        />

        {/* Search */}
        <input
          type="search"
          className="ui-input w-auto min-w-[200px] flex-1 max-w-[280px]"
          placeholder="Search property, unit, tenant, notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Property */}
        <Select
          className="w-auto min-w-[160px]"
          ariaLabel="Filter by property"
          value={filterProp}
          onChange={(v) => {
            setFilterProp(v);
            setFilterUnit("all");
          }}
          options={[
            { value: "all", label: "All Properties" },
            ...visibleProperties.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />

        {/* Unit - only shown when a property is selected */}
        {filterProp !== "all" && unitOptions.length > 0 && (
          <Select
            className="w-auto min-w-[140px]"
            ariaLabel="Filter by unit"
            value={filterUnit}
            onChange={setFilterUnit}
            options={[
              { value: "all", label: "All Units" },
              ...unitOptions.map((u) => ({ value: u.id, label: u.name })),
            ]}
          />
        )}

        {/* Status */}
        <Select
          className="w-auto min-w-[130px]"
          ariaLabel="Filter by status"
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: "all", label: "All Statuses" },
            { value: "paid", label: "Paid" },
            { value: "partial", label: "Partial" },
            { value: "pending", label: "Pending" },
            { value: "overdue", label: "Overdue" },
          ]}
        />

        <div
          className="ml-auto text-sm font-semibold"
          style={{ color: "var(--success)" }}
        >
          Total: {fmt(totalRevenue)}
        </div>
      </div>

      {actionError && (
        <div className="ui-card px-4 py-3 flex items-center justify-between gap-3" style={{ borderColor: "var(--danger)", background: "rgba(211,84,84,0.08)" }}>
          <p className="text-sm" style={{ color: "var(--danger)" }}>{actionError}</p>
          <button type="button" className="ui-btn" onClick={() => setActionError(null)}>Dismiss</button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="ui-card p-12 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No revenue entries found.{" "}
            <button
              type="button"
              onClick={() => setEntry({ open: true })}
              style={{ color: "var(--accent)" }}
            >
              Enter revenue
            </button>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <div className="ui-card overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead style={{ background: "var(--surface-muted)" }}>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="text-left text-xs uppercase tracking-wider px-5 py-3">
                  Property
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Unit
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Month
                </th>
                <th className="text-right text-xs uppercase tracking-wider px-4 py-3">
                  Rental
                </th>
                <th className="text-right text-xs uppercase tracking-wider px-4 py-3">
                  Electricity
                </th>
                <th className="text-right text-xs uppercase tracking-wider px-4 py-3">
                  Other
                </th>
                <th className="text-right text-xs uppercase tracking-wider px-4 py-3">
                  Total
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Method
                </th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">
                  Invoice
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((entry) => {
                const prop = visibleProperties.find(
                  (p) => p.id === entry.property_id
                );
                const unit = getUnit(entry.unit_id);
                const statusColors =
                  STATUS_COLORS[entry.payment_status ?? "pending"];
                const label = `${unit?.name ?? entry.unit_id} - ${MONTHS[entry.month - 1]} ${entry.year}`;
                return (
                  <tr
                    key={entry.id}
                    className="border-t hover:bg-[var(--surface-muted)] transition-colors"
                    style={{ borderColor: "var(--border-soft)" }}
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/properties/${entry.property_id}`}
                        className="font-medium hover:underline"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {prop?.name ?? entry.property_id}
                      </Link>
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {unit?.name ?? entry.unit_id}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {MONTHS[entry.month - 1]} {entry.year}
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {fmt(entry.rental_amount)}
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {entry.electricity_amount != null
                        ? fmt(entry.electricity_amount)
                        : "-"}
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {entry.other_charges_amount != null &&
                      entry.other_charges_amount > 0
                        ? fmt(entry.other_charges_amount)
                        : "-"}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-semibold tabular-nums"
                      style={{ color: "var(--success)" }}
                    >
                      {fmt(entry.total_amount)}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {entry.payment_method
                        ? entry.payment_method === "other"
                          ? (entry.custom_payment_method ?? "Other")
                          : PAYMENT_METHOD_LABEL[entry.payment_method]
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: statusColors.bg,
                          color: statusColors.text,
                        }}
                      >
                        {PAYMENT_STATUS_LABEL[entry.payment_status ?? "pending"]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.invoice_generated ? (
                        <span className="ui-chip ui-chip-success text-xs">
                          &#10003; Generated
                        </span>
                      ) : (
                        <span className="ui-chip text-xs">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEntry({ open: true, propertyId: entry.property_id, unitId: entry.unit_id, month: entry.month - 1, year: entry.year })}
                          className="w-7 h-7 rounded flex items-center justify-center transition border border-[var(--border)] hover:bg-[var(--surface-subtle)]"
                          title="Edit"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => handleDelete(entry.id, label)}
                          className="w-7 h-7 rounded flex items-center justify-center transition border border-[var(--border)] hover:bg-[var(--surface-subtle)]"
                          style={{ color: "var(--danger)" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "var(--surface-muted)" }}>
              <tr
                className="border-t"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <td
                  colSpan={6}
                  className="px-5 py-3 text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Total ({filtered.length}{" "}
                  {filtered.length === 1 ? "entry" : "entries"})
                </td>
                <td
                  className="px-4 py-3 text-right font-bold tabular-nums"
                  style={{ color: "var(--success)" }}
                >
                  {fmt(totalRevenue)}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPage={setPage}
          unit="entry"
          unitPlural="entries"
        />
      )}

      {/* Enter / edit revenue - same drawer used on the property page */}
      <RevenueEntryDrawer
        open={entry.open}
        onClose={() => setEntry({ open: false })}
        propertyId={entry.propertyId}
        unitId={entry.unitId}
        preselectedMonth={entry.month}
        preselectedYear={entry.year}
      />
    </div>
  );
}
