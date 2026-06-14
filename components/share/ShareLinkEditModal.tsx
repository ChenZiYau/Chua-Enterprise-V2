"use client";

import { useMemo, useState } from "react";
import type { Property } from "@/types/rental";
import { useRental } from "@/context/RentalContext";
import { buildShareUrl } from "@/lib/share";
import { EditModalShell } from "@/components/ui/EditModalShell";

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * Edit the share link for one property. The owner pastes their OWN external
 * link (e.g. a Dropbox / Google Drive photo folder); the Share page then copies
 * that. Leaving it empty falls back to the app-generated /share/<slug> gallery
 * URL, so nothing breaks for properties without a pasted link. Saves only
 * `share_url` via updateProperty.
 */
export function ShareLinkEditModal({
  open,
  onClose,
  property,
  origin,
}: {
  open: boolean;
  onClose: () => void;
  property: Property;
  /** Absolute origin for the generated-link fallback preview. */
  origin?: string;
}) {
  const { updateProperty } = useRental();
  const [raw, setRaw] = useState(property.share_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = raw.trim();
  const generatedUrl = buildShareUrl({ slug: property.slug }, null, origin);

  // Empty is allowed (use the generated link). A non-empty value must look like
  // a full web link so the copied URL actually opens for the recipient.
  const validationError = useMemo(() => {
    if (!trimmed) return null;
    return /^https?:\/\/.+/i.test(trimmed)
      ? null
      : "Enter a full link starting with http:// or https://";
  }, [trimmed]);

  // What the Copy button on the card will hand out after saving.
  const effectiveUrl = trimmed || generatedUrl;
  const dirty = trimmed !== (property.share_url ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProperty(property.id, { share_url: trimmed || null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the share link.");
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
      eyebrow="Edit share link"
      title={property.name}
      subtitle="Paste the link you want to share for this property"
      dirty={dirty}
      saving={saving}
      primaryFormId="share-link-form"
      primaryLabel="Save Link"
      primaryDisabled={!!validationError}
    >
      <form id="share-link-form" onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
        {/* Pasteable external link */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>
            Custom link
          </span>
          <input
            className={inputCls}
            style={validationError ? { ...inputStyle, borderColor: "var(--danger)" } : inputStyle}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="https://www.dropbox.com/scl/fo/…"
            aria-label="Custom share link"
            autoFocus
          />
          <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            Paste any link — a Dropbox or Google Drive folder, a website, etc.
          </span>
        </label>

        {/* What the Copy button will copy */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>
            Copy button will copy
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
            ? "This pasted link is what gets shared and copied."
            : "No custom link set — the Share page will use the app's built-in gallery link above. Paste a link to override it."}
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
