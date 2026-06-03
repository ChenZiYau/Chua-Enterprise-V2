"use client";

import { useEffect, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { MONTHS } from "@/types/rental";

type MonthCellState = "paid" | "unpaid" | "future";

export function RoomCalendarDrawer({
  open,
  onClose,
  propertyName,
  roomLabel,
  unitId,
  onLogMonth,
}: {
  open: boolean;
  onClose: () => void;
  propertyName: string;
  roomLabel: string;
  unitId: string;
  onLogMonth?: (monthIndex: number, year: number) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const { getRevenueForUnit } = useRental();

  useEffect(() => {
    if (open) setYear(now.getFullYear());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setYear((y) => y - 1);
      if (e.key === "ArrowRight") setYear((y) => y + 1);
    }
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

  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth(); // 0-based

  const yearRevenue = getRevenueForUnit(unitId, year);
  const revenueByMonth: Record<number, number> = {};
  yearRevenue.forEach((e) => { revenueByMonth[e.month] = e.total_amount; });

  function fmt(v: number) {
    return new Intl.NumberFormat("en-MY", {
      style: "currency", currency: "MYR", maximumFractionDigits: 0,
    }).format(v);
  }

  function cellState(i: number): MonthCellState {
    const isFuture = year > thisYear || (year === thisYear && i > thisMonth);
    if (isFuture) return "future";
    return revenueByMonth[i + 1] != null ? "paid" : "unpaid";
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close calendar"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: "rgba(15,17,22,0.40)", animation: "fadeIn 140ms ease" }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-calendar-title"
        className="relative ml-auto h-full w-full max-w-lg flex flex-col"
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
            <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
              {propertyName}
            </p>
            <h2
              id="room-calendar-title"
              className="text-lg font-semibold mt-1"
              style={{ color: "var(--text-primary)" }}
            >
              {roomLabel}
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Click a month to enter or edit rent &amp; expenses.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border-soft)", background: "var(--surface)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Year switcher */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="w-9 h-9 rounded-md flex items-center justify-center"
            style={{ border: "1px solid var(--border-soft)", background: "var(--surface)", color: "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18 9 12l6-6" /></svg>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>Year</span>
            <span className="text-2xl font-semibold tabular-nums mt-0.5" style={{ color: "var(--text-primary)" }}>{year}</span>
          </div>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="w-9 h-9 rounded-md flex items-center justify-center"
            style={{ border: "1px solid var(--border-soft)", background: "var(--surface)", color: "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        </div>

        {/* Month grid */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-3 gap-3">
            {MONTHS.map((label, i) => {
              const state = cellState(i);
              const isCurrent = year === thisYear && i === thisMonth;
              const disabled = state === "future";
              const paidAmount = revenueByMonth[i + 1];

              return (
                <button
                  key={label}
                  type="button"
                  disabled={disabled}
                  onClick={() => onLogMonth?.(i, year)}
                  className="aspect-[5/4] rounded-xl flex flex-col items-start justify-between p-3 text-left transition group"
                  style={{
                    border: `1px solid ${
                      state === "paid"
                        ? "var(--success)"
                        : isCurrent
                        ? "var(--accent)"
                        : "var(--border-soft)"
                    }`,
                    background:
                      state === "paid"
                        ? "rgba(47,158,111,0.09)"
                        : isCurrent
                        ? "var(--accent-soft)"
                        : disabled
                        ? "var(--surface-muted)"
                        : "var(--surface)",
                    opacity: disabled ? 0.45 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                    boxShadow: isCurrent ? "0 0 0 3px var(--accent-ring)" : "none",
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {label}
                    </span>
                    {state === "paid" ? (
                      <span style={{ color: "var(--success)", fontSize: "0.85rem" }}>&#10003;</span>
                    ) : isCurrent ? (
                      <span
                        className="text-[9px] uppercase tracking-[0.12em] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: "var(--accent)", color: "#fff" }}
                      >
                        Now
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-start gap-0.5 w-full">
                    {state === "paid" && paidAmount != null ? (
                      <span className="text-xs font-semibold" style={{ color: "var(--success)" }}>
                        {fmt(paidAmount)}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>
                        {disabled ? "Upcoming" : "No entry"}
                      </span>
                    )}
                    {!disabled && state !== "paid" && (
                      <span
                        className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--accent)" }}
                      >
                        + Log rent
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-6 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <LegendDot color="var(--success)" label="Collected" />
            <LegendDot color="var(--accent)" label="Current month" />
            <LegendDot color="var(--border-strong)" label="No entry" />
            <LegendDot color="var(--surface-subtle)" label="Upcoming" />
          </div>
        </div>

        {/* Footer */}
        <footer
          className="px-6 py-4 flex items-center justify-between gap-2"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>&#8592; &#8594; to switch year</p>
          <button type="button" className="ui-btn" onClick={onClose}>Close</button>
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color, border: "1px solid var(--border-soft)" }} />
      {label}
    </span>
  );
}
