"use client";

import { useEffect, useMemo, useState } from "react";
import type { Property, Unit } from "@/types/rental";
import {
  buildWhatsAppUrl,
  splitGalleryUrls,
  WHATSAPP_NUMBER,
} from "@/lib/share";
import { PublicGallery } from "@/components/share/PublicGallery";

/**
 * In-dashboard preview of the public share page. Renders the real PublicGallery
 * inside a phone-sized frame (these links open in WhatsApp's in-app browser),
 * so the user sees exactly what a customer sees — without leaving the dashboard.
 * Rooms can be switched in place to preview each room's gallery.
 */
export function SharePreviewModal({
  open,
  onClose,
  property,
  units,
  eyebrow,
  confirmLabel,
  onConfirm,
  confirming,
  confirmError,
  backLabel = "Back / edit",
}: {
  open: boolean;
  onClose: () => void;
  property: Property;
  units: Unit[];
  /** Toolbar eyebrow label (defaults to "Preview"). */
  eyebrow?: string;
  /** When set, an action bar with a primary confirm button is shown. */
  confirmLabel?: string;
  onConfirm?: () => void | Promise<void>;
  confirming?: boolean;
  confirmError?: string | null;
  backLabel?: string;
}) {
  const [roomId, setRoomId] = useState<string | null>(null);

  // Reset to the property view each time the modal opens.
  useEffect(() => {
    if (open) setRoomId(null);
  }, [open, property.id]);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const isRoom = property.rental_model === "room_rental";
  const rooms = useMemo(
    () => units.slice().sort((a, b) => a.sort_order - b.sort_order),
    [units],
  );
  const propertyPhotos = useMemo(
    () => splitGalleryUrls(property.image_url, property.gallery_urls),
    [property.image_url, property.gallery_urls],
  );

  if (!open) return null;

  const location = [property.city, property.state].filter(Boolean).join(", ");
  const activeRoom = roomId ? rooms.find((u) => u.id === roomId) ?? null : null;

  const roomPhotos = activeRoom ? splitGalleryUrls(activeRoom.gallery_urls) : [];
  const photos = activeRoom
    ? roomPhotos.length
      ? roomPhotos
      : propertyPhotos
    : propertyPhotos;

  const whatsAppHref = buildWhatsAppUrl(
    WHATSAPP_NUMBER,
    activeRoom
      ? `Hi, I'm interested in ${property.name} ${activeRoom.name}`
      : `Hi, I'm interested in ${property.name}`,
  );

  const galleryRooms =
    isRoom && !activeRoom
      ? rooms.map((u) => ({ name: u.name, onClick: () => setRoomId(u.id) }))
      : undefined;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: "rgba(15,17,22,0.55)", animation: "spvFade 140ms ease" }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share page preview"
        className="relative flex flex-col items-center gap-3"
        style={{ animation: "spvPop 180ms cubic-bezier(.2,.7,.2,1)" }}
      >
        {/* Toolbar above the phone frame */}
        <div className="flex items-center justify-between gap-3 w-full max-w-[390px]">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.6)" }}>
              {eyebrow ?? "Preview"}
            </p>
            <p className="text-sm font-semibold truncate" style={{ color: "#fff" }}>
              {activeRoom ? `${property.name} · ${activeRoom.name}` : property.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition"
            style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.06)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Phone frame — ~390px wide (iPhone), scrollable content */}
        <div
          className="overflow-hidden rounded-[2.2rem]"
          style={{
            width: "min(390px, 92vw)",
            height: "min(780px, 80vh)",
            border: "10px solid #0b0d12",
            boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
            background: "var(--background)",
          }}
        >
          <div className="w-full h-full overflow-y-auto">
            <PublicGallery
              embedded
              title={activeRoom ? activeRoom.name : property.name}
              subtitle={activeRoom ? property.name : undefined}
              location={location}
              propertyType={property.property_type}
              description={activeRoom ? undefined : property.description ?? undefined}
              photos={photos}
              rooms={galleryRooms}
              whatsAppHref={whatsAppHref}
              backHref={activeRoom ? { label: property.name, onClick: () => setRoomId(null) } : undefined}
            />
          </div>
        </div>

        {/* Confirmation action bar (Add-property flow) */}
        {onConfirm && (
          <div className="flex flex-col items-stretch gap-2 w-full max-w-[390px]">
            {confirmError && (
              <p className="text-xs text-center" style={{ color: "#ff9b9b" }}>
                {confirmError}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={confirming}
                className="ui-btn"
                style={{ color: "#fff", borderColor: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.06)" }}
              >
                {backLabel}
              </button>
              <button
                type="button"
                onClick={() => onConfirm()}
                disabled={confirming}
                className="ui-btn ui-btn-primary"
              >
                {confirming ? "Saving…" : confirmLabel ?? "Confirm & save"}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spvFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spvPop { from { transform: scale(.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
