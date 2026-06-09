"use client";

import { useEffect, useMemo, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { RevenueEntryForm } from "@/components/property/RevenueEntryForm";
import { ExpenseEntryForm } from "@/components/property/ExpenseEntryForm";
import { Select } from "@/components/ui/Select";
import { StepDatePicker } from "@/components/ui/DatePicker";
import { MONTHS_FULL } from "@/types/rental";
import { todayIso } from "@/lib/date";

type Tab = "revenue" | "expense";

const labelCls = "block text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5";
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
  const { getUnitsForProperty, getProperty } = useRental();

  const [tab, setTab] = useState<Tab>(initialTab);
  const [unitId, setUnitId] = useState("");
  // The entry date drives the billing period (year + month) for the form.
  const [entryDate, setEntryDate] = useState(todayIso());
  const [y, m] = entryDate.split("-").map(Number);
  const year = y;
  const monthIdx = m - 1;

  const property = propertyId ? getProperty(propertyId) : undefined;
  const units = useMemo(
    () => (propertyId ? getUnitsForProperty(propertyId) : []),
    [propertyId, getUnitsForProperty]
  );
  const isRoomBased = property?.rental_model === "room_rental";

  // Reset to the requested tab / current period each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setEntryDate(todayIso());
    setUnitId(getUnitsForProperty(propertyId)[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, propertyId, initialTab]);

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
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const showRoomSelector = tab === "revenue" && isRoomBased && units.length > 1;
  // Let the form's "Saved" banner show briefly before the modal closes.
  const handleSaved = () => setTimeout(onClose, 700);

  // Left-panel date picker (the property name shows in the modal header).
  const datePanel = (
    <div className="flex flex-col gap-2">
      <label className={labelCls} style={labelStyle}>Entry date</label>
      <StepDatePicker value={entryDate} onChange={setEntryDate} granularity="day" />
      <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>
        Billing period: <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{MONTHS_FULL[monthIdx]} {year}</span>
      </p>
    </div>
  );

  // Room selector sits atop the right column for room-based revenue.
  const roomSelector = (
    <div>
      <label className={labelCls} style={labelStyle}>Room</label>
      <Select
        value={unitId}
        placeholder="Select room..."
        onChange={setUnitId}
        options={units.map((u) => ({
          value: u.id,
          label: `${u.name} - ${u.tenant_name || "Vacant"}`,
        }))}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
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
        {/* Header - stays fixed while the body scrolls */}
        <div
          className="flex items-start justify-between gap-4 px-6 py-5 shrink-0"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>Quick Entry</p>
            <h1 id="quick-entry-modal-title" className="text-xl font-semibold tracking-tight mt-1 truncate" style={{ color: "var(--text-primary)" }}>
              Record {tab === "revenue" ? "revenue" : "an expense"}
            </h1>
            <p className="text-sm mt-1 truncate" style={{ color: "var(--text-muted)" }}>
              {property?.name ?? "Property"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition hover:bg-[var(--surface-muted)]"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border-soft)", background: "var(--surface)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body — toggle (fixed) + form. The form owns the split layout and its
            own sticky footer; only the form's right column scrolls. */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Segmented toggle */}
          <div className="px-6 pt-4 pb-3 shrink-0">
            <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-xl" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
              {(["revenue", "expense"] as Tab[]).map((t) => {
                const active = tab === t;
                const accent = t === "revenue" ? "var(--accent)" : "var(--danger)";
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    aria-pressed={active}
                    className="py-2.5 rounded-lg text-sm font-semibold capitalize transition"
                    style={{
                      background: active ? accent : "transparent",
                      color: active ? "#fff" : "var(--text-secondary)",
                      boxShadow: active ? "0 1px 3px rgba(15,17,22,0.18)" : "none",
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form fills remaining height */}
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
                datePanel={datePanel}
                contextSlot={showRoomSelector ? roomSelector : null}
              />
            ) : (
              <ExpenseEntryForm
                key={propertyId}
                propertyId={propertyId}
                year={year}
                month={monthIdx + 1}
                onSaved={handleSaved}
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
