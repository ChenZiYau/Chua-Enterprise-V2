"use client";

import { useMemo, useState } from "react";
import type { Property, Unit } from "@/types/rental";
import { useRental } from "@/context/RentalContext";
import { buildShareUrl, roomSlug } from "@/lib/share";
import { EditModalShell } from "@/components/ui/EditModalShell";

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * Edit the share link for one ROOM. The owner pastes their own external link
 * (e.g. a Dropbox folder for that room). When empty, the room falls back to the
 * property's link if one is set, otherwise the app-generated room gallery URL.
 * Saves only `share_url` on the unit via updateUnit.
 */
export function ShareRoomLinkEditModal({
  open,
  onClose,
  property,
  unit,
  origin,
}: {
  open: boolean;
  onClose: () => void;
  property: Property;
  unit: Unit;
  /** Absolute origin for the generated-link fallback preview. */
  origin?: string;
}) {
  const { updateUnit } = useRental();
  const [raw, setRaw] = useState(unit.share_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = raw.trim();
  const generatedRoomUrl = buildShareUrl({ slug: property.slug }, { slug: roomSlug(unit) }, origin);
  // What this room copies when no per-room link is set: the property's link if
  // it has one, otherwise the generated room gallery URL.
  const fallbackUrl = property.share_url || generatedRoomUrl;

  const validationError = useMemo(() => {
    if (!trimmed) return null;
    return /^https?:\/\/.+/i.test(trimmed)
      ? null
      : "Enter a full link starting with http:// or https://";
  }, [trimmed]);

  const effectiveUrl = trimmed || fallbackUrl;
  const dirty = trimmed !== (unit.share_url ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateUnit(unit.id, { share_url: trimmed || null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the room link.");
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2 text-sm rounded-lg border outline-none transition focus:border-[var(--accent)]";
  const inputStyle: React.CSSProperties = {
    borderColor: "var(--border-soft)",
    background: "var(--surface)",
    color: "var(--text-primary)",
    fontFamily: MONO,
  };

  return (
    <EditModalShell
      open={open}
      onClose={onClose}
      placement="center"
      widthClass="max-w-lg"
      eyebrow="Edit room link"
      title={unit.name}
      subtitle={`${property.name} · paste the link to share for this room`}
      dirty={dirty}
      saving={saving}
      primaryFormId="room-link-form"
      primaryLabel="Save Link"
      primaryDisabled={!!validationError}
    >
      <form id="room-link-form" onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
        {/* Pasteable external link */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>
            Custom link for this room
          </span>
          <input
            className={inputCls}
            style={validationError ? { ...inputStyle, borderColor: "var(--danger)" } : inputStyle}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="https://www.dropbox.com/scl/fo/…"
            aria-label="Custom room share link"
            autoFocus
          />
          <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            Paste any link — a Dropbox or Google Drive folder, a website, etc.
          </span>
        </label>

        {/* What the Copy button will copy for this room */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>
            This room will copy
          </span>
          <p
            className="text-[12px] break-all rounded-lg px-3 py-2"
            style={{ color: "var(--text-primary)", fontFamily: MONO, background: "var(--surface-muted)" }}
          >
            {effectiveUrl}
          </p>
        </div>

        {/* Fallback hint */}
        <p
          className="text-[11px] rounded-lg px-3 py-2"
          style={{ color: "var(--text-muted)", background: "var(--surface-muted)" }}
        >
          {trimmed
            ? "This pasted link is what gets shared for this room."
            : property.share_url
              ? "No room link set — this room uses the property's link above. Paste a link to override it for this room only."
              : "No room link set — this room uses the app's built-in gallery link above. Paste a link to override it."}
        </p>

        {error && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </form>
    </EditModalShell>
  );
}
