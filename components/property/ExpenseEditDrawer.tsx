"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { EditModalShell } from "@/components/ui/EditModalShell";
import {
  MONTHS,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
  type ExpenseEntry,
} from "@/types/rental";

/** Edit a single expense entry. Shared by the Expenses ledger page and the
 *  property-detail Expenses tab. */
export function ExpenseEditDrawer({
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
