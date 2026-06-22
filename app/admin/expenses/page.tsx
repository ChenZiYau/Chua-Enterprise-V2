"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { DatePickerField } from "@/components/ui/DatePicker";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { ExpenseEntryDrawer } from "@/components/property/ExpenseEntryDrawer";
import { ExpenseEditDrawer } from "@/components/property/ExpenseEditDrawer";
import {
  MONTHS,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
  type ExpenseEntry,
} from "@/types/rental";

const CUR_YEAR = new Date().getFullYear();

/** Parse a "YYYY-MM-DD" input into a comparable YYYYMMDD number, or null if empty/invalid. */
function parseDayInput(s: string): number | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return y * 10000 + m * 100 + d;
}
/** Day key for an entry: its expense_date when present, else the 1st of its year/month. */
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

export default function ExpensesPage() {
  const { expenseEntries, visibleProperties, deleteExpenseEntry, updateExpenseEntry, getUnit, getUnitsForProperty } = useRental();
  const confirm = useConfirm();

  const [fromDate, setFromDate] = useState(`${CUR_YEAR}-01-01`);
  const [toDate, setToDate] = useState(`${CUR_YEAR}-12-31`);
  const [search, setSearch] = useState("");
  const [filterProp, setFilterProp] = useState("all");
  // Room filter: "all" rooms, "__none__" = whole-property expenses, or a unit id.
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseEntry | null>(null);

  // Rooms for the selected property — only meaningful for room-based properties.
  const selectedProp = filterProp === "all" ? undefined : visibleProperties.find((p) => p.id === filterProp);
  const showRoomFilter = !!selectedProp && selectedProp.rental_model === "room_rental";
  const roomOptions = showRoomFilter
    ? getUnitsForProperty(filterProp).slice().sort((a, b) => a.sort_order - b.sort_order)
    : [];

  const filtered = useMemo(() => {
    // Day-level bounds (YYYYMMDD). Defensive swap if From is after To.
    let lo = parseDayInput(fromDate);
    let hi = parseDayInput(toDate);
    if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
    const q = search.trim().toLowerCase();
    return expenseEntries
      .filter((e) => {
        const k = entryDayKey(e.year, e.month, e.expense_date);
        if (lo != null && k < lo) return false;
        if (hi != null && k > hi) return false; // To boundary inclusive
        return true;
      })
      .filter((e) => filterProp === "all" || e.property_id === filterProp)
      .filter((e) => {
        if (filterUnit === "all") return true;
        if (filterUnit === "__none__") return !e.unit_id; // whole-property expenses
        return e.unit_id === filterUnit;
      })
      .filter((e) => filterCategory === "all" || e.category === filterCategory)
      .filter((e) => {
        if (!q) return true;
        const prop = visibleProperties.find((p) => p.id === e.property_id);
        const catLabel =
          e.category === "other" && e.custom_category
            ? e.custom_category
            : EXPENSE_CATEGORY_LABEL[e.category];
        return (
          (prop?.name ?? "").toLowerCase().includes(q) ||
          catLabel.toLowerCase().includes(q) ||
          (e.description ?? "").toLowerCase().includes(q) ||
          (e.custom_category ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return a.property_id.localeCompare(b.property_id);
      });
  }, [
    expenseEntries,
    fromDate,
    toDate,
    search,
    filterProp,
    filterUnit,
    filterCategory,
    visibleProperties,
  ]);

  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);

  const resetKey = `${fromDate}|${toDate}|${search}|${filterProp}|${filterUnit}|${filterCategory}`;
  const { page, setPage, totalPages, total, pageSize, pageItems } = usePagination(filtered, 10, resetKey);

  async function handleDelete(id: string, label: string) {
    const { confirmed } = await confirm({
      title: "Delete expense?",
      message: `Delete expense "${label}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    deleteExpenseEntry(id);
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
            Expenses Ledger
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            All property-level expenses across all properties.
          </p>
        </div>
        <button type="button" className="ui-btn ui-btn-primary" onClick={() => setAddOpen(true)}>
          + Add Expense
        </button>
      </div>

      {/* Filters — two rows, matching the Revenue layout: dates + property/room/
          category on top; search + total on the bottom. */}
      <div className="ui-card p-4 flex flex-col gap-3">
        {/* Row 1: date range (left) · property / room / category (right) */}
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

            {/* Room filter — only for room-based properties; lists every room. */}
            {showRoomFilter && (
              <Select
                className="w-auto min-w-[150px]"
                ariaLabel="Filter by room"
                value={filterUnit}
                onChange={setFilterUnit}
                options={[
                  { value: "all", label: "All Rooms" },
                  { value: "__none__", label: "Whole property" },
                  ...roomOptions.map((u) => ({ value: u.id, label: u.name })),
                ]}
              />
            )}

            <Select
              className="w-auto min-w-[180px]"
              ariaLabel="Filter by category"
              value={filterCategory}
              onChange={(v) => setFilterCategory(v as ExpenseCategory | "all")}
              options={[
                { value: "all", label: "All Categories" },
                ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABEL[c] })),
              ]}
            />
          </div>
        </div>

        {/* Row 2: search (left) · total (right) */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            className="ui-input w-auto min-w-[200px] flex-1 max-w-[360px]"
            placeholder="Search property, category, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ml-auto text-sm font-semibold" style={{ color: "var(--danger)" }}>
            Total: {fmt(totalExpenses)}
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="ui-card p-12 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No expense entries found.{" "}
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              style={{ color: "var(--accent)" }}
            >
              Add an expense
            </button>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <div className="ui-card overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead style={{ background: "var(--surface-muted)" }}>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="text-center text-xs uppercase tracking-wider px-5 py-3">Property</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Room</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Month</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Category</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Description</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Type</th>
                <th className="text-center text-xs uppercase tracking-wider px-5 py-3">Amount</th>
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
                const categoryLabel =
                  entry.category === "other" && entry.custom_category
                    ? entry.custom_category
                    : EXPENSE_CATEGORY_LABEL[entry.category];
                const label = `${categoryLabel} - ${MONTHS[entry.month - 1]} ${entry.year}`;

                return (
                  <tr
                    key={entry.id}
                    className="border-t hover:bg-[var(--surface-muted)] transition-colors"
                    style={{ borderColor: "var(--border-soft)" }}
                  >
                    <td className="px-5 py-3 text-center">
                      <Link
                        href={`/admin/properties/${entry.property_id}`}
                        className="font-medium hover:underline"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {prop?.name ?? entry.property_id}
                      </Link>
                    </td>
                    <td
                      className="px-4 py-3 text-center"
                      style={{ color: entry.unit_id ? "var(--text-secondary)" : "var(--text-faint)" }}
                    >
                      {entry.unit_id ? (getUnit(entry.unit_id)?.name ?? "-") : "Whole property"}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: "var(--text-secondary)" }}>
                      {MONTHS[entry.month - 1]} {entry.year}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: "var(--text-secondary)" }}>
                      {categoryLabel}
                    </td>
                    <td
                      className="px-4 py-3 text-center max-w-[220px] truncate"
                      style={{ color: entry.description ? "var(--text-muted)" : "var(--text-faint)" }}
                    >
                      {entry.description ?? "—"}
                    </td>
                    {/* Type — bold colored text, like the Tenant/Revenue tables. */}
                    <td
                      className="px-4 py-3 text-center font-semibold"
                      style={{
                        color: entry.is_recurring
                          ? "var(--accent)"
                          : entry.is_irregular
                          ? "var(--warning)"
                          : "var(--text-faint)",
                      }}
                    >
                      {entry.is_recurring ? "Recurring" : entry.is_irregular ? "Irregular" : "—"}
                    </td>
                    <td
                      className="px-5 py-3 text-center font-semibold tabular-nums"
                      style={{ color: "var(--danger)" }}
                    >
                      {fmt(entry.amount)}
                    </td>
                    {/* Sticky action column, pinned to the right edge. */}
                    <td
                      className="px-3 py-3 sticky right-0 z-[1]"
                      style={{ background: "var(--surface)", borderLeft: "1px solid var(--border-soft)" }}
                    >
                      <div className="flex items-center justify-center">
                        <ActionMenu
                          onEdit={() => setEditing(entry)}
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
                  colSpan={6}
                  className="px-5 py-3 text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Total ({filtered.length}{" "}
                  {filtered.length === 1 ? "entry" : "entries"})
                </td>
                <td
                  className="px-5 py-3 text-center font-bold tabular-nums"
                  style={{ color: "var(--danger)" }}
                >
                  {fmt(totalExpenses)}
                </td>
                <td />
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

      {/* Add Expense - same itemized drawer used on the property page */}
      <ExpenseEntryDrawer open={addOpen} onClose={() => setAddOpen(false)} />

      {/* Edit a single expense entry */}
      {editing && (
        <ExpenseEditDrawer
          entry={editing}
          propertyName={visibleProperties.find((p) => p.id === editing.property_id)?.name ?? "Expense"}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await updateExpenseEntry(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/** Kebab action dropdown for an expense row — Edit / Delete. Renders the menu in
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
        aria-label="Expense actions"
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
