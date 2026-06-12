import Link from "next/link";
import { PROPERTY_FALLBACK_IMAGE } from "@/data/rentalData";

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  house: "House",
  condo: "Condo",
  apartment: "Apartment",
  townhouse: "Townhouse",
  commercial: "Commercial",
  other: "Property",
};

// A room entry either navigates (href, real public pages) or, inside the admin
// preview modal, switches the previewed room in place (onClick).
export type PublicGalleryRoomLink = { name: string; href?: string; onClick?: () => void };

/**
 * Mobile-first public listing page. Pure presentational — renders ONLY the safe
 * fields it is handed (name, location, photos, basic specs). It never receives,
 * and so can never leak, revenue / expense / tenant / occupancy data.
 */
export function PublicGallery({
  title,
  subtitle,
  location,
  propertyType,
  description,
  photos,
  rooms,
  whatsAppHref,
  backHref,
  embedded,
}: {
  title: string;
  subtitle?: string;
  location: string;
  propertyType?: string;
  description?: string;
  photos: string[];
  rooms?: PublicGalleryRoomLink[];
  whatsAppHref: string;
  backHref?: { href?: string; label: string; onClick?: () => void };
  /** When true (admin preview), the page lays out inside a scroll container and
   *  the WhatsApp CTA is sticky instead of viewport-fixed, so it stays within
   *  the phone frame. Real public pages use the default viewport-fixed bar. */
  embedded?: boolean;
}) {
  const hero = photos[0] || PROPERTY_FALLBACK_IMAGE;
  const rest = photos.slice(1);
  const typeLabel = propertyType
    ? PROPERTY_TYPE_LABEL[propertyType] ?? PROPERTY_TYPE_LABEL.other
    : undefined;

  return (
    <main
      className={embedded ? "min-h-full pb-4" : "min-h-screen pb-28"}
      style={{ background: "var(--background)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:py-8 flex flex-col gap-5">
        {backHref && (
          backHref.onClick ? (
            <button
              type="button"
              onClick={backHref.onClick}
              className="inline-flex items-center gap-1.5 text-sm w-fit"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              {backHref.label}
            </button>
          ) : (
            <Link
              href={backHref.href ?? "#"}
              className="inline-flex items-center gap-1.5 text-sm w-fit"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              {backHref.label}
            </Link>
          )
        )}

        {/* Hero */}
        <div
          className="relative w-full overflow-hidden rounded-2xl"
          style={{ background: "var(--surface-subtle)", aspectRatio: "4 / 3" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt={title} className="w-full h-full object-cover" />
        </div>

        {/* Title block */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {typeLabel && <span className="ui-chip">{typeLabel}</span>}
            {subtitle && <span className="ui-chip ui-chip-success">{subtitle}</span>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {title}
          </h1>
          {location && (
            <p className="inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              {location}
            </p>
          )}
        </div>

        {description && (
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
        )}

        {/* Room list (room-rental property page only) */}
        {rooms && rooms.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
              Rooms
            </h2>
            <div className="flex flex-col gap-2">
              {rooms.map((r) => {
                const inner = (
                  <>
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{r.name}</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-faint)" }}><path d="m9 18 6-6-6-6" /></svg>
                  </>
                );
                const cls = "ui-card flex items-center justify-between gap-3 px-4 py-3 transition hover:shadow-md text-left w-full";
                return r.onClick ? (
                  <button key={r.name} type="button" onClick={r.onClick} className={cls}>
                    {inner}
                  </button>
                ) : (
                  <Link key={r.name} href={r.href ?? "#"} className={cls}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Photo grid */}
        {rest.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {rest.map((src, i) => (
              <div
                key={src + i}
                className="relative w-full overflow-hidden rounded-xl"
                style={{ background: "var(--surface-subtle)", aspectRatio: "1 / 1" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${title} photo ${i + 2}`} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky WhatsApp CTA — primary path, matches where customers come from. */}
      <div
        className={(embedded ? "sticky" : "fixed inset-x-0") + " bottom-0 px-4 py-3"}
        style={{
          background: "color-mix(in srgb, var(--background) 88%, transparent)",
          borderTop: "1px solid var(--border-soft)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="mx-auto w-full max-w-2xl">
          <a
            href={whatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl font-semibold text-white"
            style={{ background: "#25D366" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
            Contact on WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
