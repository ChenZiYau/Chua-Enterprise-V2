"use client";

import { useMemo, useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DATA: Record<number, number[]> = {
  2025: [3200, 3450, 3380, 3700, 4100, 3950, 4280, 4450, 4520, 4810, 4960, 5120],
  2026: [4300, 4550, 4280, 4920, 5180, 4870, 5510, 5630, 5290, 5980, 5740, 6120],
};

type Series = {
  year: number;
  stroke: string;     // line color
  glow: string;       // for filter
  gradientId: string; // id for area fill
};

const SERIES: Series[] = [
  { year: 2025, stroke: "var(--accent)", glow: "var(--accent)",  gradientId: "area-2025" },
  { year: 2026, stroke: "#c98a2b",       glow: "#c98a2b",         gradientId: "area-2026" },
];

// Big virtual canvas so SVG content scales down in real layouts.
const WIDTH = 1200;
const HEIGHT = 320;
const PADDING = { top: 24, right: 28, bottom: 40, left: 56 };
const INNER_W = WIDTH - PADDING.left - PADDING.right;
const INNER_H = HEIGHT - PADDING.top - PADDING.bottom;

function formatMYR(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

function compactMYR(n: number) {
  if (n >= 1000) return `RM ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `RM ${n}`;
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  const d: string[] = [`M ${points[0].x},${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`);
  }
  return d.join(" ");
}

type Filter = "all" | 2025 | 2026;

export function YearlyChart() {
  const [filter, setFilter] = useState<Filter>("all");
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? SERIES : SERIES.filter((s) => s.year === filter)),
    [filter]
  );

  const max = useMemo(() => {
    const all = visible.flatMap((s) => DATA[s.year]);
    const m = Math.max(1, ...all);
    return Math.ceil(m / 1000) * 1000; // round to nearest 1000 for clean gridlines
  }, [visible]);

  const min = 0;

  function xFor(i: number) {
    return PADDING.left + (i / (MONTHS.length - 1)) * INNER_W;
  }
  function yFor(v: number) {
    return PADDING.top + INNER_H - ((v - min) / (max - min)) * INNER_H;
  }

  function toPoints(values: number[]) {
    return values.map((v, i) => ({ x: xFor(i), y: yFor(v), v, i }));
  }

  // Discrete y-axis ticks
  const yTicks = useMemo(() => {
    const count = 4;
    return Array.from({ length: count + 1 }, (_, k) => Math.round((max / count) * k));
  }, [max]);

  // Totals for the header
  const totals = useMemo(() => {
    return visible.map((s) => ({
      year: s.year,
      total: DATA[s.year].reduce((a, b) => a + b, 0),
      color: s.stroke,
    }));
  }, [visible]);

  return (
    <section className="ui-card p-6 relative overflow-hidden">
      {/* Decorative tinted glow in the background */}
      <div
        aria-hidden
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 24%, transparent), transparent 70%)",
          filter: "blur(20px)",
          opacity: 0.6,
        }}
      />

      <div className="relative flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
            Yearly overview
          </p>
          <h2 className="text-lg font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
            Monthly revenue
          </h2>
          <div className="flex flex-wrap gap-4 mt-3">
            {totals.map((t) => (
              <div key={t.year} className="flex items-baseline gap-2">
                <span
                  className="inline-block w-1.5 h-4 rounded-sm"
                  style={{ background: t.color }}
                />
                <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {t.year}
                </span>
                <span
                  className="text-base font-semibold tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {compactMYR(t.total)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Year filter */}
        <div
          className="inline-flex p-0.5 rounded-lg"
          style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}
        >
          {(["all", 2025, 2026] as Filter[]).map((f) => {
            const active = filter === f;
            return (
              <button
                key={String(f)}
                type="button"
                onClick={() => setFilter(f)}
                className="px-3 py-1 text-[11px] font-medium rounded-md transition tabular-nums"
                style={{
                  background: active ? "var(--surface)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  boxShadow: active ? "var(--shadow-xs)" : "none",
                }}
              >
                {f === "all" ? "All" : f}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative w-full" style={{ overflow: "visible" }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-auto"
          style={{ display: "block" }}
          onMouseLeave={() => setHoverMonth(null)}
        >
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={s.gradientId} id={s.gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.stroke} stopOpacity="0.38" />
                <stop offset="60%" stopColor={s.stroke} stopOpacity="0.08" />
                <stop offset="100%" stopColor={s.stroke} stopOpacity="0" />
              </linearGradient>
            ))}
            <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Y-axis ticks + gridlines */}
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
                <text
                  x={PADDING.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--text-faint)"
                >
                  {compactMYR(t)}
                </text>
              </g>
            );
          })}

          {/* Hover column highlight */}
          {hoverMonth !== null ? (
            <line
              x1={xFor(hoverMonth)}
              x2={xFor(hoverMonth)}
              y1={PADDING.top}
              y2={PADDING.top + INNER_H}
              stroke="var(--border-strong)"
              strokeDasharray="3 4"
              style={{ pointerEvents: "none" }}
            />
          ) : null}

          {/* Series */}
          {visible.map((s) => {
            const pts = toPoints(DATA[s.year]);
            const linePath = smoothPath(pts);
            const areaPath =
              linePath +
              ` L ${pts[pts.length - 1].x},${PADDING.top + INNER_H}` +
              ` L ${pts[0].x},${PADDING.top + INNER_H} Z`;
            return (
              <g key={s.year}>
                <path d={areaPath} fill={`url(#${s.gradientId})`} />
                <path
                  d={linePath}
                  fill="none"
                  stroke={s.stroke}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#line-glow)"
                  style={{
                    opacity: filter === "all" ? 0.92 : 1,
                    animation: "chartDraw 900ms cubic-bezier(.4,.0,.2,1) both",
                    strokeDasharray: 3000,
                  }}
                />
              </g>
            );
          })}

          {/* Invisible column hit-areas (full height) for stable hover */}
          {MONTHS.map((_, i) => {
            const x = xFor(i);
            const colW = INNER_W / (MONTHS.length - 1);
            return (
              <rect
                key={i}
                x={x - colW / 2}
                y={PADDING.top}
                width={colW}
                height={INNER_H}
                fill="transparent"
                onMouseEnter={() => setHoverMonth(i)}
                style={{ cursor: "crosshair" }}
              />
            );
          })}

          {/* Dots on every point */}
          {visible.map((s) => {
            const pts = toPoints(DATA[s.year]);
            return (
              <g key={`dots-${s.year}`} style={{ pointerEvents: "none" }}>
                {pts.map((p) => {
                  const isHover = hoverMonth === p.i;
                  return (
                    <g key={p.i}>
                      {isHover ? (
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={11}
                          fill={s.stroke}
                          opacity={0.18}
                        />
                      ) : null}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHover ? 5.5 : 3.5}
                        fill="var(--surface)"
                        stroke={s.stroke}
                        strokeWidth="2"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* X-axis month labels */}
          {MONTHS.map((m, i) => {
            const isHover = hoverMonth === i;
            return (
              <text
                key={m}
                x={xFor(i)}
                y={HEIGHT - 14}
                textAnchor="middle"
                fontSize="13"
                fill={isHover ? "var(--text-primary)" : "var(--text-faint)"}
                fontWeight={isHover ? 600 : 400}
              >
                {m}
              </text>
            );
          })}

          {/* Tooltip — shows all series for the hovered month */}
          {hoverMonth !== null ? (() => {
            const month = hoverMonth;
            const lines = visible.map((s) => ({
              year: s.year,
              color: s.stroke,
              value: DATA[s.year][month],
            }));
            const rowH = 22;
            const tooltipW = 168;
            const tooltipH = 28 + rowH * lines.length;
            const x = xFor(month);
            const tx = Math.min(
              Math.max(x - tooltipW / 2, PADDING.left),
              PADDING.left + INNER_W - tooltipW
            );
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
                  {MONTHS[month]}
                </text>
                {lines.map((l, i) => (
                  <g key={l.year} transform={`translate(14, ${28 + i * rowH + 12})`}>
                    <circle cx={0} cy={-3} r={3.5} fill={l.color} />
                    <text x={10} y={0} fontSize="11" fill="var(--text-muted)">
                      {l.year}
                    </text>
                    <text
                      x={tooltipW - 28}
                      y={0}
                      textAnchor="end"
                      fontSize="13"
                      fontWeight={700}
                      fill="var(--text-primary)"
                    >
                      {formatMYR(l.value)}
                    </text>
                  </g>
                ))}
              </g>
            );
          })() : null}
        </svg>
      </div>

      <style jsx>{`
        @keyframes chartDraw {
          from { stroke-dashoffset: 3000; opacity: 0; }
          to   { stroke-dashoffset: 0;    opacity: 0.92; }
        }
      `}</style>
    </section>
  );
}
