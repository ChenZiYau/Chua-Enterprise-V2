"use client";

import { useEffect, useRef, useState } from "react";
import {
  RENTAL_MODEL_LABEL,
  STATUS_LABEL,
  type Property,
  type Unit,
} from "@/types/rental";
import { PROPERTY_FALLBACK_IMAGE } from "@/data/rentalData";
import { buildShareUrl, roomSlug } from "@/lib/share";
import { PropertyEditModal } from "@/components/property/PropertyEditModal";
import { SharePreviewModal } from "@/components/share/SharePreviewModal";
import {
  IconLink,
  IconCopy,
  IconCheck,
  IconEye,
  IconEdit,
} from "@/components/admin/icons";

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/** Copy text to the clipboard with a graceful fallback for non-secure contexts
 *  (e.g. plain-http LAN access) where navigator.clipboard is unavailable. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function statusChipClass(status: Property["status"]) {
  switch (status) {
    case "active":
      return "ui-chip-success";
    case "under_service":
      return "ui-chip-warning";
    default:
      return "";
  }
}

export function ShareCard({
  property,
  units,
}: {
  property: Property;
  units: Unit[];
}) {
  const [imgSrc, setImgSrc] = useState(property.image_url || PROPERTY_FALLBACK_IMAGE);
  const [origin, setOrigin] = useState("");
  // Which action most recently copied — drives the transient "Copied ✓" state.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve an absolute origin on the client so copied links are shareable.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Reflect cover-image edits immediately after saving.
  useEffect(() => {
    setImgSrc(property.image_url || PROPERTY_FALLBACK_IMAGE);
  }, [property.image_url]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  // Close the room menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const isWhole = property.rental_model === "whole_unit";
  const propertyUrl = buildShareUrl(property, null, origin);
  const rooms = units.slice().sort((a, b) => a.sort_order - b.sort_order);

  function flagCopied(key: string) {
    setCopiedKey(key);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedKey(null), 1500);
  }

  async function handleCopy(url: string, key: string) {
    const ok = await copyText(url || propertyUrl);
    if (ok) flagCopied(key);
  }

  return (
    <div className="ui-card relative flex flex-col overflow-hidden transition hover:shadow-md">
      <div
        className="relative h-36 w-full overflow-hidden"
        style={{ background: "var(--surface-subtle)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={property.name}
          className="w-full h-full object-cover"
          onError={() => setImgSrc(PROPERTY_FALLBACK_IMAGE)}
        />
        {/* Floating edit button — manage photos & details for this listing. */}
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          aria-label={`Edit ${property.name}`}
          title="Edit listing"
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-lg flex items-center justify-center transition"
          style={{
            background: "rgba(15,17,22,0.55)",
            color: "#fff",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <IconEdit className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="ui-chip">{RENTAL_MODEL_LABEL[property.rental_model]}</span>
          <span className={"ui-chip " + statusChipClass(property.status)}>
            {STATUS_LABEL[property.status]}
          </span>
        </div>

        <div className="min-w-0">
          <h3 className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {property.name}
          </h3>
          <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>
            {property.city}{property.state ? `, ${property.state}` : ""}
          </p>
        </div>

        {/* Share actions row — replaces the Properties card's KPI row. */}
        <div
          className="flex flex-col gap-3 pt-3 mt-auto"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          {isWhole ? (
            <div className="flex items-center gap-2">
              <PrimaryButton
                copied={copiedKey === "property"}
                label="Copy Link"
                onClick={() => handleCopy(propertyUrl, "property")}
              />
              <PreviewButton onClick={() => setPreviewOpen(true)} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <PrimaryButton
                copied={copiedKey === "property"}
                label="Copy Property Link"
                onClick={() => handleCopy(propertyUrl, "property")}
              />
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="ui-btn"
                  style={{ whiteSpace: "nowrap" }}
                >
                  Share Room…
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="shrink-0 transition-transform"
                    style={{ color: "var(--text-faint)", transform: menuOpen ? "rotate(180deg)" : "none" }}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+6px)] z-[70] w-60 overflow-hidden rounded-[12px] border"
                    style={{
                      background: "var(--surface)",
                      borderColor: "var(--border-soft)",
                      boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
                    }}
                  >
                    <div className="max-h-56 overflow-y-auto py-1">
                      {rooms.length === 0 ? (
                        <div className="px-4 py-3 text-sm" style={{ color: "var(--text-faint)" }}>
                          No rooms found.
                        </div>
                      ) : (
                        rooms.map((u) => {
                          const url = buildShareUrl(property, { slug: roomSlug(u) }, origin);
                          const key = `room:${u.id}`;
                          const justCopied = copiedKey === key;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              role="menuitem"
                              onClick={() => handleCopy(url, key)}
                              className="w-full px-4 py-2.5 text-left text-sm transition flex items-center justify-between gap-2 hover:bg-[var(--surface-muted)]"
                              style={{ color: "var(--text-primary)" }}
                            >
                              <span className="truncate">
                                {u.name}
                                <span style={{ color: "var(--text-faint)" }}>
                                  {" · "}{u.is_rented ? "Occupied" : "Vacant"}
                                </span>
                              </span>
                              {justCopied ? (
                                <IconCheck className="w-4 h-4 shrink-0" style={{ color: "var(--success)" }} />
                              ) : (
                                <IconCopy className="w-4 h-4 shrink-0" style={{ color: "var(--text-faint)" }} />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              <PreviewButton onClick={() => setPreviewOpen(true)} />
            </div>
          )}

          {/* Muted mono row — confirms exactly what gets copied. */}
          <p
            className="text-[11px] truncate"
            style={{ color: "var(--text-faint)", fontFamily: MONO }}
            title={propertyUrl}
          >
            {propertyUrl}
          </p>
        </div>
      </div>

      <SharePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        property={property}
        units={units}
      />
      <PropertyEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        property={editOpen ? property : null}
      />
    </div>
  );
}

function PrimaryButton({
  label,
  copied,
  onClick,
}: {
  label: string;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn ui-btn-primary flex-1"
      style={{ minWidth: 0 }}
    >
      {copied ? (
        <>
          <IconCheck className="w-4 h-4 shrink-0" />
          <span className="truncate">Copied ✓</span>
        </>
      ) : (
        <>
          <IconLink className="w-4 h-4 shrink-0" />
          <span className="truncate">{label}</span>
        </>
      )}
    </button>
  );
}

function PreviewButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn"
      aria-label="Preview the public page"
      title="Preview"
    >
      <IconEye className="w-4 h-4 shrink-0" />
      <span>Preview</span>
    </button>
  );
}
