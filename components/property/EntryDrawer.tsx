"use client";

import { useEffect, useState } from "react";

export type EntryTab = "revenue" | "expense";

const REVENUE_CATEGORIES = [
  "Rent",
  "Deposit",
  "Utilities reimburse",
  "Late fee",
  "Other",
];

const EXPENSE_CATEGORIES = [
  "Internet",
  "Water",
  "Electricity",
  "Repairs",
  "Insurance",
  "DBKL",
  "Indah Water",
  "Assessment fee",
  "Quit rent",
  "Maintenance",
  "Cleaning",
  "Other",
];

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border outline-none transition";
const inputStyle: React.CSSProperties = {
  borderColor: "var(--border-soft)",
  background: "var(--surface)",
  color: "var(--text-primary)",
};

export function EntryDrawer({
  open,
  onClose,
  propertyName,
  rooms,
  initialRoom,
  initialTab = "revenue",
}: {
  open: boolean;
  onClose: () => void;
  propertyName: string;
  rooms?: string[];
  initialRoom?: string;
  initialTab?: EntryTab;
}) {
  const [tab, setTab] = useState<EntryTab>(initialTab);

  // --- revenue fields ---
  const [revDate, setRevDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [room, setRoom] = useState(initialRoom ?? rooms?.[0] ?? "");
  const [rentalAmount, setRentalAmount] = useState("");
  const [electricity, setElectricity] = useState("");
  const [revCategory, setRevCategory] = useState("Rent");
  const [revNote, setRevNote] = useState("");
  const [generateInvoice, setGenerateInvoice] = useState(true);

  // --- expense rows ---
  type ExpenseRow = { id: string; date: string; amount: string; category: string };
  const newExpenseRow = (): ExpenseRow => ({
    id: Math.random().toString(36).slice(2, 9),
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    category: "Internet",
  });
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([newExpenseRow()]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset whenever the drawer opens
  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    const today = new Date().toISOString().slice(0, 10);
    setRevDate(today);
    setRoom(initialRoom ?? rooms?.[0] ?? "");
    setRentalAmount("");
    setElectricity("");
    setRevCategory("Rent");
    setRevNote("");
    setGenerateInvoice(true);
    setExpenseRows([
      {
        id: Math.random().toString(36).slice(2, 9),
        date: today,
        amount: "",
        category: "Internet",
      },
    ]);
    setSaving(false);
    setSaved(false);
  }, [open, initialRoom, initialTab, rooms]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const isRevenue = tab === "revenue";
  const verb = isRevenue ? "Save revenue" : "Save expense";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // No persistence wired here yet — close shortly after a fake save.
    setTimeout(() => {
      setSaved(true);
      setTimeout(onClose, 500);
    }, 250);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: "rgba(15,17,22,0.40)", animation: "fadeIn 140ms ease" }}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-drawer-title"
        className="relative ml-auto h-full w-full max-w-md flex flex-col"
        style={{
          background: "var(--surface)",
          borderLeft: "1px solid var(--border-soft)",
          boxShadow: "-8px 0 32px rgba(15,17,22,0.10)",
          animation: "slideIn 220ms cubic-bezier(.2,.7,.2,1)",
        }}
      >
        {/* Header */}
        <header
          className="px-6 py-5 flex items-start justify-between gap-4"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div className="min-w-0">
            <p
              className="text-[10px] uppercase tracking-[0.16em]"
              style={{ color: "var(--text-faint)" }}
            >
              {propertyName}
            </p>
            <h2
              id="entry-drawer-title"
              className="text-lg font-semibold mt-1"
              style={{ color: "var(--text-primary)" }}
            >
              New entry
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Record revenue or expense for this property.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{
              color: "var(--text-muted)",
              border: "1px solid var(--border-soft)",
              background: "var(--surface)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Segmented tab switcher */}
        <div className="px-6 pt-5">
          <div
            className="inline-flex p-1 rounded-lg w-full"
            style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}
            role="tablist"
          >
            {(["revenue", "expense"] as const).map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition capitalize"
                  style={{
                    background: active ? "var(--surface)" : "transparent",
                    color: active ? "var(--text-primary)" : "var(--text-muted)",
                    boxShadow: active ? "var(--shadow-xs)" : "none",
                  }}
                >
                  {t === "revenue" ? "Revenue" : "Expense"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {isRevenue ? (
            <>
              {rooms && rooms.length > 0 ? (
                <Field label="Room / Unit" required>
                  <select
                    required
                    className="ui-select"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                  >
                    {rooms.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <Field label="Date" required>
                <input
                  type="date"
                  required
                  className={inputClass}
                  style={inputStyle}
                  value={revDate}
                  onChange={(e) => setRevDate(e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Rental amount (MYR)" required>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    placeholder="0.00"
                    className={inputClass}
                    style={inputStyle}
                    value={rentalAmount}
                    onChange={(e) => setRentalAmount(e.target.value)}
                  />
                </Field>
                <Field label="Electricity (MYR)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className={inputClass}
                    style={inputStyle}
                    value={electricity}
                    onChange={(e) => setElectricity(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Category">
                <select
                  className="ui-select"
                  value={revCategory}
                  onChange={(e) => setRevCategory(e.target.value)}
                >
                  {REVENUE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="Note">
                <textarea
                  rows={3}
                  placeholder="Optional details"
                  className={inputClass}
                  style={inputStyle}
                  value={revNote}
                  onChange={(e) => setRevNote(e.target.value)}
                />
              </Field>

              {/* Generate invoice */}
              <label
                className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition"
                style={{
                  border: `1px solid ${generateInvoice ? "var(--accent)" : "var(--border-soft)"}`,
                  background: generateInvoice ? "var(--accent-soft)" : "var(--surface)",
                }}
              >
                <input
                  type="checkbox"
                  checked={generateInvoice}
                  onChange={(e) => setGenerateInvoice(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-current"
                  style={{ accentColor: "var(--accent)" }}
                />
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium leading-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Generate invoice from this entry
                  </p>
                  <p
                    className="text-xs mt-1 leading-relaxed"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Invoices can only be generated from saved revenue — this entry will be the source.
                  </p>
                </div>
              </label>
            </>
          ) : (
            <>
              <p
                className="text-xs rounded-lg px-3 py-2"
                style={{
                  background: "var(--surface-muted)",
                  border: "1px solid var(--border-soft)",
                  color: "var(--text-muted)",
                }}
              >
                Expenses are recorded against the whole property, not a specific room.
              </p>

              {/* Header labels for the row grid */}
              <div
                className="grid gap-2 px-1"
                style={{ gridTemplateColumns: "1fr 1fr 1.1fr 28px" }}
              >
                <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Date</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Amount (MYR)</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Category</span>
                <span />
              </div>

              {/* Rows */}
              <div className="flex flex-col gap-2 -mt-3">
                {expenseRows.map((row, i) => (
                  <div
                    key={row.id}
                    className="grid gap-2"
                    style={{ gridTemplateColumns: "1fr 1fr 1.1fr 28px" }}
                  >
                    <input
                      type="date"
                      required
                      className={inputClass}
                      style={inputStyle}
                      value={row.date}
                      onChange={(e) =>
                        setExpenseRows((rows) =>
                          rows.map((r) => (r.id === row.id ? { ...r, date: e.target.value } : r))
                        )
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      placeholder="0.00"
                      className={inputClass}
                      style={inputStyle}
                      value={row.amount}
                      onChange={(e) =>
                        setExpenseRows((rows) =>
                          rows.map((r) => (r.id === row.id ? { ...r, amount: e.target.value } : r))
                        )
                      }
                    />
                    <select
                      className="ui-select"
                      value={row.category}
                      onChange={(e) =>
                        setExpenseRows((rows) =>
                          rows.map((r) => (r.id === row.id ? { ...r, category: e.target.value } : r))
                        )
                      }
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label="Remove row"
                      disabled={expenseRows.length === 1}
                      onClick={() =>
                        setExpenseRows((rows) => rows.filter((r) => r.id !== row.id))
                      }
                      className="w-7 h-9 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-soft)",
                        background: "var(--surface)",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setExpenseRows((rows) => [...rows, newExpenseRow()])
                }
                className="self-start inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition"
                style={{
                  color: "var(--accent)",
                  border: "1px dashed var(--accent)",
                  background: "transparent",
                }}
              >
                <span className="text-sm leading-none">+</span>
                Add more
              </button>
            </>
          )}
        </form>

        {/* Footer */}
        <footer
          className="px-6 py-4 flex items-center justify-end gap-2"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          <button type="button" className="ui-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="ui-btn ui-btn-primary"
            onClick={handleSubmit}
            disabled={saving || saved}
          >
            {saved ? "Saved" : saving ? "Saving…" : verb}
          </button>
        </footer>
      </aside>

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(16px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="text-[11px] font-medium uppercase tracking-[0.12em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
        {required ? <span style={{ color: "var(--accent)" }}> *</span> : null}
      </span>
      {children}
    </label>
  );
}
