// Shared helpers for the Revenue / Expenses ledger views (admin pages and the
// property-detail tabs).

import type { PaymentStatus } from "@/types/rental";

/** Parse a "YYYY-MM-DD" input into a comparable YYYYMMDD number, or null. */
export function parseDayInput(s: string): number | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return y * 10000 + m * 100 + d;
}

/** Day key for an entry: its date when present, else the 1st of its year/month. */
export function entryDayKey(year: number, month: number, isoDate?: string | null): number {
  if (isoDate) {
    const k = parseDayInput(isoDate);
    if (k != null) return k;
  }
  return year * 10000 + month * 100 + 1;
}

export function fmtMYR(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, { bg: string; text: string }> = {
  paid: { bg: "rgba(47,158,111,0.10)", text: "var(--success)" },
  partial: { bg: "rgba(224,162,61,0.10)", text: "var(--warning)" },
  pending: { bg: "rgba(224,162,61,0.10)", text: "var(--warning)" },
  overdue: { bg: "rgba(211,84,84,0.10)", text: "var(--danger)" },
};
