"use client";

import { useEffect, useMemo, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { Select } from "@/components/ui/Select";
import { DatePickerField } from "@/components/ui/DatePicker";
import {
  MONTHS_FULL,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
} from "@/types/rental";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Item = {
  key: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  /** Payment date for this line — defaults to today; user can change it. */
  date: string;
  /** Whether this expense / maintenance issue has been fixed/resolved. */
  fixed: boolean;
};

let _seq = 0;
function newItem(): Item {
  _seq += 1;
  return { key: `qe-item-${_seq}`, category: "maintenance", description: "", amount: "", date: todayISO(), fixed: false };
}

function fmt(v: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2 }).format(v);
}

/**
 * Inline expense form body — same item logic/save as {@link ExpenseEntryDrawer}
 * without drawer chrome, for the Quick Entry page. Property / period are
 * controlled by the parent.
 */
export function ExpenseEntryForm({
  propertyId,
  year,
  month,
  onSaved,
  onDirtyChange,
  datePanel,
  contextSlot,
}: {
  propertyId: string;
  year: number;
  month: number;
  onSaved?: () => void;
  /** Report whether the user has entered any expense detail yet. */
  onDirtyChange?: (dirty: boolean) => void;
  /** When provided, render the balanced two-column + sticky-footer layout. */
  datePanel?: React.ReactNode;
  /** Optional selectors (property) rendered atop the right column. */
  contextSlot?: React.ReactNode;
}) {
  const { addExpenseEntry, getPropertyYTD, getProperty, getUnitsForProperty } = useRental();

  const property = propertyId ? getProperty(propertyId) : undefined;
  const units = useMemo(() => (propertyId ? getUnitsForProperty(propertyId) : []), [propertyId, getUnitsForProperty]);
  const showRoomSelector = property?.rental_model === "room_rental" && units.length > 1;
  // Empty = whole property / shared cost (optional attribution to one room).
  const [unitId, setUnitId] = useState("");

  const [items, setItems] = useState<Item[]>([newItem()]);
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const validItems = useMemo(() => items.filter((it) => (parseFloat(it.amount) || 0) > 0), [items]);

  // Dirty once any line has a description or amount typed in.
  useEffect(() => {
    if (!onDirtyChange) return;
    onDirtyChange(items.some((it) => it.description.trim() !== "" || it.amount.trim() !== ""));
  }, [items, onDirtyChange]);
  const total = validItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
  const canSave = validItems.length > 0 && !!propertyId;
  const ytd = propertyId ? getPropertyYTD(propertyId, year) : { revenue: 0, expenses: 0, net: 0 };

  function updateItem(key: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
    if (savedCount) setSavedCount(0);
  }
  function addRow() {
    setItems((prev) => [...prev, newItem()]);
  }
  function removeRow(key: string) {
    setItems((prev) => (prev.length === 1 ? [newItem()] : prev.filter((it) => it.key !== key)));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      for (const it of validItems) {
        const desc = it.description.trim() || null;
        await addExpenseEntry({
          property_id: propertyId,
          unit_id: showRoomSelector ? (unitId || null) : null,
          year,
          month,
          expense_date: it.date || todayISO(),
          category: it.category,
          custom_category: it.category === "other" ? desc : null,
          amount: parseFloat(it.amount) || 0,
          description: desc,
          is_recurring: false,
          is_irregular: false,
          is_fixed: it.fixed,
        });
      }
      setSavedCount(validItems.length);
      setItems([newItem()]);
      onSaved?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save expenses to the database.");
    } finally {
      setSaving(false);
    }
  }

  // ── Field fragments (shared by both layouts; logic untouched) ──
  const roomField = showRoomSelector ? (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5" style={{ color: "var(--text-faint)" }}>
        Room (optional)
      </label>
      <Select
        value={unitId}
        ariaLabel="Attribute expense to a room"
        placeholder="Whole property / shared"
        onChange={setUnitId}
        options={[
          { value: "", label: "Whole property / shared" },
          ...units.map((u) => ({ value: u.id, label: `${u.name}${u.tenant_name ? ` - ${u.tenant_name}` : ""}` })),
        ]}
      />
    </div>
  ) : null;

  const intro = (
    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
      List everything you paid for this month - one line each.
    </p>
  );

  const itemRows = items.map((it, i) => {
    return (
      <div key={it.key} className="rounded-xl p-3 flex flex-col gap-2.5"
        style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>
            Item {i + 1}
          </span>
          <button type="button" onClick={() => removeRow(it.key)} aria-label="Remove item"
            className="w-6 h-6 rounded flex items-center justify-center" style={{ color: "var(--text-faint)" }}>
            <CloseIcon size={12} />
          </button>
        </div>

        {/* Category + amount */}
        <div className="grid grid-cols-1 @sm:grid-cols-[1fr_140px] gap-2.5">
          <Select
            value={it.category}
            ariaLabel={`Expense category for item ${i + 1}`}
            onChange={(value) => updateItem(it.key, { category: value as ExpenseCategory })}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABEL[c] }))}
          />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-faint)" }}>RM</span>
            <input type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00"
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border outline-none transition focus:border-[var(--accent)] text-right tabular-nums"
              style={{ borderColor: "var(--border-soft)", background: "var(--surface)", color: "var(--text-primary)" }}
              value={it.amount} onChange={(e) => updateItem(it.key, { amount: e.target.value })} />
          </div>
        </div>

        {/* Detail (optional) */}
        <input type="text" inputMode="text" placeholder="Detail (Optional)"
          className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition focus:border-[var(--accent)]"
          style={{ borderColor: "var(--border-soft)", background: "var(--surface)", color: "var(--text-primary)" }}
          value={it.description} onChange={(e) => updateItem(it.key, { description: e.target.value })} />

        {/* Payment date — defaults to today, collapsed until opened */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5" style={{ color: "var(--text-faint)" }}>
            Payment date
          </label>
          <DatePickerField
            value={it.date}
            onChange={(v) => updateItem(it.key, { date: v })}
            ariaLabel={`Payment date for item ${i + 1}`}
          />
        </div>

        {/* Fixed toggle — marks the maintenance/expense as resolved (drives the
            green vs yellow month colouring). */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={it.fixed}
            onChange={(e) => updateItem(it.key, { fixed: e.target.checked })}
            style={{ accentColor: "var(--success)", width: 14, height: 14 }} />
          <span className="text-xs font-medium" style={{ color: it.fixed ? "var(--success)" : "var(--text-muted)" }}>
            Fixed / resolved
          </span>
        </label>
      </div>
    );
  });

  const addRowButton = (
    <button type="button" onClick={addRow}
      className="w-full rounded-xl py-2.5 text-sm font-medium transition"
      style={{ border: "1px dashed var(--border-strong)", color: "var(--accent)", background: "transparent" }}>
      + Add another item
    </button>
  );

  const banners = (
    <>
      {savedCount > 0 && (
        <div className="rounded-lg px-4 py-2.5 flex items-center gap-2" style={{ background: "rgba(47,158,111,0.10)", border: "1px solid var(--success)" }}>
          <span style={{ color: "var(--success)" }}>&#10003;</span>
          <span className="text-xs font-medium" style={{ color: "var(--success)" }}>
            Saved {savedCount} {savedCount === 1 ? "expense" : "expenses"} - {MONTHS_FULL[month - 1]} {year}
          </span>
        </div>
      )}
      {saveError && (
        <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: "rgba(211,84,84,0.08)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
          {saveError}
        </div>
      )}
    </>
  );

  // Total month expenses — mirrors the Revenue form's "Total month revenue" row.
  const totalRow = (
    <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Total month expenses</span>
      <span className="text-xl font-bold tabular-nums" style={{ color: "var(--danger)" }}>{fmt(total)}</span>
    </div>
  );
  const saveButton = (
    <button type="button" className="ui-btn ui-btn-primary justify-center" disabled={!canSave || saving}
      style={{ opacity: !canSave || saving ? 0.55 : 1 }} onClick={handleSave}>
      {saving
        ? "Saving..."
        : validItems.length > 1
          ? `Save ${validItems.length} Expenses`
          : "Save Expenses"}
    </button>
  );

  // ── Balanced split layout: left = date, right scrolls, sticky footer ──
  if (datePanel) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] flex-1 min-h-0">
          {/* LEFT — month selector only. Matches the Revenue form: no scroll,
              sized to fit the panel. */}
          <div className="flex flex-col gap-3 px-5 py-4 lg:border-r min-h-0 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ borderColor: "var(--border-soft)" }}>
            {datePanel}
          </div>

          {/* RIGHT — expense items (only this body scrolls) */}
          <div className="@container flex flex-col gap-4 px-5 py-4 overflow-y-auto min-h-0">
            {contextSlot}
            {roomField}
            {intro}
            {itemRows}
            {addRowButton}
          </div>
        </div>

        {/* STICKY FOOTER — total month expenses + Save action, always visible */}
        <div className="px-5 py-3 flex flex-col gap-2.5 shrink-0 sticky bottom-0 z-10" style={{ borderTop: "1px solid var(--border-soft)", background: "var(--surface)" }}>
          {banners}
          {totalRow}
          <div className="flex items-center justify-end gap-2">{saveButton}</div>
        </div>
      </div>
    );
  }

  // ── Original stacked layout (unchanged behavior) ──
  return (
    <div className="flex flex-col gap-3 @container">
      {contextSlot}
      {roomField}
      {intro}
      {itemRows}
      {addRowButton}
      {banners}
      <div className="flex items-center justify-between pt-1">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>
            Total - {validItems.length} {validItems.length === 1 ? "item" : "items"}
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            Expenses YTD becomes {fmt(ytd.expenses + total)}
          </span>
        </div>
        <span className="text-xl font-bold tabular-nums" style={{ color: "var(--danger)" }}>{fmt(total)}</span>
      </div>
      {saveButton}
    </div>
  );
}

function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
