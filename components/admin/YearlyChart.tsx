"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChartPoint, ChartResult, RangeType } from "@/lib/revenueChart";
import { DatePickerField } from "@/components/ui/DatePicker";

// Big virtual canvas so SVG content scales down in real layouts.
const WIDTH = 1200;
const HEIGHT = 320;
const PADDING = { top: 24, right: 28, bottom: 40, left: 56 };
const INNER_W = WIDTH - PADDING.left - PADDING.right;
const INNER_H = HEIGHT - PADDING.top - PADDING.bottom;

const ACCENT = "var(--accent)";

const RANGE_OPTIONS: { value: RangeType; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "3months", label: "3 Months" },
  { value: "6months", label: "6 Months" },
  { value: "12months", label: "12 Months" },
  { value: "custom", label: "Custom" },
];

function formatMYR(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

function compactMYR(n: number) {
  if (n >= 1000) return `RM ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `RM ${Math.round(n)}`;
}

function formatDateSpan(start: string, end: string) {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" }).format(d);
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

// Friendly label for the subtitle: preset names for the quick ranges, and a
// compact year span (or date span) for custom ranges.
function rangeLabel(rangeType: RangeType, start: string, end: string) {
  switch (rangeType) {
    case "monthly":
      return "This Month";
    case "3months":
      return "Last 3 Months";
    case "6months":
      return "Last 6 Months";
    case "12months":
      return "Last 12 Months";
    default: {
      const sy = start.slice(0, 4);
      const ey = end.slice(0, 4);
      return sy !== ey ? `${sy} – ${ey}` : formatDateSpan(start, end);
    }
  }
}

// Straight-segment (linear) line. Accurate by construction: it cannot overshoot
// below 0, sits cleanly on the baseline at 0, and handles sharp drops without a
// fake negative dip. Rounded stroke joins keep it feeling polished, not jagged.
function linearPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
}

function defaultCustom(): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const past = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  return { start: past.toISOString().slice(0, 10), end };
}

export function YearlyChart() {
  const [rangeType, setRangeType] = useState<RangeType>("12months");
  const [custom, setCustom] = useState(defaultCustom);
  const [appliedCustom, setAppliedCustom] = useState<{ start: string; end: string } | null>(null);

  const [result, setResult] = useState<ChartResult | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [hover, setHover] = useState<number | null>(null);

  // Guard against out-of-order responses when filters change quickly.
  const reqId = useRef(0);

  const fetchChart = useCallback(
    async (type: RangeType, range: { start: string; end: string } | null) => {
      const id = ++reqId.current;
      setStatus("loading");
      try {
        const params = new URLSearchParams({ rangeType: type });
        if (type === "custom" && range) {
          params.set("startDate", range.start);
          params.set("endDate", range.end);
        }
        const res = await fetch(`/api/revenue/chart?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        const data = (await res.json()) as ChartResult;
        if (id !== reqId.current) return; // a newer request superseded this one
        setResult(data);
        setStatus("ready");
      } catch (e) {
        if (id !== reqId.current) return;
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    },
    []
  );

  useEffect(() => {
    if (rangeType === "custom") {
      if (appliedCustom) fetchChart("custom", appliedCustom);
    } else {
      fetchChart(rangeType, null);
    }
  }, [rangeType, appliedCustom, fetchChart]);

  function selectRange(type: RangeType) {
    setHover(null);
    setRangeType(type);
  }

  function applyCustom() {
    if (!custom.start || !custom.end || custom.start > custom.end) return;
    setHover(null);
    setAppliedCustom({ ...custom });
  }

  const points = result?.data ?? [];

  const max = useMemo(() => {
    const m = Math.max(1, ...points.map((p) => p.value));
    // Round up to a clean tick value so YAxis top has headroom.
    const mag = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / mag) * mag;
  }, [points]);

  const xFor = useCallback(
    (i: number) => {
      if (points.length <= 1) return PADDING.left + INNER_W / 2;
      return PADDING.left + (i / (points.length - 1)) * INNER_W;
    },
    [points.length]
  );
  const yFor = useCallback((v: number) => PADDING.top + INNER_H - (v / max) * INNER_H, [max]);

  const svgPoints = useMemo(
    () => points.map((p, i) => ({ x: xFor(i), y: yFor(p.value), v: p.value, i })),
    [points, xFor, yFor]
  );

  const linePath = useMemo(() => linearPath(svgPoints), [svgPoints]);
  const areaPath = useMemo(() => {
    if (svgPoints.length < 2) return "";
    const baseY = PADDING.top + INNER_H;
    return `${linePath} L ${svgPoints[svgPoints.length - 1].x},${baseY} L ${svgPoints[0].x},${baseY} Z`;
  }, [linePath, svgPoints]);

  const yTicks = useMemo(() => {
    const count = 4;
    return Array.from({ length: count + 1 }, (_, k) => Math.round((max / count) * k));
  }, [max]);

  // Thin x-axis labels so they never overlap on long ranges.
  const labelStep = Math.max(1, Math.ceil(points.length / 12));

  const hasData = points.some((p) => p.value > 0);

  return (
    <section className="ui-card p-6 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 24%, transparent), transparent 70%)",
          filter: "blur(20px)",
          opacity: 0.6,
        }}
      />

      <div className="relative flex items-start justify-between gap-x-6 gap-y-4 mb-5 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
            Revenue overview
          </p>
          <h2 className="text-lg font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
            Revenue
          </h2>
          <div className="flex items-baseline gap-2 mt-3 min-h-[28px]">
            <span className="inline-block w-1.5 h-4 rounded-sm" style={{ background: ACCENT }} />
            <span className="text-base font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {status === "loading" || !result ? "—" : compactMYR(result.totalRevenue)}
            </span>
            {result && status === "ready" ? (
              <span className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                · {rangeLabel(result.rangeType, result.startDate, result.endDate)}
              </span>
            ) : null}
          </div>
        </div>

        {/* Range controls: tabs + (optional) custom inputs, top-right on desktop */}
        <div className="flex flex-col items-stretch sm:items-end gap-2.5">
          <div
            className="inline-flex p-0.5 rounded-lg flex-wrap self-start sm:self-end"
            style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}
          >
            {RANGE_OPTIONS.map((opt) => {
              const active = rangeType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectRange(opt.value)}
                  className="px-3 py-1 text-[11px] font-medium rounded-md transition"
                  style={{
                    background: active ? "var(--surface)" : "transparent",
                    color: active ? "var(--text-primary)" : "var(--text-muted)",
                    boxShadow: active ? "var(--shadow-xs)" : "none",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {rangeType === "custom" ? (
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                  Start date
                </span>
                <DatePickerField
                  className="w-[160px]"
                  value={custom.start}
                  max={custom.end || undefined}
                  onChange={(v) => setCustom((c) => ({ ...c, start: v }))}
                  ariaLabel="Custom range start date"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                  End date
                </span>
                <DatePickerField
                  className="w-[160px]"
                  value={custom.end}
                  min={custom.start || undefined}
                  onChange={(v) => setCustom((c) => ({ ...c, end: v }))}
                  ariaLabel="Custom range end date"
                />
              </div>
              <button
                type="button"
                onClick={applyCustom}
                disabled={!custom.start || !custom.end || custom.start > custom.end}
                className="px-4 py-1.5 text-xs font-medium rounded-md transition disabled:opacity-50"
                style={{ background: ACCENT, color: "var(--accent-contrast, #fff)" }}
              >
                Apply
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Chart area with loading / empty / error states */}
      <div className="relative w-full" style={{ minHeight: 240, overflow: "visible" }}>
        {status === "loading" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div
              className="w-7 h-7 rounded-full animate-spin"
              style={{ border: "2.5px solid var(--border-soft)", borderTopColor: ACCENT }}
            />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Loading revenue data…
            </p>
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>
              Unable to load revenue data. Please try again.
            </p>
            <p className="text-[11px] max-w-md" style={{ color: "var(--text-faint)" }}>
              {errorMsg}
            </p>
            <button
              type="button"
              onClick={() =>
                rangeType === "custom"
                  ? appliedCustom && fetchChart("custom", appliedCustom)
                  : fetchChart(rangeType, null)
              }
              className="px-3 py-1.5 text-xs font-medium rounded-md"
              style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", color: "var(--text-primary)" }}
            >
              Retry
            </button>
          </div>
        ) : rangeType === "custom" && !appliedCustom ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Pick a start and end date, then press Apply.
            </p>
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No revenue data found for the selected period.
            </p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-auto"
            style={{ display: "block" }}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="rev-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.38" />
                <stop offset="60%" stopColor={ACCENT} stopOpacity="0.08" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </linearGradient>
              <filter id="rev-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Y-axis ticks + gridlines (domain fixed at 0 -> max) */}
            {yTicks.map((t) => {
              const y = yFor(t);
              return (
                <g key={t}>
                  <line
                    x1={PADDING.left}
                    x2={PADDING.left + INNER_W}
                    y1={y}
                    y2={y}
                    stroke="var(--border-soft)"
                    strokeDasharray="2 5"
                  />
                  <text x={PADDING.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)">
                    {compactMYR(t)}
                  </text>
                </g>
              );
            })}

            {/* Hover column highlight */}
            {hover !== null ? (
              <line
                x1={xFor(hover)}
                x2={xFor(hover)}
                y1={PADDING.top}
                y2={PADDING.top + INNER_H}
                stroke="var(--border-strong)"
                strokeDasharray="3 4"
                style={{ pointerEvents: "none" }}
              />
            ) : null}

            {/* Area + line */}
            {areaPath ? <path d={areaPath} fill="url(#rev-area)" /> : null}
            <path
              d={linePath}
              fill="none"
              stroke={ACCENT}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#rev-glow)"
            />

            {/* Column hit-areas for hover */}
            {svgPoints.map((p) => {
              const colW = points.length > 1 ? INNER_W / (points.length - 1) : INNER_W;
              return (
                <rect
                  key={`hit-${p.i}`}
                  x={p.x - colW / 2}
                  y={PADDING.top}
                  width={colW}
                  height={INNER_H}
                  fill="transparent"
                  onMouseEnter={() => setHover(p.i)}
                  style={{ cursor: "crosshair" }}
                />
              );
            })}

            {/* Dots */}
            {svgPoints.map((p) => {
              const isHover = hover === p.i;
              const showDot = points.length <= 24 || isHover;
              if (!showDot) return null;
              return (
                <g key={`dot-${p.i}`} style={{ pointerEvents: "none" }}>
                  {isHover ? <circle cx={p.x} cy={p.y} r={11} fill={ACCENT} opacity={0.18} /> : null}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHover ? 5.5 : 3.5}
                    fill="var(--surface)"
                    stroke={ACCENT}
                    strokeWidth="2"
                  />
                </g>
              );
            })}

            {/* X-axis labels (thinned to avoid overlap) */}
            {points.map((p, i) => {
              if (i % labelStep !== 0 && i !== points.length - 1) return null;
              const isHover = hover === i;
              return (
                <text
                  key={`lbl-${i}`}
                  x={xFor(i)}
                  y={HEIGHT - 14}
                  textAnchor="middle"
                  fontSize="13"
                  fill={isHover ? "var(--text-primary)" : "var(--text-faint)"}
                  fontWeight={isHover ? 600 : 400}
                >
                  {p.label}
                </text>
              );
            })}

            {/* Tooltip */}
            {hover !== null && points[hover] ? (() => {
              const tooltipW = 168;
              const tooltipH = 50;
              const x = xFor(hover);
              const tx = Math.min(Math.max(x - tooltipW / 2, PADDING.left), PADDING.left + INNER_W - tooltipW);
              const ty = Math.max(PADDING.top + 6, 18);
              return (
                <g transform={`translate(${tx}, ${ty})`} style={{ pointerEvents: "none" }}>
                  <rect
                    width={tooltipW}
                    height={tooltipH}
                    rx={10}
                    fill="var(--surface)"
                    stroke="var(--border-strong)"
                    strokeWidth="1"
                    style={{ filter: "drop-shadow(0 8px 22px rgba(15,17,22,0.18))" }}
                  />
                  <text x={14} y={20} fontSize="11" fill="var(--text-muted)" fontWeight={500}>
                    {points[hover].label}
                  </text>
                  <text x={14} y={40} fontSize="14" fontWeight={700} fill="var(--text-primary)">
                    {formatMYR(points[hover].value)}
                  </text>
                </g>
              );
            })() : null}
          </svg>
        )}
      </div>
    </section>
  );
}
