"use client";

import { useEffect, useState } from "react";
import { useRental } from "@/context/RentalContext";
import {
  MONTHS,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
} from "@/types/rental";
import { calculateElectricityCharge } from "@/lib/electricity";

export type EntryTab = "revenue" | "expense";

const inputClass = "w-full px-3 py-2 text-sm rounded-lg border outline-none transition focus:border-[var(--accent)]";
const inputStyle: React.CSSProperties = {
  borderColor: "var(--border-soft)",
  background: "var(--surface)",
  color: "var(--text-primary)",
};

export function EntryDrawer({
  open, onClose, propertyName, propertyId, unitId, unitName,
  initialTab = "revenue", preselectedMonth, preselectedYear,
}: {
  open: boolean;
  onClose: () => void;
  propertyName: string;
  propertyId: string;
  unitId: string;
  unitName: string;
  initialTab?: EntryTab;
  preselectedMonth?: number;
  preselectedYear?: number;
}) {
  const { getUnit, getRevenueEntry, addRevenueEntry, updateRevenueEntry, addExpenseEntry, getExpensesForMonth, deleteExpenseEntry } = useRental();
  const unit = getUnit(unitId);
  const now = new Date();

  const [tab, setTab] = useState<EntryTab>(initialTab);
  const [year, setYear] = useState(preselectedYear ?? now.getFullYear());
  const [monthIdx, setMonthIdx] = useState<number>(preselectedMonth ?? now.getMonth());
  const month = monthIdx + 1;

  const [rental, setRental] = useState("");
  const [elecUnits, setElecUnits] = useState("");
  const [elecAmount, setElecAmount] = useState("");
  const [revNote, setRevNote] = useState("");
  const [revSaved, setRevSaved] = useState(false);

  const [expCategory, setExpCategory] = useState<ExpenseCategory>("electricity");
  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expAdded, setExpAdded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRevSaved(false);
    const existing = getRevenueEntry(unitId, year, month);
    if (existing) {
      setRental(String(existing.rental_amount));
      setElecUnits(existing.electricity_units != null ? String(existing.electricity_units) : "");
      setElecAmount(existing.electricity_amount != null ? String(existing.electricity_amount) : "");
      setRevNote(existing.notes ?? "");
    } else {
      setRental(unit?.rental_rate ? String(unit.rental_rate) : "");
      setElecUnits(""); setElecAmount(""); setRevNote("");
    }
    setExpAmount(""); setExpDesc(""); setExpAdded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unitId, year, monthIdx]);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setYear(preselectedYear ?? now.getFullYear());
      setMonthIdx(preselectedMonth ?? now.getMonth());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!elecUnits) { setElecAmount(""); return; }
    const n = parseFloat(elecUnits);
    const free = unit?.electricity_free_units ?? 0;
    if (!isNaN(n)) {
      const bill = calculateElectricityCharge(n, free);
      setElecAmount(bill.chargeAmount > 0 ? bill.chargeAmount.toFixed(2) : "0.00");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elecUnits]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const rentalNum = parseFloat(rental) || 0;
  const elecNum = parseFloat(elecAmount) || 0;
  const total = rentalNum + elecNum;
  const existingEntry = getRevenueEntry(unitId, year, month);
  const monthExpenses = getExpensesForMonth(propertyId, year, month);

  function fmt(v: number) {
    return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2 }).format(v);
  }

  function handleSaveRevenue() {
    if (!rental) return;
    const payload = {
      property_id: propertyId, unit_id: unitId, year, month,
      rental_amount: rentalNum,
      electricity_units: elecUnits ? parseFloat(elecUnits) : null,
      electricity_amount: elecNum > 0 ? elecNum : null,
      other_charges_amount: null,
      total_amount: total,
      payment_date: null,
      payment_method: null as null,
      custom_payment_method: null,
      payment_status: "paid" as const,
      notes: revNote || null,
      invoice_generated: true,
    };
    if (existingEntry) { updateRevenueEntry(existingEntry.id, payload); } else { addRevenueEntry(payload); }
    setRevSaved(true);
  }

  function handleAddExpense() {
    if (!expAmount) return;
    addExpenseEntry({
      property_id: propertyId, year, month,
      category: expCategory,
      amount: parseFloat(expAmount) || 0,
      description: expDesc || null,
    });
    setExpAmount(""); setExpDesc(""); setExpAdded(true);
    setTimeout(() => setExpAdded(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" aria-label="Close drawer" onClick={onClose} className="absolute inset-0"
        style={{ background: "rgba(15,17,22,0.40)", animation: "fadeIn 140ms ease" }} />

      <aside role="dialog" aria-modal="true" aria-labelledby="entry-drawer-title"
        className="relative ml-auto h-full w-full max-w-md flex flex-col"
        style={{ background: "var(--surface)", borderLeft: "1px solid var(--border-soft)", boxShadow: "-8px 0 32px rgba(15,17,22,0.10)", animation: "slideIn 220ms cubic-bezier(.2,.7,.2,1)" }}
      >
        {/* Header */}
        <header className="px-6 py-5 flex items-start justify-between gap-4" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>{propertyName} · {unitName}</p>
            <h2 id="entry-drawer-title" className="text-lg font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
              {existingEntry ? "Edit Entry" : "New Entry"}
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Record revenue or expense.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border-soft)", background: "var(--surface)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Month / Year */}
        <div className="px-6 pt-4 pb-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setYear((y) => y - 1)} className="ui-btn" style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}>‹</button>
            <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)", minWidth: 38, textAlign: "center" }}>{year}</span>
            <button type="button" onClick={() => setYear((y) => y + 1)} className="ui-btn" style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}>›</button>
          </div>
          <select className="ui-select flex-1" value={monthIdx} onChange={(e) => { setMonthIdx(Number(e.target.value)); setRevSaved(false); }}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </div>

        {/* Tab switcher */}
        <div className="px-6 pt-4 pb-2">
          <div className="inline-flex p-1 rounded-lg w-full" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }} role="tablist">
            {(["revenue", "expense"] as const).map((t) => {
              const active = tab === t;
              return (
                <button key={t} type="button" role="tab" aria-selected={active} onClick={() => setTab(t)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition"
                  style={{ background: active ? "var(--surface)" : "transparent", color: active ? "var(--text-primary)" : "var(--text-muted)", boxShadow: active ? "var(--shadow-xs)" : "none" }}
                >
                  {t === "revenue" ? "Revenue" : "Expense"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {tab === "revenue" ? (
            <>
              <Field label="Rental (MYR)" required>
                <input type="number" min={0} step="0.01" placeholder={unit?.rental_rate ? String(unit.rental_rate) : "0.00"}
                  className={inputClass} style={inputStyle} value={rental}
                  onChange={(e) => { setRental(e.target.value); setRevSaved(false); }} />
              </Field>

              {unit && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Electricity (kWh)">
                    <input type="number" min={0} step="1" placeholder="Units used" className={inputClass} style={inputStyle}
                      value={elecUnits} onChange={(e) => { setElecUnits(e.target.value); setRevSaved(false); }} />
                  </Field>
                  <Field label="Charge (MYR)">
                    <input type="number" min={0} step="0.01" placeholder="Auto-calc" className={inputClass} style={inputStyle}
                      value={elecAmount} onChange={(e) => { setElecAmount(e.target.value); setRevSaved(false); }} />
                  </Field>
                </div>
              )}

              {unit && unit.electricity_free_units > 0 && elecUnits && (
                <p className="text-xs -mt-1" style={{ color: "var(--text-muted)" }}>
                  Free: {unit.electricity_free_units} kWh · Chargeable: {Math.max(0, (parseFloat(elecUnits) || 0) - unit.electricity_free_units)} kWh
                </p>
              )}

              <Field label="Note">
                <input type="text" placeholder="Optional details" className={inputClass} style={inputStyle}
                  value={revNote} onChange={(e) => { setRevNote(e.target.value); setRevSaved(false); }} />
              </Field>

              {(rentalNum > 0 || elecNum > 0) && (
                <div className="rounded-lg px-4 py-2.5 flex justify-between" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Total</span>
                  <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{fmt(total)}</span>
                </div>
              )}

              {revSaved && (
                <div className="rounded-lg px-4 py-2.5 flex items-center gap-2" style={{ background: "rgba(47,158,111,0.10)", border: "1px solid var(--success)" }}>
                  <span style={{ color: "var(--success)" }}>✓</span>
                  <span className="text-xs font-medium" style={{ color: "var(--success)" }}>Saved · {MONTHS[monthIdx]} {year}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", color: "var(--text-muted)" }}>
                Expenses are recorded against the whole property, not a specific room.
              </p>
              <div className="flex flex-col gap-3">
                <Field label="Category" required>
                  <select className="ui-select" value={expCategory} onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}>
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</option>)}
                  </select>
                </Field>
                <Field label="Amount (MYR)" required>
                  <input type="number" min={0} step="0.01" placeholder="0.00" className={inputClass} style={inputStyle}
                    value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
                </Field>
                <Field label="Description">
                  <input type="text" placeholder="Optional details" className={inputClass} style={inputStyle}
                    value={expDesc} onChange={(e) => setExpDesc(e.target.value)} />
                </Field>
                <button type="button" disabled={!expAmount} onClick={handleAddExpense}
                  className="ui-btn ui-btn-primary self-start" style={{ opacity: !expAmount ? 0.5 : 1 }}>
                  {expAdded ? "✓ Added" : "+ Add expense"}
                </button>
              </div>

              {monthExpenses.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>
                    {MONTHS[monthIdx]} {year} expenses
                  </p>
                  {monthExpenses.map((exp) => (
                    <div key={exp.id} className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          {exp.category === "other" && exp.custom_category ? exp.custom_category : EXPENSE_CATEGORY_LABEL[exp.category]}
                        </p>
                        {exp.description && <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{exp.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold" style={{ color: "var(--danger)" }}>{fmt(exp.amount)}</span>
                        <button type="button" onClick={() => deleteExpenseEntry(exp.id)}
                          className="w-6 h-6 rounded flex items-center justify-center" style={{ color: "var(--text-faint)" }} title="Remove">×</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between rounded-lg px-3 py-2 mt-0.5" style={{ background: "rgba(211,84,84,0.07)", border: "1px solid var(--border-soft)" }}>
                    <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Total expenses</span>
                    <span className="text-sm font-bold" style={{ color: "var(--danger)" }}>{fmt(monthExpenses.reduce((s, e) => s + e.amount, 0))}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <button type="button" className="ui-btn" onClick={onClose}>Close</button>
          {tab === "revenue" && (
            <button type="button" className="ui-btn ui-btn-primary" disabled={!rental || revSaved} onClick={handleSaveRevenue}>
              {revSaved ? "✓ Saved" : existingEntry ? "Update" : "Save revenue"}
            </button>
          )}
        </footer>
      </aside>

      <style jsx>{`
        @keyframes slideIn { from { transform: translateX(16px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
        {label}{required ? <span style={{ color: "var(--accent)" }}> *</span> : null}
      </span>
      {children}
    </label>
  );
}
