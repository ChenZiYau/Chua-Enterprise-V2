"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/** Parse a "YYYY-MM-DD" input into a comparable YYYYMMDD number, or null if empty/invalid. */
function parseDayInput(s: string): number | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return y * 10000 + m * 100 + d;
}
/** Day key for an entry: its payment_date when present, else the 1st of its year/month. */
function entryDayKey(year: number, month: number, isoDate?: string | null): number {
  if (isoDate) {
    const k = parseDayInput(isoDate);
    if (k != null) return k;
  }
  return year * 10000 + month * 100 + 1;
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
  pending: { bg: "rgba(224,162,61,0.10)", text: "var(--warning)" },
  overdue: { bg: "rgba(211,84,84,0.10)", text: "var(--danger)" },
};

export default function RevenuePage() {
  const { revenueEntries, visibleProperties, getUnit, deleteRevenueEntry } =
    useRental();
  const confirm = useConfirm();

  const [fromDate, setFromDate] = useState(`${CUR_YEAR}-01-01`);
  const [toDate, setToDate] = useState(`${CUR_YEAR}-12-31`);
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
    // Day-level bounds (YYYYMMDD). Defensive swap if From is after To.
    let lo = parseDayInput(fromDate);
    let hi = parseDayInput(toDate);
    if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
    const q = search.trim().toLowerCase();

    return revenueEntries
      .filter((e) => {
        const k = entryDayKey(e.year, e.month, e.payment_date);
        if (lo != null && k < lo) return false;
        if (hi != null && k > hi) return false; // To boundary inclusive
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
    fromDate,
    toDate,
    search,
    filterProp,
    filterUnit,
    filterStatus,
    visibleProperties,
    getUnit,
  ]);

  const totalRevenue = filtered.reduce((s, e) => s + e.total_amount, 0);

  const resetKey = `${fromDate}|${toDate}|${search}|${filterProp}|${filterUnit}|${filterStatus}`;
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
      setActionError(err instanceof Error ? err.message : "Could not delete revenue from the database.");
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

      {/* Filters — two rows, matching the layout: dates + property/unit/status
          on top; search + total on the bottom. */}
      <div className="ui-card p-4 flex flex-col gap-3">
        {/* Row 1: date range (left) · property / unit / status (right) */}
        <div className="flex flex-wrap items-center gap-3">
          <DatePickerField
            granularity="day"
            className="w-[150px]"
            value={fromDate}
            onChange={setFromDate}
            placeholder="From date"
            ariaLabel="From date"
          />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
          <DatePickerField
            granularity="day"
            className="w-[150px]"
            value={toDate}
            onChange={setToDate}
            placeholder="To date"
            ariaLabel="To date"
          />

          <div className="ml-auto flex flex-wrap items-center gap-3">
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
          </div>
        </div>

        {/* Row 2: search (left) · total (right) */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            className="ui-input w-auto min-w-[200px] flex-1 max-w-[360px]"
            placeholder="Search property, unit, tenant, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ml-auto text-sm font-semibold" style={{ color: "var(--success)" }}>
            Total: {fmt(totalRevenue)}
          </div>
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
                <th className="text-center text-xs uppercase tracking-wider px-5 py-3">Tenant Name</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Property</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Unit</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Month</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Rental</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Electricity</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Other</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Total</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Method</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Invoice</th>
                <th
                  className="text-center text-xs uppercase tracking-wider px-3 py-3 sticky right-0"
                  style={{ background: "var(--surface-muted)", borderLeft: "1px solid var(--border-soft)" }}
                >
                  Action
                </th>
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
                    <td
                      className="px-5 py-3 text-center font-medium"
                      style={{ color: unit?.tenant_name ? "var(--text-primary)" : "var(--text-faint)" }}
                    >
                      {unit?.tenant_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/admin/properties/${entry.property_id}`}
                        className="font-medium hover:underline"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {prop?.name ?? entry.property_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: "var(--text-secondary)" }}>
                      {unit?.name ?? entry.unit_id}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: "var(--text-secondary)" }}>
                      {MONTHS[entry.month - 1]} {entry.year}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {fmt(entry.rental_amount)}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {entry.electricity_amount != null ? fmt(entry.electricity_amount) : "-"}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {entry.other_charges_amount != null && entry.other_charges_amount > 0
                        ? fmt(entry.other_charges_amount)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold tabular-nums" style={{ color: "var(--success)" }}>
                      {fmt(entry.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: "var(--text-muted)" }}>
                      {entry.payment_method
                        ? entry.payment_method === "other"
                          ? (entry.custom_payment_method ?? "Other")
                          : PAYMENT_METHOD_LABEL[entry.payment_method]
                        : "-"}
                    </td>
                    {/* Status — bold colored text, like the Tenant table. */}
                    <td className="px-4 py-3 text-center font-semibold" style={{ color: statusColors.text }}>
                      {PAYMENT_STATUS_LABEL[entry.payment_status ?? "pending"]}
                    </td>
                    {/* Invoice — Generated green, Pending yellow. */}
                    <td
                      className="px-4 py-3 text-center font-semibold"
                      style={{ color: entry.invoice_generated ? "var(--success)" : "var(--warning)" }}
                    >
                      {entry.invoice_generated ? "Generated" : "Pending"}
                    </td>
                    {/* Sticky action column, pinned to the right edge. */}
                    <td
                      className="px-3 py-3 sticky right-0 z-[1]"
                      style={{ background: "var(--surface)", borderLeft: "1px solid var(--border-soft)" }}
                    >
                      <div className="flex items-center justify-center">
                        <ActionMenu
                          onEdit={() =>
                            setEntry({
                              open: true,
                              propertyId: entry.property_id,
                              unitId: entry.unit_id,
                              month: entry.month - 1,
                              year: entry.year,
                            })
                          }
                          onDelete={() => handleDelete(entry.id, label)}
                        />
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
                  colSpan={7}
                  className="px-5 py-3 text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Total ({filtered.length}{" "}
                  {filtered.length === 1 ? "entry" : "entries"})
                </td>
                <td
                  className="px-4 py-3 text-center font-bold tabular-nums"
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

/** Kebab action dropdown for a revenue row — Edit / Delete. Renders the menu in
 *  a fixed-position portal so the table's overflow-x-auto can't clip it. Closes
 *  on outside click / Esc / scroll. */
function ActionMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  };

  useEffect(() => {
    if (!open) return;
    place();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScrollResize() {
      setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Revenue actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 shrink-0 rounded-lg inline-flex items-center justify-center border hover:bg-[var(--surface-muted)] transition"
        style={{ color: open ? "var(--accent)" : "var(--text-muted)", borderColor: "var(--border-soft)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[80] w-32 rounded-lg border overflow-hidden"
              style={{
                top: pos.top,
                right: pos.right,
                background: "var(--surface)",
                borderColor: "var(--border-soft)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
              }}
            >
              <MenuItem onClick={run(onEdit)}>Edit</MenuItem>
              <MenuItem danger onClick={run(onDelete)}>Delete</MenuItem>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full px-3 py-2 text-left text-xs transition hover:bg-[var(--surface-muted)]"
      style={{ color: danger ? "var(--danger)" : "var(--text-secondary)" }}
    >
      {children}
    </button>
  );
}
