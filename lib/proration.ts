/**
 * Optional mid-month rent proration.
 *
 * Day-counting rule: the tenant is charged from their start date THROUGH the
 * end of the month, inclusive. So a tenant starting on the 15th of a 30-day
 * month is charged for 30 - 15 + 1 = 16 days.
 *
 * The number of days in the month is taken from the SELECTED month/year, so
 * February (28/29), 30-day and 31-day months are all handled correctly.
 */

export interface Proration {
  fullRent: number;
  startDay: number;
  daysInMonth: number;
  chargeableDays: number;
  proratedAmount: number;
}

/** Number of days in a 1-based month for a given year (leap-year aware). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Compute prorated rent. `startDay` is the day-of-month the tenant starts
 * (clamped into [1, daysInMonth] defensively).
 */
export function computeProration(
  fullRent: number,
  year: number,
  month: number,
  startDay: number
): Proration {
  const dim = daysInMonth(year, month);
  const day = Math.min(Math.max(Math.round(startDay), 1), dim);
  const chargeableDays = dim - day + 1;
  const proratedAmount = Math.round(fullRent * (chargeableDays / dim) * 100) / 100;
  return { fullRent, startDay: day, daysInMonth: dim, chargeableDays, proratedAmount };
}

/** Matches a leading proration note so we can rebuild it without duplicating. */
export const PRORATE_NOTE_RE = /^Prorated from \d{4}-\d{2}-\d{2}: \d+\/\d+ days\.?(?:\n|$)/;

/** Capturing variant of {@link PRORATE_NOTE_RE} used by {@link parseProrationNote}. */
const PRORATE_NOTE_CAPTURE_RE = /^Prorated from (\d{4}-\d{2}-\d{2}): (\d+)\/(\d+) days/;

/** Human-readable note appended to the entry, e.g. "Prorated from 2026-02-15: 14/28 days". */
export function prorationNote(startISO: string, chargeableDays: number, dim: number): string {
  return `Prorated from ${startISO}: ${chargeableDays}/${dim} days`;
}

/**
 * Read a leading proration note back into its parts so a saved (prorated)
 * entry can be made editable again. Returns null when there is no note or it
 * is malformed (so callers fall back to plain non-prorated behaviour).
 */
export function parseProrationNote(
  notes: string
): { startISO: string; chargeableDays: number; daysInMonth: number } | null {
  if (!notes) return null;
  const m = PRORATE_NOTE_CAPTURE_RE.exec(notes);
  if (!m) return null;
  const startISO = m[1];
  const chargeableDays = Number(m[2]);
  const dim = Number(m[3]);
  if (!Number.isFinite(chargeableDays) || !Number.isFinite(dim)) return null;
  if (chargeableDays <= 0 || dim <= 0) return null;
  return { startISO, chargeableDays, daysInMonth: dim };
}

/** Remove a leading proration note line, leaving only the user's free-text. */
export function stripProrationNote(notes: string): string {
  return notes.replace(PRORATE_NOTE_RE, "").trim();
}

/**
 * Combine the user's free-text notes with the proration note. Any existing
 * proration prefix is ALWAYS stripped from the base first, so:
 *  - re-saving with prorate ON never stacks duplicate notes, and
 *  - re-saving with prorate OFF removes a previously-saved stale note.
 * For brand-new (never-prorated) notes the strip is a no-op, keeping the
 * non-prorated path byte-identical.
 */
export function composeProratedNotes(
  userNotes: string,
  prorate: boolean,
  note: string | null
): string | null {
  const base = stripProrationNote(userNotes);
  if (!prorate || !note) return base || null;
  return base ? `${note}\n${base}` : note;
}
