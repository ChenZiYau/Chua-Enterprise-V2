"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { Select } from "@/components/ui/Select";
import {
  MONTHS,
  MONTHS_FULL,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
} from "@/types/rental";

type View = "normal" | "expanded";

type Item = {
  key: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
};

let _seq = 0;
function newItem(): Item {
  _seq += 1;
  return { key: `item-${_seq}`, category: "maintenance", description: "", amount: "" };
}

function fmt(v: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(v);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExpenseEntryDrawer({
  open,
  onClose,
  propertyName,
  propertyId,
}: {
  open: boolean;
  onClose: () => void;
  /** Optional - when omitted the drawer shows a property picker (e.g. from the Expenses ledger). */
  propertyName?: string;
  propertyId?: string;
}) {
  const { addExpenseEntry, getPropertyYTD, getExpensesForProperty, visibleProperties, getProperty, getUnitsForProperty } = useRental();
  const now = new Date();

  const [view, setView] = useState<View>("normal");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // When a propertyId is provided it is locked; otherwise the user picks one.
  const lockProperty = !!propertyId;
  const [selectedProperty, setSelectedProperty] = useState(propertyId ?? "");

  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [items, setItems] = useState<Item[]>([newItem()]);
  // Empty = whole property / shared cost (optional attribution to one room).
  const [unitId, setUnitId] = useState("");

  const activePropertyId = lockProperty ? propertyId! : selectedProperty;
  const activePropertyName =
    propertyName ??
    visibleProperties.find((p) => p.id === activePropertyId)?.name ??
    "Add expenses";

  const activeUnits = useMemo(
    () => (activePropertyId ? getUnitsForProperty(activePropertyId) : []),
    [activePropertyId, getUnitsForProperty]
  );
  const showRoomSelector =
    getProperty(activePropertyId)?.rental_model === "room_rental" && activeUnits.length > 1;

  // Reset the room when the chosen property changes (room list differs).
  useEffect(() => {
    setUnitId("");
  }, [activePropertyId]);

  // Reset every time the drawer opens.
  useEffect(() => {
    if (open) {
      setView("normal");
      setConfirmOpen(false);
      setSavedCount(0);
      setSaving(false);
      setSaveError(null);
      setSelectedProperty(propertyId ?? "");
      setUnitId("");
      setYear(now.getFullYear());
      setMonthIdx(now.getMonth());
      setItems([newItem()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, propertyId]);

  // An entry is "dirty" if any row has a description or amount typed in.
  const dirty = useMemo(
    () => items.some((it) => it.description.trim() !== "" || it.amount.trim() !== ""),
    [items]
  );

  const validItems = items.filter((it) => (parseFloat(it.amount) || 0) > 0);
  const total = validItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
  const canSave = validItems.length > 0 && !!activePropertyId;

  const attemptClose = useCallback(() => {
    if (dirty) setConfirmOpen(true);
    else onClose();
  }, [dirty, onClose]);

  // Lock scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape: close confirm first, then the drawer.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmOpen) setConfirmOpen(false);
      else attemptClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirmOpen, attemptClose]);

  function updateItem(key: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function addRow() {
    setItems((prev) => [...prev, newItem()]);
  }
  function removeRow(key: string) {
    setItems((prev) => (prev.length === 1 ? [newItem()] : prev.filter((it) => it.key !== key)));
  }

  async function handleSave() {
    if (!canSave) return;
    const month = monthIdx + 1;
    const date = todayISO();
    setSaving(true);
    setSaveError(null);
    try {
      for (const it of validItems) {
        const desc = it.description.trim() || null;
        await addExpenseEntry({
          property_id: activePropertyId,
          unit_id: showRoomSelector ? (unitId || null) : null,
          year,
          month,
          expense_date: date,
          category: it.category,
          custom_category: it.category === "other" ? desc : null,
          amount: parseFloat(it.amount) || 0,
          description: desc,
          is_recurring: false,
          is_irregular: false,
        });
      }
      setSavedCount(validItems.length);
      setTimeout(() => onClose(), 700);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save expenses to Notion.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const widthClass = view === "expanded" ? "max-w-5xl" : "max-w-3xl";
  const ytd = activePropertyId ? getPropertyYTD(activePropertyId, year) : { revenue: 0, expenses: 0, net: 0 };
  const yearExpenses = activePropertyId ? getExpensesForProperty(activePropertyId, year) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button type="button" aria-label="Close" onClick={attemptClose} className="absolute inset-0"
        style={{ background: "rgba(15,17,22,0.40)", animation: "exFadeIn 140ms ease" }} />

      <aside role="dialog" aria-modal="true" aria-labelledby="expense-drawer-title"
        className={`relative w-full ${widthClass} max-h-[92vh] flex flex-col rounded-2xl overflow-hidden @container`}
        style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", boxShadow: "0 24px 64px rgba(15,17,22,0.24)", animation: "exPop 180ms cubic-bezier(.2,.7,.2,1)" }}
      >
        {/* Header */}
        <header className="px-6 py-5 flex items-start justify-between gap-4" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
              Add expenses{dirty ? " - unsaved" : ""}
            </p>
            <h2 id="expense-drawer-title" className="text-lg font-semibold mt-1 truncate" style={{ color: "var(--text-primary)" }}>
              {activePropertyName}
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              List everything you paid for this month - one line each.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <IconBtn label={view === "expanded" ? "Collapse" : "Expand"} onClick={() => setView(view === "expanded" ? "normal" : "expanded")}>
              {view === "expanded" ? <CollapseIcon /> : <ExpandIcon />}
            </IconBtn>
          </div>
        </header>

        {/* Property picker - only when not opened from a specific property */}
        {!lockProperty && (
          <div className="px-6 pt-4 pb-1">
            <label className="text-[10px] uppercase tracking-[0.14em] block mb-1.5" style={{ color: "var(--text-faint)" }}>
              Property
            </label>
            <Select
              value={selectedProperty}
              placeholder="Select property..."
              onChange={setSelectedProperty}
              options={visibleProperties.map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
        )}

        {/* Year status grid - pick the billing month here (matches the Revenue drawer) */}
        <div className="px-6 pt-4 pb-4" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>{year} status</p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setYear((y) => y - 1)} className="ui-btn" style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}>&lt;</button>
              <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)", minWidth: 34, textAlign: "center" }}>{year}</span>
              <button type="button" onClick={() => setYear((y) => y + 1)} className="ui-btn" style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}>&gt;</button>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {MONTHS.map((m, i) => {
              const hasEntry = yearExpenses.some((e) => e.month === i + 1);
              const isCurrent = i === monthIdx;
              return (
                <button key={m} type="button" onClick={() => setMonthIdx(i)} className="rounded-md py-1.5 text-center text-[11px] font-medium transition"
                  style={{
                    background: isCurrent ? "var(--accent)" : hasEntry ? "rgba(47,158,111,0.12)" : "var(--surface-subtle)",
                    color: isCurrent ? "#fff" : hasEntry ? "var(--success)" : "var(--text-secondary)",
                    border: `1px solid ${isCurrent ? "var(--accent)" : hasEntry ? "var(--success)" : "var(--border-soft)"}`,
                  }}>{m}</button>
              );
            })}
          </div>
        </div>

        {/* Room attribution - room-based properties with multiple rooms */}
        {showRoomSelector && (
          <div className="px-6 pt-4 pb-1">
            <label className="text-[10px] uppercase tracking-[0.14em] block mb-1.5" style={{ color: "var(--text-faint)" }}>
              Room (optional)
            </label>
            <Select
              value={unitId}
              ariaLabel="Attribute expense to a room"
              placeholder="Whole property / shared"
              onChange={setUnitId}
              options={[
                { value: "", label: "Whole property / shared" },
                ...activeUnits.map((u) => ({ value: u.id, label: `${u.name}${u.tenant_name ? ` - ${u.tenant_name}` : ""}` })),
              ]}
            />
          </div>
        )}

        {/* Items */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {items.map((it, i) => {
            const amt = parseFloat(it.amount) || 0;
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

                <input type="text" inputMode="text" placeholder="What was it? e.g. Fixed kitchen tap"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition focus:border-[var(--accent)]"
                  style={{ borderColor: "var(--border-soft)", background: "var(--surface)", color: "var(--text-primary)" }}
                  value={it.description} onChange={(e) => updateItem(it.key, { description: e.target.value })} />

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
                {amt > 0 && it.description.trim() === "" && (
                  <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>Tip: add a short note so you remember what this was.</p>
                )}
              </div>
            );
          })}

          <button type="button" onClick={addRow}
            className="w-full rounded-xl py-2.5 text-sm font-medium transition"
            style={{ border: "1px dashed var(--border-strong)", color: "var(--accent)", background: "transparent" }}>
            + Add another item
          </button>

          {savedCount > 0 && (
            <div className="rounded-lg px-4 py-2.5 flex items-center gap-2" style={{ background: "rgba(47,158,111,0.10)", border: "1px solid var(--success)" }}>
              <span style={{ color: "var(--success)" }}>&#10003;</span>
              <span className="text-xs font-medium" style={{ color: "var(--success)" }}>
                Saved {savedCount} {savedCount === 1 ? "expense" : "expenses"} - {MONTHS_FULL[monthIdx]} {year}
              </span>
            </div>
          )}
          {saveError && (
            <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: "rgba(211,84,84,0.08)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
              {saveError}
            </div>
          )}
        </div>

        {/* Footer with running total */}
        <footer className="px-6 py-4 flex flex-col gap-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <div className="flex items-center justify-between">
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
          <div className="flex items-center justify-end gap-2">
            <button type="button" className="ui-btn" onClick={attemptClose}>{dirty ? "Discard" : "Close"}</button>
            <button type="button" className="ui-btn ui-btn-primary" disabled={!canSave || savedCount > 0 || saving}
              style={{ opacity: !canSave || savedCount > 0 || saving ? 0.55 : 1 }} onClick={handleSave}>
              {saving ? "Saving..." : savedCount > 0 ? "Saved" : `Save ${validItems.length || ""} ${validItems.length === 1 ? "expense" : "expenses"}`.trim()}
            </button>
          </div>
        </footer>
      </aside>

      {confirmOpen && (
        <ConfirmDialog canSave={canSave} onSave={handleSave} onDiscard={() => { setConfirmOpen(false); onClose(); }} onCancel={() => setConfirmOpen(false)} />
      )}

      <Keyframes />
    </div>
  );
}

function ConfirmDialog({
  canSave, onSave, onDiscard, onCancel,
}: {
  canSave: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" aria-label="Keep editing" onClick={onCancel} className="absolute inset-0"
        style={{ background: "rgba(15,17,22,0.48)", animation: "exFadeIn 120ms ease" }} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="exp-discard-title"
        className="relative w-full max-w-sm rounded-2xl p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", boxShadow: "0 24px 64px rgba(15,17,22,0.24)", animation: "exPop 160ms cubic-bezier(.2,.7,.2,1)" }}>
        <h3 id="exp-discard-title" className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Unsaved expenses</h3>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          You have expenses you haven&apos;t saved yet. Save them or discard and close?
        </p>
        <div className="flex items-center justify-end gap-2 mt-6">
          <button type="button" className="ui-btn" onClick={onCancel}>Keep editing</button>
          <button type="button" className="ui-btn" onClick={onDiscard} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>Discard</button>
          <button type="button" className="ui-btn ui-btn-primary" disabled={!canSave} onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="w-8 h-8 rounded-md flex items-center justify-center"
      style={{ color: "var(--text-muted)", border: "1px solid var(--border-soft)", background: "var(--surface)" }}>
      {children}
    </button>
  );
}

function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function ExpandIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>;
}
function CollapseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg>;
}

function Keyframes() {
  return (
    <style jsx global>{`
      @keyframes exSlideIn { from { transform: translateX(16px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes exSlideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes exFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes exPop { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `}</style>
  );
}
