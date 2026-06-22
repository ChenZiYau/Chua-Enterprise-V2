"use client";

import { useMemo, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { DatePickerField } from "@/components/ui/DatePicker";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { RowActionMenu } from "@/components/ui/RowActionMenu";
import { ExpenseEntryDrawer } from "@/components/property/ExpenseEntryDrawer";
import { ExpenseEditDrawer } from "@/components/property/ExpenseEditDrawer";
import {
  MONTHS,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
  type ExpenseEntry,
  type Property,
} from "@/types/rental";
import { entryDayKey, fmtMYR, parseDayInput } from "@/lib/ledger";

const CUR_YEAR = new Date().getFullYear();

/** Expenses ledger scoped to a single property — mirrors the admin Expenses page
 *  but drops the property column/filter and adds a room filter for room rentals. */
export function PropertyExpensesTab({ property }: { property: Property }) {
  const { expenseEntries, getUnit, getUnitsForProperty, deleteExpenseEntry, updateExpenseEntry } = useRental();
  const confirm = useConfirm();

  const isRoom = property.rental_model === "room_rental";
  const rooms = getUnitsForProperty(property.id)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const [fromDate, setFromDate] = useState(`${CUR_YEAR}-01-01`);
  const [toDate, setToDate] = useState(`${CUR_YEAR}-12-31`);
  const [search, setSearch] = useState("");
  // "all" rooms, "__none__" = whole-property expenses, or a unit id.
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseEntry | null>(null);

  const filtered = useMemo(() => {
    let lo = parseDayInput(fromDate);
    let hi = parseDayInput(toDate);
    if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
    const q = search.trim().toLowerCase();
    return expenseEntries
      .filter((e) => e.property_id === property.id)
      .filter((e) => {
        const k = entryDayKey(e.year, e.month, e.expense_date);
        if (lo != null && k < lo) return false;
        if (hi != null && k > hi) return false;
        return true;
      })
      .filter((e) => {
        if (filterUnit === "all") return true;
        if (filterUnit === "__none__") return !e.unit_id;
        return e.unit_id === filterUnit;
      })
      .filter((e) => filterCategory === "all" || e.category === filterCategory)
      .filter((e) => {
        if (!q) return true;
        const catLabel =
          e.category === "other" && e.custom_category
            ? e.custom_category
            : EXPENSE_CATEGORY_LABEL[e.category];
        return (
          catLabel.toLowerCase().includes(q) ||
          (e.description ?? "").toLowerCase().includes(q) ||
          (e.custom_category ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return 0;
      });
  }, [expenseEntries, property.id, fromDate, toDate, search, filterUnit, filterCategory]);

  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);

  const resetKey = `${fromDate}|${toDate}|${search}|${filterUnit}|${filterCategory}`;
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
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="ui-card p-4 flex flex-col gap-3">
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
            {isRoom && rooms.length > 0 && (
              <Select
                className="w-auto min-w-[150px]"
                ariaLabel="Filter by room"
                value={filterUnit}
                onChange={setFilterUnit}
                options={[
                  { value: "all", label: "All Rooms" },
                  { value: "__none__", label: "Whole property" },
                  ...rooms.map((u) => ({ value: u.id, label: u.name })),
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

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            className="ui-input w-auto min-w-[200px] flex-1 max-w-[360px]"
            placeholder="Search category, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setAddOpen(true)}>
            + Add Expense
          </button>
          <div className="ml-auto text-sm font-semibold" style={{ color: "var(--danger)" }}>
            Total: {fmtMYR(totalExpenses)}
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="ui-card p-12 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No expense entries found.{" "}
            <button type="button" onClick={() => setAddOpen(true)} style={{ color: "var(--accent)" }}>
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
                <th className="text-center text-xs uppercase tracking-wider px-5 py-3">Room</th>
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
                    <td
                      className="px-5 py-3 text-center"
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
                    <td className="px-5 py-3 text-center font-semibold tabular-nums" style={{ color: "var(--danger)" }}>
                      {fmtMYR(entry.amount)}
                    </td>
                    <td
                      className="px-3 py-3 sticky right-0 z-[1]"
                      style={{ background: "var(--surface)", borderLeft: "1px solid var(--border-soft)" }}
                    >
                      <div className="flex items-center justify-center">
                        <RowActionMenu
                          ariaLabel="Expense actions"
                          items={[
                            { label: "Edit", onClick: () => setEditing(entry) },
                            { label: "Delete", danger: true, onClick: () => handleDelete(entry.id, label) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "var(--surface-muted)" }}>
              <tr className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                <td colSpan={5} className="px-5 py-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Total ({filtered.length} {filtered.length === 1 ? "entry" : "entries"})
                </td>
                <td className="px-5 py-3 text-center font-bold tabular-nums" style={{ color: "var(--danger)" }}>
                  {fmtMYR(totalExpenses)}
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

      <ExpenseEntryDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        propertyId={property.id}
        propertyName={property.name}
      />

      {editing && (
        <ExpenseEditDrawer
          entry={editing}
          propertyName={property.name}
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
