"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { RevenueEntryForm } from "@/components/property/RevenueEntryForm";
import { ExpenseEntryForm } from "@/components/property/ExpenseEntryForm";
import { MONTHS } from "@/types/rental";

type Tab = "revenue" | "expense";

const labelStyle: React.CSSProperties = { color: "var(--text-faint)" };

/**
 * Quick Entry popup, opened from a property's Revenue / Expenses cards.
 * Mirrors the /admin/entry page layout but locks the property to `propertyId`
 * and opens on the tab matching the card that was clicked.
 */
export function QuickEntryModal({
  open,
  onClose,
  propertyId,
  initialTab = "revenue",
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  initialTab?: Tab;
}) {
  const { getUnitsForProperty, getProperty, getRevenueForUnit, getExpensesForProperty, tenants } = useRental();
  const confirm = useConfirm();

  const [tab, setTab] = useState<Tab>(initialTab);
  // Whether the active form has unsaved input (drives the discard guard).
  const [dirty, setDirty] = useState(false);
  const [unitId, setUnitId] = useState("");
  // Billing period the entry is recorded against (chosen via the month grid).
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const monthIdx = month - 1;

  const property = propertyId ? getProperty(propertyId) : undefined;
  const units = useMemo(
    () => (propertyId ? getUnitsForProperty(propertyId) : []),
    [propertyId, getUnitsForProperty]
  );
  const isRoomBased = property?.rental_model === "room_rental";
  const selectedUnit = units.find((u) => u.id === unitId);

  // Tenant move-in period (lease start) for the selected unit, if known. Months
  // before this are excluded from the billing grid (tenant wasn't here yet).
  const moveIn = useMemo<{ year: number; month: number } | null>(() => {
    const lease = tenants.find((t) => t.unit_id === unitId)?.lease_start;
    if (!lease) return null;
    const d = new Date(lease);
    if (Number.isNaN(d.getTime())) return null;
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [tenants, unitId]);

  // Revenue entries for the selected unit in the displayed year — drives the
  // green (paid) / yellow (unpaid) colouring of the billing-month grid.
  const yearEntries = useMemo(
    () => (unitId ? getRevenueForUnit(unitId, year) : []),
    [unitId, year, getRevenueForUnit]
  );

  // Expense entries for the property in the displayed year — drives the
  // green (all fixed) / yellow (outstanding) / neutral (none) colouring.
  const yearExpenses = useMemo(
    () => (propertyId ? getExpensesForProperty(propertyId, year) : []),
    [propertyId, year, getExpensesForProperty]
  );

  // Reset to the requested tab / first room each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setDirty(false);
    setUnitId(getUnitsForProperty(propertyId)[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, propertyId, initialTab]);

  // Billing month always defaults to the CURRENT month and year — for both
  // Revenue and Expense — whenever the modal opens or the room/tab changes.
  // (Paid/unpaid months are still colour-coded; the user can click an earlier
  // month to record against it.)
  useEffect(() => {
    if (!open) return;
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unitId, tab]);

  // Guarded close: confirm before discarding unsaved entry input.
  const requestClose = useCallback(async () => {
    if (dirty) {
      const { confirmed } = await confirm({
        title: "Discard changes?",
        message: "You have unsaved entry details. Discard them and close?",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      });
      if (!confirmed) return;
    }
    onClose();
  }, [dirty, confirm, onClose]);

  // Keep the selected room valid for this property (default = first room).
  useEffect(() => {
    if (!units.find((u) => u.id === unitId)) setUnitId(units[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units]);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, requestClose]);

  if (!open) return null;

  const showRoomTabs = isRoomBased && units.length > 1;
  // Let the form's "Saved" banner show briefly before the modal closes.
  const handleSaved = () => setTimeout(onClose, 700);

  // Revenue / Expense selector — stacked vertically at the top of the left
  // column (above the billing-month grid), per the design.
  const tabToggle = (
    <div className="flex flex-col gap-1.5">
      {(["revenue", "expense"] as Tab[]).map((t) => {
        const active = tab === t;
        const accent = t === "revenue" ? "var(--accent)" : "var(--danger)";
        return (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setDirty(false); }}
            aria-pressed={active}
            className="py-1.5 rounded-lg text-sm font-semibold capitalize transition"
            style={{
              background: active ? accent : "var(--surface-muted)",
              color: active ? "#fff" : "var(--text-secondary)",
              border: `1px solid ${active ? accent : "var(--border-soft)"}`,
              boxShadow: active ? "0 1px 3px rgba(15,17,22,0.18)" : "none",
            }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );

  // Left-panel: two DETACHED cards — the Revenue/Expense toggle in its own box,
  // and the Billing month picker in a separate box below it. The grid defaults
  // to the oldest unpaid month; paid months show green, due-but-unpaid show
  // yellow, future/pre-move-in months stay neutral.
  const datePanel = (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl p-1.5" style={{ border: "1px solid var(--border-soft)" }}>
        {tabToggle}
      </div>
      <div className="rounded-xl p-2.5" style={{ border: "1px solid var(--border-soft)" }}>
        <MonthGrid
          year={year}
          month={month}
          onYear={setYear}
          onSelect={setMonth}
          mode={tab}
          entries={tab === "revenue" ? yearEntries : []}
          expenseEntries={tab === "expense" ? yearExpenses : []}
          moveIn={tab === "revenue" ? moveIn : null}
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        className="absolute inset-0"
        style={{ background: "rgba(15,17,22,0.40)", animation: "qeFadeIn 140ms ease" }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-entry-modal-title"
        className="relative w-full max-w-5xl h-[88vh] max-h-[840px] flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-soft)",
          boxShadow: "0 24px 64px rgba(15,17,22,0.24)",
          animation: "qePop 180ms cubic-bezier(.2,.7,.2,1)",
        }}
      >
        {/* Header - stays fixed while the body scrolls. Quick Entry + date sit
            top-left; the property name and tenant are centered. */}
        <div
          className="flex items-start gap-4 px-6 py-5 shrink-0"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div className="min-w-0 shrink-0 w-32">
            <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>Quick Entry</p>
            <span className="text-[11px] tabular-nums" style={{ color: "var(--text-faint)" }}>
              {now.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <div className="flex-1 min-w-0 text-center">
            <h1 id="quick-entry-modal-title" className="text-xl font-semibold tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
              {property?.name ?? "Property"}
            </h1>
            <p className="text-sm mt-1 truncate" style={{ color: "var(--text-muted)" }}>
              {tab === "revenue" && selectedUnit
                ? selectedUnit.tenant_name || "Vacant"
                : `Record ${tab === "revenue" ? "revenue" : "an expense"}`}
            </p>
          </div>
          <div className="w-32 shrink-0 flex justify-end">
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition hover:bg-[var(--surface-muted)]"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border-soft)", background: "var(--surface)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Body — the Revenue/Expense toggle now lives in the form's left
            column (see datePanel). The form owns the split layout and its own
            sticky footer; only the form's right column scrolls. */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Form fills remaining height. Room tabs (room rental) render at the
              top of the form's right column via contextSlot. */}
          <div className="flex-1 min-h-0 flex" style={{ borderTop: "1px solid var(--border-soft)" }}>
            {!property ? (
              <p className="text-sm text-center w-full py-8" style={{ color: "var(--text-muted)" }}>
                Property not found.
              </p>
            ) : tab === "revenue" ? (
              <RevenueEntryForm
                key={`${propertyId}:${unitId}`}
                propertyId={propertyId}
                unitId={unitId}
                year={year}
                month={monthIdx + 1}
                onSaved={handleSaved}
                onDirtyChange={setDirty}
                datePanel={datePanel}
                contextSlot={showRoomTabs ? <RoomTabs units={units} unitId={unitId} onSelect={setUnitId} /> : undefined}
              />
            ) : (
              <ExpenseEntryForm
                key={propertyId}
                propertyId={propertyId}
                year={year}
                month={monthIdx + 1}
                onSaved={handleSaved}
                onDirtyChange={setDirty}
                datePanel={datePanel}
              />
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes qeFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes qePop { from { transform: scale(.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}

/** Month picker grid — Jan–Jun in the left column, Jul–Dec in the right
 *  (column-major), with a year stepper above. The selected month is accent-
 *  ringed; paid months are green, unpaid months (from move-in onward) are
 *  yellow, and pre-move-in months are dimmed. */
function MonthGrid({
  year,
  month,
  onYear,
  onSelect,
  mode = "revenue",
  entries = [],
  expenseEntries = [],
  moveIn = null,
}: {
  year: number;
  month: number;
  onYear: (y: number) => void;
  onSelect: (m: number) => void;
  /** Revenue vs expense colouring scheme. */
  mode?: "revenue" | "expense";
  /** Revenue entries for this unit in `year`, for paid/unpaid colouring. */
  entries?: { month: number; payment_status: string }[];
  /** Expense entries for this property in `year`, for fixed/unfixed colouring. */
  expenseEntries?: { month: number; is_fixed?: boolean }[];
  /** Tenant move-in period; months before it are dimmed (excluded). */
  moveIn?: { year: number; month: number } | null;
}) {
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={labelStyle}>
        Billing month
      </p>
      {/* Year stepper */}
      <div className="flex items-center justify-between rounded-lg px-2 py-1" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
        <button type="button" aria-label="Previous year" onClick={() => onYear(year - 1)} className="w-6 h-6 rounded-md inline-flex items-center justify-center transition hover:bg-[var(--surface-subtle)]" style={{ color: "var(--text-muted)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{year}</span>
        <button type="button" aria-label="Next year" onClick={() => onYear(year + 1)} className="w-6 h-6 rounded-md inline-flex items-center justify-center transition hover:bg-[var(--surface-subtle)]" style={{ color: "var(--text-muted)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
      {/* Column-major grid: 6 rows × 2 cols → Jan–Jun | Jul–Dec */}
      <div className="grid grid-rows-6 grid-flow-col gap-1">
        {MONTHS.map((label, i) => {
          const m = i + 1;
          const active = m === month;

          let bg = "var(--surface-muted)";
          let color = "var(--text-secondary)";
          let border = "var(--border-soft)";
          let dimmed = false;

          if (mode === "expense") {
            // Expense colouring: no expense → neutral; any unfixed → yellow;
            // all fixed → green. (Maintenance must be fixed to turn green.)
            const monthExp = expenseEntries.filter((e) => e.month === m);
            if (monthExp.length > 0) {
              const allFixed = monthExp.every((e) => e.is_fixed);
              if (allFixed) {
                bg = "rgba(47,158,111,0.14)"; color = "var(--success)"; border = "var(--success)";
              } else {
                bg = "rgba(224,162,61,0.16)"; color = "var(--warning)"; border = "var(--warning)";
              }
            }
          } else {
            // Revenue colouring: green (paid) / yellow (unpaid & due) / neutral
            // (future or pre-move-in). Only past-or-current unpaid show yellow.
            const entry = entries.find((e) => e.month === m);
            const paid = entry?.payment_status === "paid";
            const excluded = moveIn
              ? year < moveIn.year || (year === moveIn.year && m < moveIn.month)
              : false;
            const future = year > nowYear || (year === nowYear && m > nowMonth);
            dimmed = excluded;
            if (excluded) {
              bg = "var(--surface-subtle)"; color = "var(--text-faint)";
            } else if (paid) {
              bg = "rgba(47,158,111,0.14)"; color = "var(--success)"; border = "var(--success)";
            } else if (!future) {
              bg = "rgba(224,162,61,0.16)"; color = "var(--warning)"; border = "var(--warning)";
            }
          }

          // The selected month is filled accent and ringed regardless of status.
          if (active) {
            bg = "var(--accent)";
            color = "#fff";
            border = "var(--accent)";
          }

          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(m)}
              aria-pressed={active}
              className="py-1 rounded-md text-xs font-medium transition"
              style={{
                background: bg,
                color,
                border: `1px solid ${border}`,
                boxShadow: active ? "0 0 0 2px var(--accent-soft)" : "none",
                opacity: dimmed && !active ? 0.6 : 1,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Horizontal room tabs for room-based properties — the selected room drives
 *  the tenant name and charges. */
function RoomTabs({
  units,
  unitId,
  onSelect,
}: {
  units: ReturnType<typeof useRental>["units"];
  unitId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {units.map((u) => {
        const active = u.id === unitId;
        return (
          <button
            key={u.id}
            type="button"
            onClick={() => onSelect(u.id)}
            aria-pressed={active}
            className="px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{
              background: active ? "var(--accent-soft)" : "var(--surface-muted)",
              color: active ? "var(--accent)" : "var(--text-secondary)",
              border: `1px solid ${active ? "var(--accent)" : "var(--border-soft)"}`,
            }}
          >
            {u.name}
          </button>
        );
      })}
    </div>
  );
}
