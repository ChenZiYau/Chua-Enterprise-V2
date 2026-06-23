// Pure share-link helpers — safe to import from BOTH client and server.
// Contains NO server-only imports. This is the single source of truth
// for public share URLs so a future phase can add tokens / expiry / click
// tracking (e.g. `?t=<token>`) in ONE place without touching every component.

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/** Stable, readable slug for a room/unit, derived from its name (falling back
 *  to label). Room names are unique within a property, so this is collision-free
 *  per property. Both the admin Share card and the public page compute it the
 *  same way, so generated links always resolve. */
export function roomSlug(unit: { name?: string | null; label?: string | null }): string {
  const base = (unit.name || unit.label || "").toString();
  return slugify(base) || "room";
}

/** Parse one or more newline/comma-separated URL strings into a deduped list,
 *  preserving order (hero image first). Shared by the admin preview and the
 *  server-side public listing so both show the same photos. */
export function splitGalleryUrls(...sources: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const src of sources) {
    if (!src) continue;
    for (const part of src.split(/[\n,]+/)) {
      const url = part.trim();
      if (url && !out.includes(url)) out.push(url);
    }
  }
  return out;
}

export type ShareUrlProperty = { slug: string };
export type ShareUrlRoom = { slug: string };

/**
 * Build a public gallery URL for a property, or a specific room within it.
 *
 * @param property  object carrying the property's public slug
 * @param room      optional room (already carrying its room slug)
 * @param origin    optional absolute origin (e.g. window.location.origin). When
 *                  omitted a root-relative path is returned.
 *
 * Future: token-based / trackable links can be added here (append `?t=…`)
 * without changing any call site.
 */
export function buildShareUrl(
  property: ShareUrlProperty,
  room?: ShareUrlRoom | null,
  origin?: string,
): string {
  const path = room
    ? `/share/${property.slug}/${room.slug}`
    : `/share/${property.slug}`;
  if (!origin) return path;
  return `${origin.replace(/\/$/, "")}${path}`;
}

/** Build a wa.me click-to-chat URL with a prefilled message. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const num = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

/** The business WhatsApp number (digits, international format, no +). Set via
 *  NEXT_PUBLIC_WHATSAPP_NUMBER; falls back to a placeholder so the base build
 *  works before it's configured. */
export const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^0-9]/g, "") || "60123456789";
