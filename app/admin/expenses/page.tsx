"use client";

import { useState } from "react";
import Link from "next/link";
import { useRental } from "@/context/RentalContext";
import { ExpenseEntryDrawer } from "@/components/property/ExpenseEntryDrawer";
import {
  MONTHS,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
} from "@/types/rental";

const CUR_YEAR = new Date().getFullYear();

function fmt(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function ExpensesPage() {
  const { expenseEntries, visibleProperties, deleteExpenseEntry } = useRental();

  const [filterYear, setFilterYear] = useState(CUR_YEAR);
  const [filterProp, setFilterProp] = useState("all");
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">("all");
  const [addOpen, setAddOpen] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => CUR_YEAR - i);

  const filtered = expenseEntries
    .filter((e) => e.year === filterYear)
    .filter((e) => filterProp === "all" || e.property_id === filterProp)
    .filter((e) => filterCategory === "all" || e.category === filterCategory)
    .sort((a, b) => {
      if (a.property_id !== b.property_id)
        return a.property_id.localeCompare(b.property_id);
      return a.month - b.month;
    });

  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);

  function handleDelete(id: string, label: string) {
    if (!confirm(`Delete expense "${label}"? This cannot be undone.`)) return;
    deleteExpenseEntry(id);
  }

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">
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
        <select
          className="ui-select w-auto min-w-[110px]"
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          className="ui-select w-auto min-w-[160px]"
          value={filterProp}
          onChange={(e) => setFilterProp(e.target.value)}
        >
          <option value="all">All Properties</option>
          {visibleProperties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          className="ui-select w-auto min-w-[180px]"
          value={filterCategory}
          onChange={(e) =>
            setFilterCategory(e.target.value as ExpenseCategory | "all")
          }
        >
          <option value="all">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EXPENSE_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>

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
                const label = `${categoryLabel} — ${MONTHS[entry.month - 1]} ${entry.year}`;

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
                      {entry.description ?? "—"}
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
                        <span style={{ color: "var(--text-faint)" }}>—</span>
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

      {/* Add Expense — same itemized drawer used on the property page */}
      <ExpenseEntryDrawer open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
