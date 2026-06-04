// Pure, reusable revenue-chart logic: resolve a date range, pick a sensible
// grouping granularity, and bucket real revenue records into chart-ready points.
// No Notion / network code here so it stays easy to test and reuse.

import { todayIso } from "@/lib/date";

export type RangeType = "monthly" | "3months" | "6months" | "12months" | "custom";
export type GroupBy = "day" | "week" | "month" | "year";

export type ChartPoint = { label: string; value: number };

export type ChartResult = {
  rangeType: RangeType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalRevenue: number;
  currency: "RM";
  groupBy: GroupBy;
  data: ChartPoint[];
};

// Minimal shape we need from a revenue record. Matches RevenueRow in lib/notion.
export type RevenueLike = {
  totalAmount: number;
  paymentDate?: string;
  year?: number;
  month?: number;
  paymentStatus?: string;
};

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Statuses that should never count as realised revenue.
const INVALID_STATUS = new Set([
  "cancelled", "canceled", "void", "draft", "invalid", "rejected",
]);

const DAY_MS = 86_400_000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoOf(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Resolve a revenue record to the Date that should place it on the timeline. */
export function revenueDate(r: RevenueLike): Date | null {
  if (r.paymentDate) {
    const d = new Date(r.paymentDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (r.year && r.month) {
    const d = new Date(r.year, r.month - 1, 1);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function isValidRevenue(r: RevenueLike): boolean {
  const status = (r.paymentStatus ?? "").toLowerCase().trim();
  if (INVALID_STATUS.has(status)) return false;
  return (r.totalAmount ?? 0) > 0;
}

/**
 * Resolve the [start, end] window for a range type. Presets are anchored to the
 * real current date so the chart never trails off into empty future months.
 */
export function resolveRange(
  rangeType: RangeType,
  startDate?: string,
  endDate?: string
): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (rangeType === "custom") {
    const s = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const e = endDate ? new Date(`${endDate}T23:59:59`) : null;
    if (s && e && !Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s <= e) {
      return { start: s, end: e };
    }
    // Fall back to a 12-month window if custom dates are missing/invalid.
    const fallback = new Date(end);
    fallback.setMonth(fallback.getMonth() - 12);
    return { start: fallback, end };
  }

  if (rangeType === "monthly") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
  }

  const months = rangeType === "3months" ? 3 : rangeType === "6months" ? 6 : 12;
  const start = new Date(end);
  start.setMonth(start.getMonth() - months);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/** Choose a grouping granularity that keeps the chart readable (<= ~36 points). */
export function pickGroupBy(start: Date, end: Date): GroupBy {
  const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  if (spanDays <= 31) return "day";
  if (spanDays <= 92) return "week";
  if (spanDays <= 1100) return "month"; // up to ~3 years -> monthly
  return "year";
}

function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  return x;
}

/** Build the ordered, gap-free list of buckets covering [start, end]. */
function buildBuckets(start: Date, end: Date, groupBy: GroupBy, multiYear: boolean) {
  const buckets: { key: string; label: string }[] = [];

  if (groupBy === "day") {
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cur <= end) {
      buckets.push({ key: isoOf(cur), label: `${cur.getDate()} ${MONTHS_SHORT[cur.getMonth()]}` });
      cur.setDate(cur.getDate() + 1);
    }
  } else if (groupBy === "week") {
    const cur = mondayOf(start);
    while (cur <= end) {
      buckets.push({ key: isoOf(cur), label: `${cur.getDate()} ${MONTHS_SHORT[cur.getMonth()]}` });
      cur.setDate(cur.getDate() + 7);
    }
  } else if (groupBy === "month") {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= last) {
      const label = multiYear
        ? `${MONTHS_SHORT[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`
        : MONTHS_SHORT[cur.getMonth()];
      buckets.push({ key: `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}`, label });
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      buckets.push({ key: String(y), label: String(y) });
    }
  }

  return buckets;
}

/** Compute the bucket key for a given date under the chosen granularity. */
function keyForDate(d: Date, groupBy: GroupBy): string {
  if (groupBy === "day") return isoOf(d);
  if (groupBy === "week") return isoOf(mondayOf(d));
  if (groupBy === "month") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return String(d.getFullYear());
}

/**
 * Bucket real revenue records into chart-ready points for the given window.
 * Only valid records whose date falls inside [start, end] are counted.
 */
export function groupRevenue(
  records: RevenueLike[],
  rangeType: RangeType,
  start: Date,
  end: Date
): ChartResult {
  const groupBy = pickGroupBy(start, end);
  const multiYear = start.getFullYear() !== end.getFullYear();
  const buckets = buildBuckets(start, end, groupBy, multiYear);

  const totals = new Map<string, number>();
  for (const b of buckets) totals.set(b.key, 0);

  let totalRevenue = 0;
  for (const r of records) {
    if (!isValidRevenue(r)) continue;
    const d = revenueDate(r);
    if (!d || d < start || d > end) continue;
    const key = keyForDate(d, groupBy);
    if (!totals.has(key)) continue; // outside the generated buckets
    totals.set(key, (totals.get(key) ?? 0) + r.totalAmount);
    totalRevenue += r.totalAmount;
  }

  return {
    rangeType,
    startDate: isoOf(start),
    endDate: isoOf(end),
    totalRevenue,
    currency: "RM",
    groupBy,
    data: buckets.map((b) => ({ label: b.label, value: totals.get(b.key) ?? 0 })),
  };
}

/** End-to-end helper used by the API route. */
export function buildRevenueChart(
  records: RevenueLike[],
  rangeType: RangeType,
  startDate?: string,
  endDate?: string
): ChartResult {
  const { start, end } = resolveRange(rangeType, startDate, endDate);
  return groupRevenue(records, rangeType, start, end);
}

export { todayIso };
