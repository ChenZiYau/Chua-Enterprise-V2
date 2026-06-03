// Shared date helpers. Always use the real current date so urgent /
// overdue logic stays correct over time (no hard-coded "today").

/** Local-time ISO date string (YYYY-MM-DD) for the given date (default: now). */
export function todayIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Midnight Date for an ISO date string. Falls back to today on bad input. */
export function startOfDay(iso: string): Date {
  const d = new Date(`${iso || todayIso()}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date(`${todayIso()}T00:00:00`) : d;
}

/** ISO date `days` after `iso` (days clamped to >= 0). */
export function addDays(iso: string, days: number): string {
  const d = startOfDay(iso || todayIso());
  d.setDate(d.getDate() + Math.max(days, 0));
  return todayIso(d);
}

/** Whole days between two ISO dates (>= 0). */
export function daysBetween(start: string, end: string): number {
  const s = startOfDay(start || todayIso()).getTime();
  const e = startOfDay(end || start || todayIso()).getTime();
  return Math.max(Math.round((e - s) / 86_400_000), 0);
}

/** ISO date `days` before today. */
export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return todayIso(d);
}

export function formatDate(value: string): string {
  if (!value) return "-";
  const d = startOfDay(value);
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
