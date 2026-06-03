"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { ExpenseEntryDrawer } from "@/components/property/ExpenseEntryDrawer";
import {
  MONTHS,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
} from "@/types/rental";

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

export default function ExpensesPage() {
  const { expenseEntries, visibleProperties, deleteExpenseEntry } = useRental();
  const confirm = useConfirm();

  const [fromMonth, setFromMonth] = useState(toMonthInput(CUR_YEAR, 1));
  const [toMonth, setToMonth] = useState(toMonthInput(CUR_YEAR, 12));
  const [search, setSearch] = useState("");
  const [filterProp, setFilterProp] = useState("all");
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">("all");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const from = parseMonthInput(fromMonth);
    const to = parseMonthInput(toMonth);
    const q = search.trim().toLowerCase();
    return expenseEntries
      .filter((e) => {
        if (from && monthKey(e.year, e.month) < monthKey(from.y, from.m)) return false;
        if (to && monthKey(e.year, e.month) > monthKey(to.y, to.m)) return false;
        return true;
      })
      .filter((e) => filterProp === "all" || e.property_id === filterProp)
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
    fromMonth,
    toMonth,
    search,
    filterProp,
    filterCategory,
    visibleProperties,
  ]);

  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);

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

      {/* Filters */}
      <div className="ui-card p-4 flex flex-wrap gap-3 items-center">
        <input
          type="month"
          className="ui-input w-auto"
          value={fromMonth}
          onChange={(e) => setFromMonth(e.target.value)}
          aria-label="From month"
        />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
        <input
          type="month"
          className="ui-input w-auto"
          value={toMonth}
          onChange={(e) => setToMonth(e.target.value)}
          aria-label="To month"
        />

        <input
          type="search"
          className="ui-input w-auto min-w-[200px] flex-1 max-w-[260px]"
          placeholder="Search property, category, description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <Select
          className="w-auto min-w-[160px]"
          ariaLabel="Filter by property"
          value={filterProp}
          onChange={setFilterProp}
          options={[
            { value: "all", label: "All Properties" },
            ...visibleProperties.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />

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

        <div
          className="ml-auto text-sm font-semibold"
          style={{ color: "var(--danger)" }}
        >
          Total: {fmt(totalExpenses)}
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
                <th className="text-left text-xs uppercase tracking-wider px-5 py-3">
                  Property
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Month
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Category
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Description
                </th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">
                  Type
                </th>
                <th className="text-right text-xs uppercase tracking-wider px-5 py-3">
                  Amount
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
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
                      {MONTHS[entry.month - 1]} {entry.year}
                    </td>
                    <td className="px-4 py-3">
                      <span className="ui-chip text-xs">{categoryLabel}</span>
                    </td>
                    <td
                      className="px-4 py-3 max-w-[200px] truncate"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {entry.description ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.is_recurring ? (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(93,95,239,0.10)",
                            color: "var(--accent)",
                          }}
                        >
                          Recurring
                        </span>
                      ) : entry.is_irregular ? (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(224,162,61,0.10)",
                            color: "var(--warning)",
                          }}
                        >
                          Irregular
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-faint)" }}>-</span>
                      )}
                    </td>
                    <td
                      className="px-5 py-3 text-right font-semibold tabular-nums"
                      style={{ color: "var(--danger)" }}
                    >
                      {fmt(entry.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => handleDelete(entry.id, label)}
                        className="w-7 h-7 rounded flex items-center justify-center transition hover:bg-[var(--surface-subtle)] ml-auto"
                        style={{ color: "var(--danger)" }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
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
                  {filtered.length === 1 ? "entry" : "entries"})
                </td>
                <td
                  className="px-5 py-3 text-right font-bold tabular-nums"
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

      {/* Add Expense - same itemized drawer used on the property page */}
      <ExpenseEntryDrawer open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
