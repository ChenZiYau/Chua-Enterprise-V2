"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { DatePickerField } from "@/components/ui/DatePicker";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { ExpenseEntryDrawer } from "@/components/property/ExpenseEntryDrawer";
import { EditModalShell } from "@/components/ui/EditModalShell";
import {
  MONTHS,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
  type ExpenseEntry,
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
  const { expenseEntries, visibleProperties, deleteExpenseEntry, updateExpenseEntry, getUnit } = useRental();
  const confirm = useConfirm();

  const [fromMonth, setFromMonth] = useState(toMonthInput(CUR_YEAR, 1));
  const [toMonth, setToMonth] = useState(toMonthInput(CUR_YEAR, 12));
  const [search, setSearch] = useState("");
  const [filterProp, setFilterProp] = useState("all");
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseEntry | null>(null);

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

  const resetKey = `${fromMonth}|${toMonth}|${search}|${filterProp}|${filterCategory}`;
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

      {/* Filters */}
      <div className="ui-card p-4 flex flex-wrap gap-3 items-center">
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
                  Room
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
                      style={{ color: entry.unit_id ? "var(--text-secondary)" : "var(--text-faint)" }}
                    >
                      {entry.unit_id ? (getUnit(entry.unit_id)?.name ?? "-") : "Whole property"}
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => setEditing(entry)}
                          className="w-7 h-7 rounded flex items-center justify-center transition border border-[var(--border)] hover:bg-[var(--surface-subtle)]"
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
        <EditExpenseDrawer
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

function EditExpenseDrawer({
  entry,
  propertyName,
  onClose,
  onSave,
}: {
  entry: ExpenseEntry;
  propertyName: string;
  onClose: () => void;
  onSave: (patch: Partial<ExpenseEntry>) => Promise<void>;
}) {
  const [category, setCategory] = useState<ExpenseCategory>(entry.category);
  const [customCategory, setCustomCategory] = useState(entry.custom_category ?? "");
  const [amount, setAmount] = useState(String(entry.amount));
  const [description, setDescription] = useState(entry.description ?? "");
  const [isRecurring, setIsRecurring] = useState(!!entry.is_recurring);
  const [isIrregular, setIsIrregular] = useState(!!entry.is_irregular);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls = "w-full px-3 py-2 text-sm rounded-lg border outline-none transition focus:border-[var(--accent)]";
  const inputStyle: React.CSSProperties = { borderColor: "var(--border-soft)", background: "var(--surface)", color: "var(--text-primary)" };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        category,
        custom_category: category === "other" ? customCategory.trim() || null : null,
        amount: amt,
        description: description.trim() || null,
        is_recurring: isRecurring,
        is_irregular: isIrregular,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the expense.");
      setSaving(false);
    }
  }

  const dirty =
    category !== entry.category ||
    customCategory !== (entry.custom_category ?? "") ||
    amount !== String(entry.amount) ||
    description !== (entry.description ?? "") ||
    isRecurring !== !!entry.is_recurring ||
    isIrregular !== !!entry.is_irregular;

  return (
    <EditModalShell
      open
      onClose={onClose}
      placement="center"
      widthClass="max-w-2xl"
      eyebrow="Edit expense"
      title={propertyName}
      subtitle={`${MONTHS[entry.month - 1]} ${entry.year}`}
      dirty={dirty}
      saving={saving}
      primaryFormId="expense-edit-form"
      primaryLabel="Save Changes"
    >
      <form id="expense-edit-form" onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>Category</span>
            <Select
              value={category}
              onChange={(v) => setCategory(v as ExpenseCategory)}
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABEL[c] }))}
            />
          </label>
          {category === "other" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>Custom category</span>
              <input className={inputCls} style={inputStyle} value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>Amount (RM)</span>
            <input type="number" inputMode="decimal" min={0} step="0.01" className={inputCls} style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>Description</span>
            <textarea rows={3} className={inputCls + " resize-y"} style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
              Recurring
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={isIrregular} onChange={(e) => setIsIrregular(e.target.checked)} />
              Irregular
            </label>
          </div>
        {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
      </form>
    </EditModalShell>
  );
}
