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
import { MONTHS, type RevenueEntry } from "@/types/rental";
import {
  buildReceiptData,
  computeReceiptNo,
  openReceiptWindow,
  receiptNo as computeStoredReceiptNo,
} from "@/lib/receipt";

const CUR_YEAR = new Date().getFullYear();

type EntryState = {
  open: boolean;
  propertyId?: string;
  unitId?: string;
  month?: number;
  year?: number;
};

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

export default function InvoicesPage() {
  const {
    revenueEntries,
    visibleProperties,
    tenants,
    getProperty,
    getUnit,
    getUnitsForProperty,
    updateRevenueEntry,
    deleteRevenueEntry,
  } = useRental();

  const [fromMonth, setFromMonth] = useState(toMonthInput(CUR_YEAR, 1));
  const [toMonth, setToMonth] = useState(toMonthInput(CUR_YEAR, 12));
  const [search, setSearch] = useState("");
  const [filterProp, setFilterProp] = useState("all");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [entry, setEntry] = useState<EntryState>({ open: false });
  const [actionError, setActionError] = useState<string | null>(null);
  const confirm = useConfirm();

  /** Stored receipt number once generated, otherwise the live computed value
   *  (room letter + months-billed-to-date — see lib/receipt). */
  const receiptNo = (e: RevenueEntry) =>
    computeStoredReceiptNo(
      e,
      getProperty(e.property_id),
      getUnitsForProperty(e.property_id),
      revenueEntries
    );

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
          receiptNo(e).toLowerCase().includes(q) ||
          (prop?.name ?? "").toLowerCase().includes(q) ||
          (unit?.name ?? "").toLowerCase().includes(q) ||
          (unit?.tenant_name ?? "").toLowerCase().includes(q)
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

  const totalBilled = filtered.reduce((s, e) => s + e.total_amount, 0);
  const totalOutstanding = filtered
    .filter((e) => e.payment_status !== "paid")
    .reduce((s, e) => s + e.total_amount, 0);

  const resetKey = `${fromMonth}|${toMonth}|${search}|${filterProp}|${filterUnit}|${filterStatus}`;
  const { page, setPage, totalPages, total, pageSize, pageItems } = usePagination(filtered, 10, resetKey);

  function receiptDataFor(entry: RevenueEntry, number: string) {
    const tenantName = tenants.find((t) => t.unit_id === entry.unit_id)?.name;
    return buildReceiptData(
      entry,
      getProperty(entry.property_id),
      getUnit(entry.unit_id),
      tenantName,
      number
    );
  }

  /** Gen — mark the receipt as generated, freeze its number, and open it to print. */
  async function generateInvoice(entry: RevenueEntry) {
    const number = computeReceiptNo(
      entry,
      getProperty(entry.property_id),
      getUnitsForProperty(entry.property_id),
      revenueEntries
    );
    setActionError(null);
    try {
      await updateRevenueEntry(entry.id, {
        invoice_generated: true,
        invoice_number: number,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save receipt number to the database.");
      return;
    }
    openReceiptWindow(receiptDataFor(entry, number), true);
  }

  /** Preview — open the same receipt without marking it generated or printing. */
  function previewInvoice(entry: RevenueEntry) {
    openReceiptWindow(receiptDataFor(entry, receiptNo(entry)), false);
  }

  async function handleDelete(entry: RevenueEntry) {
    const { confirmed } = await confirm({
      title: "Delete invoice?",
      message: `Delete invoice ${receiptNo(entry)}? This also removes its revenue entry and cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteRevenueEntry(entry.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete invoice from the database.");
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
            Invoices
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Auto-generated from rental revenue entries — ready to view, download, or send.
          </p>
        </div>
      </div>

      {actionError && (
        <div className="ui-card px-4 py-3 flex items-center justify-between gap-3" style={{ borderColor: "var(--danger)", background: "rgba(211,84,84,0.08)" }}>
          <p className="text-sm" style={{ color: "var(--danger)" }}>{actionError}</p>
          <button type="button" className="ui-btn" onClick={() => setActionError(null)}>Dismiss</button>
        </div>
      )}

      {/* Filters — two rows, matching the Revenue/Expenses layout: dates +
          property/unit/status on top; search + totals on the bottom. */}
      <div className="ui-card p-4 flex flex-col gap-3">
        {/* Row 1: date range (left) · property / unit / status (right) */}
        <div className="flex flex-wrap items-center gap-3">
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

        {/* Row 2: search (left) · totals (right) */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            className="ui-input w-auto min-w-[200px] flex-1 max-w-[360px]"
            placeholder="Search invoice #, property, unit, tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ml-auto flex items-center gap-4 text-sm font-semibold">
            <span style={{ color: "var(--danger)" }}>
              Outstanding: {fmt(totalOutstanding)}
            </span>
            <span style={{ color: "var(--text-primary)" }}>
              Billed: {fmt(totalBilled)}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="ui-card p-12 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No invoices found. Enter rental revenue first - invoices are
            auto-generated from revenue entries.
          </p>
        </div>
      ) : (
        <div className="ui-card overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead style={{ background: "var(--surface-muted)" }}>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="text-left text-xs uppercase tracking-wider px-5 py-3">
                  Invoice ID
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Tenant
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Property
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Unit
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Period
                </th>
                <th className="text-right text-xs uppercase tracking-wider px-4 py-3">
                  Amount
                </th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">
                  Invoice Generation
                </th>
                <th className="text-right text-xs uppercase tracking-wider px-4 py-3">
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
                return (
                  <tr
                    key={entry.id}
                    className="border-t hover:bg-[var(--surface-muted)] transition-colors"
                    style={{ borderColor: "var(--border-soft)" }}
                  >
                    <td
                      className="px-5 py-3 font-mono text-xs"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {receiptNo(entry)}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {unit?.tenant_name ?? "-"}
                    </td>
                    <td className="px-4 py-3">
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
                      className="px-4 py-3 text-right font-semibold tabular-nums"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {fmt(entry.total_amount)}
                    </td>
                    <td
                      className="px-4 py-3 text-center font-semibold"
                      style={{ color: entry.invoice_generated ? "var(--success)" : "var(--warning)" }}
                    >
                      {entry.invoice_generated ? "Generated" : "Pending"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => generateInvoice(entry)}
                          className="ui-btn ui-btn-primary text-xs px-3 py-1.5"
                          title="Generate receipt"
                        >
                          Gen
                        </button>
                        <InvoiceActionMenu
                          onPreview={() => previewInvoice(entry)}
                          onEdit={() =>
                            setEntry({
                              open: true,
                              propertyId: entry.property_id,
                              unitId: entry.unit_id,
                              month: entry.month - 1,
                              year: entry.year,
                            })
                          }
                          onDelete={() => handleDelete(entry)}
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
                  colSpan={5}
                  className="px-5 py-3 text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Total ({filtered.length}{" "}
                  {filtered.length === 1 ? "invoice" : "invoices"})
                </td>
                <td
                  className="px-4 py-3 text-right font-bold tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {fmt(totalBilled)}
                </td>
                <td colSpan={2} />
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
          unit="invoice"
        />
      )}

      {/* Edit invoice — reuses the same revenue drawer used on the property page */}
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

/** Kebab action dropdown for an invoice row — Preview / Edit / Delete. Renders
 *  the menu in a fixed-position portal so the table's overflow-x-auto can't clip
 *  it. Closes on outside click / Esc / scroll. */
function InvoiceActionMenu({
  onPreview,
  onEdit,
  onDelete,
}: {
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
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
        aria-label="Invoice actions"
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
              <MenuItem onClick={run(onPreview)}>Preview</MenuItem>
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
