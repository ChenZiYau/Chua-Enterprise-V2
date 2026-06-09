"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MONTHS, MONTHS_FULL } from "@/types/rental";

/**
 * Click-only stepped date picker. ZERO keyboard typing.
 *
 * Flow:  Year grid  ->  Month grid  ->  Day calendar  (commit on day click).
 * For `granularity="month"` the flow stops at Month (commit on month click).
 *
 * Exposes three usages from the same logic:
 *   - <StepDatePicker>     inline / panel mode (left panel of the entry screen)
 *   - <DatePickerField>    compact field that opens the picker in a popover
 *   - granularity="month"  month/year-only variant (emits "YYYY-MM")
 *
 * Value formats (unchanged from the old inputs so the backend contract holds):
 *   - granularity="day"   -> "YYYY-MM-DD"
 *   - granularity="month" -> "YYYY-MM"
 */

export type DateGranularity = "day" | "month";
type Step = "year" | "month" | "day";

const pad = (n: number) => String(n).padStart(2, "0");

function daysInMonth(year: number, month1: number) {
  return new Date(year, month1, 0).getDate(); // month1 is 1-based; day 0 => last day of prev
}

/** Parse a value into parts, falling back to today for any missing piece. */
function parseValue(value: string, granularity: DateGranularity) {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth() + 1;
  let d = now.getDate();
  if (value) {
    const parts = value.split("-").map(Number);
    if (parts[0]) y = parts[0];
    if (parts[1]) m = parts[1];
    if (granularity === "day" && parts[2]) d = parts[2];
  }
  return { y, m, d };
}

function clampDay(year: number, month1: number, day: number) {
  return Math.min(Math.max(day, 1), daysInMonth(year, month1));
}

/** Compare a y/m/d triple against an ISO boundary. Returns -1/0/1. */
function cmpToIso(y: number, m: number, d: number, iso: string): number {
  const [by, bm, bd] = iso.split("-").map(Number);
  if (y !== by) return y < by ? -1 : 1;
  if (m !== bm) return m < bm ? -1 : 1;
  if (d !== bd) return d < bd ? -1 : 1;
  return 0;
}

// ── Core stepped picker (inline / panel) ──────────────────────────────────
export function StepDatePicker({
  value,
  onChange,
  granularity = "day",
  min,
  max,
  onCommit,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  granularity?: DateGranularity;
  /** ISO bounds. For day granularity use YYYY-MM-DD. */
  min?: string;
  max?: string;
  /** Called after a value is fully committed (e.g. to close a popover). */
  onCommit?: () => void;
  className?: string;
}) {
  const initial = useMemo(() => parseValue(value, granularity), [value, granularity]);

  const [step, setStep] = useState<Step>(granularity === "month" ? "month" : "day");
  const [draftYear, setDraftYear] = useState(initial.y);
  const [draftMonth, setDraftMonth] = useState(initial.m);
  // Decade-ish window anchor for the year grid.
  const [yearAnchor, setYearAnchor] = useState(initial.y);

  // Re-sync to the incoming value when it changes externally / picker reopens.
  useEffect(() => {
    const p = parseValue(value, granularity);
    setDraftYear(p.y);
    setDraftMonth(p.m);
    setYearAnchor(p.y);
    setStep(granularity === "month" ? "month" : "day");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, granularity]);

  const hasDay = value !== "" && (granularity === "day" ? value.split("-").length === 3 : true);
  const draftDay = granularity === "day" && hasDay ? initial.d : null;

  function commitMonth(year: number, month1: number) {
    onChange(`${year}-${pad(month1)}`);
    onCommit?.();
  }
  function commitDay(year: number, month1: number, day: number) {
    onChange(`${year}-${pad(month1)}-${pad(day)}`);
    onCommit?.();
  }

  // Year window: scrollable list around the anchor (anchor ±6).
  const years = useMemo(() => {
    const span = 7;
    const start = yearAnchor - span + 1;
    return Array.from({ length: span * 2 }, (_, i) => start + i);
  }, [yearAnchor]);

  const monthDisabled = (month1: number) => {
    if (min && cmpToIso(draftYear, month1, daysInMonth(draftYear, month1), min) < 0) return true;
    if (max && cmpToIso(draftYear, month1, 1, max) > 0) return true;
    return false;
  };
  const yearDisabled = (year: number) => {
    if (min && cmpToIso(year, 12, 31, min) < 0) return true;
    if (max && cmpToIso(year, 1, 1, max) > 0) return true;
    return false;
  };
  const dayDisabled = (day: number) => {
    if (min && cmpToIso(draftYear, draftMonth, day, min) < 0) return true;
    if (max && cmpToIso(draftYear, draftMonth, day, max) > 0) return true;
    return false;
  };

  return (
    <div
      className={`flex flex-col rounded-xl overflow-hidden ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border-soft)" }}
    >
      {/* Breadcrumb header — each crumb jumps back to its step */}
      <div
        className="flex items-center gap-1.5 px-3 py-2.5 text-sm"
        style={{ borderBottom: "1px solid var(--border-soft)" }}
      >
        <Crumb label={String(draftYear)} active={step === "year"} onClick={() => setStep("year")} />
        <Sep />
        <Crumb
          label={MONTHS_FULL[draftMonth - 1]}
          active={step === "month"}
          muted={step === "year"}
          onClick={() => setStep("month")}
        />
        {granularity === "day" && (
          <>
            <Sep />
            <Crumb
              label={step === "day" && draftDay ? String(draftDay) : "—"}
              active={step === "day"}
              muted={step !== "day"}
              onClick={() => setStep("day")}
            />
          </>
        )}

        {/* Back button (hidden on the first step) */}
        {((granularity === "day" && step !== "year") || (granularity === "month" && step === "day")) && (
          <button
            type="button"
            onClick={() => setStep(step === "day" ? "month" : "year")}
            className="ml-auto inline-flex items-center gap-1 text-xs rounded-md px-2 py-1 transition hover:bg-[var(--surface-muted)]"
            style={{ color: "var(--text-muted)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Back
          </button>
        )}
      </div>

      {/* Stepped body — re-keyed per step so the entrance animation replays */}
      <div className="p-3" key={step} style={{ animation: "dpStepIn 180ms cubic-bezier(.2,.7,.2,1)" }}>
        {step === "year" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <NavBtn label="Earlier years" dir="up" onClick={() => setYearAnchor((a) => a - 12)} />
              <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
                {years[0]} – {years[years.length - 1]}
              </span>
              <NavBtn label="Later years" dir="down" onClick={() => setYearAnchor((a) => a + 12)} />
            </div>
            <div className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto">
              {years.map((y) => {
                const disabled = yearDisabled(y);
                const selected = y === draftYear;
                return (
                  <GridCell
                    key={y}
                    label={String(y)}
                    selected={selected}
                    disabled={disabled}
                    onClick={() => { setDraftYear(y); setStep("month"); }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {step === "month" && (
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((m, i) => {
              const month1 = i + 1;
              const disabled = monthDisabled(month1);
              const selected = month1 === draftMonth;
              return (
                <GridCell
                  key={m}
                  label={m}
                  selected={selected}
                  disabled={disabled}
                  onClick={() => {
                    setDraftMonth(month1);
                    if (granularity === "month") commitMonth(draftYear, month1);
                    else setStep("day");
                  }}
                />
              );
            })}
          </div>
        )}

        {step === "day" && granularity === "day" && (
          <DayGrid
            year={draftYear}
            month1={draftMonth}
            selectedDay={draftDay}
            isDisabled={dayDisabled}
            onPick={(day) => commitDay(draftYear, draftMonth, day)}
          />
        )}
      </div>

      <style jsx global>{`
        @keyframes dpStepIn {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function DayGrid({
  year,
  month1,
  selectedDay,
  isDisabled,
  onPick,
}: {
  year: number;
  month1: number;
  selectedDay: number | null;
  isDisabled: (day: number) => boolean;
  onPick: (day: number) => void;
}) {
  const total = daysInMonth(year, month1);
  const firstWeekday = new Date(year, month1 - 1, 1).getDay(); // 0=Sun
  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() + 1 === month1 && today.getDate() === d;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
          <span key={i} className="text-center text-[10px] font-semibold uppercase" style={{ color: "var(--text-faint)" }}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const disabled = isDisabled(d);
          const selected = d === selectedDay;
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => onPick(d)}
              className="aspect-square rounded-md text-sm font-medium flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: selected ? "var(--accent)" : "transparent",
                color: selected ? "#fff" : "var(--text-primary)",
                border: !selected && isToday(d) ? "1px solid var(--accent)" : "1px solid transparent",
              }}
              onMouseEnter={(e) => { if (!selected && !disabled) e.currentTarget.style.background = "var(--surface-muted)"; }}
              onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GridCell({ label, selected, disabled, onClick }: { label: string; selected: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: selected ? "var(--accent)" : "var(--surface-muted)",
        color: selected ? "#fff" : "var(--text-primary)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--border-soft)"}`,
      }}
      onMouseEnter={(e) => { if (!selected && !disabled) e.currentTarget.style.background = "var(--surface-subtle)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "var(--surface-muted)"; }}
    >
      {label}
    </button>
  );
}

function Crumb({ label, active, muted, onClick }: { label: string; active?: boolean; muted?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-semibold rounded-md px-1.5 py-0.5 transition hover:bg-[var(--surface-muted)]"
      style={{ color: active ? "var(--accent)" : muted ? "var(--text-faint)" : "var(--text-primary)" }}
    >
      {label}
    </button>
  );
}

function Sep() {
  return <span style={{ color: "var(--text-faint)" }}>›</span>;
}

function NavBtn({ label, dir, onClick }: { label: string; dir: "up" | "down"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="w-7 h-7 rounded-md flex items-center justify-center transition hover:bg-[var(--surface-muted)]"
      style={{ color: "var(--text-muted)", border: "1px solid var(--border-soft)" }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dir === "down" ? "rotate(180deg)" : "none" }}>
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  );
}

// ── Popover field (compact) ───────────────────────────────────────────────
export function DatePickerField({
  value,
  onChange,
  granularity = "day",
  min,
  max,
  placeholder = "Select date...",
  className = "",
  ariaLabel,
  disabled = false,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  granularity?: DateGranularity;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const display = useMemo(() => {
    if (!value) return placeholder;
    const { y, m, d } = parseValue(value, granularity);
    if (granularity === "month") return `${MONTHS_FULL[m - 1]} ${y}`;
    return `${pad(d)} ${MONTHS[m - 1]} ${y}`;
  }, [value, granularity, placeholder]);

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-full px-3.5 py-2.5 rounded-[10px] border text-left text-sm flex items-center justify-between gap-3 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: "var(--surface)",
          borderColor: invalid ? "var(--danger)" : open ? "var(--accent)" : "var(--border-soft)",
          color: value ? "var(--text-primary)" : "var(--text-muted)",
          boxShadow: open ? "0 0 0 3px var(--accent-ring)" : undefined,
        }}
      >
        <span className="truncate">{display}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: "var(--text-faint)" }}>
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[70] w-[280px] max-w-[88vw]" style={{ filter: "drop-shadow(0 16px 40px rgba(0,0,0,0.22))" }}>
          <StepDatePicker
            value={value}
            onChange={onChange}
            granularity={granularity}
            min={min}
            max={max}
            onCommit={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
