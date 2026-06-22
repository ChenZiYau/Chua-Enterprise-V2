"use client";

import { useCallback, useEffect } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/**
 * Shared shell for every edit/create pop-out across the dashboard. Owns the
 * backdrop, glass panel, header (eyebrow + title + unsaved indicator), footer
 * (Discard / Save), entry animation, Escape + body-scroll-lock, and the
 * unsaved-changes guard (via the shared confirm dialog).
 *
 * Placement is configurable so a right-drawer stays a drawer and a centered
 * modal stays centered — same shell, one source of truth for the look.
 */
export function EditModalShell({
  open,
  onClose,
  placement = "drawer",
  widthClass,
  eyebrow,
  title,
  subtitle,
  dirty = false,
  saving = false,
  children,
  footer,
  primaryLabel = "Save Changes",
  primaryFormId,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  suspendClose = false,
  panelAspect,
}: {
  open: boolean;
  onClose: () => void;
  placement?: "drawer" | "center";
  /** Optional CSS aspect-ratio for a centered panel, e.g. "16 / 10". */
  panelAspect?: string;
  widthClass?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Marks unsaved changes: shows the indicator and guards close. */
  dirty?: boolean;
  saving?: boolean;
  children: React.ReactNode;
  /** Replace the default footer entirely. */
  footer?: React.ReactNode;
  primaryLabel?: string;
  /** When set, the primary button submits this form (type=submit form=id). */
  primaryFormId?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  /** Suspend Esc / backdrop close (e.g. while a child preview overlay is open). */
  suspendClose?: boolean;
}) {
  const confirm = useConfirm();

  // Guarded close: confirm when there are unsaved changes.
  const requestClose = useCallback(async () => {
    if (saving || suspendClose) return;
    if (dirty) {
      const { confirmed } = await confirm({
        title: "Discard changes?",
        message: "You have unsaved changes. Discard them and close?",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      });
      if (!confirmed) return;
    }
    onClose();
  }, [confirm, dirty, saving, suspendClose, onClose]);

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes (guarded).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  if (!open) return null;

  const isDrawer = placement === "drawer";
  const width = widthClass ?? (isDrawer ? "max-w-lg" : "max-w-3xl");

  const panelClass = isDrawer
    ? `relative ml-auto h-full w-full ${width} flex flex-col @container`
    : `relative w-full ${width} max-h-[90vh] flex flex-col rounded-2xl @container`;

  const panelStyle: React.CSSProperties = isDrawer
    ? {
        background: "var(--surface)",
        borderLeft: "1px solid var(--border-soft)",
        boxShadow: "-8px 0 32px rgba(15,17,22,0.10)",
        animation: "emsSlideIn 220ms cubic-bezier(.2,.7,.2,1)",
      }
    : {
        background: "var(--surface)",
        border: "1px solid var(--border-soft)",
        boxShadow: "0 24px 64px rgba(15,17,22,0.24)",
        animation: "emsPop 180ms cubic-bezier(.2,.7,.2,1)",
        overflow: "hidden",
        // A landscape ratio keeps a wide form from feeling cramped; max-h still
        // caps it and the body scrolls when content is taller than the ratio.
        ...(panelAspect ? { aspectRatio: panelAspect } : {}),
      };

  return (
    <div className={`fixed inset-0 z-50 flex ${isDrawer ? "" : "items-center justify-center p-4 sm:p-6"}`}>
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        className="absolute inset-0"
        style={{ background: "rgba(15,17,22,0.40)", animation: "emsFadeIn 140ms ease" }}
      />

      <aside role="dialog" aria-modal="true" aria-label={title} className={panelClass} style={panelStyle}>
        {/* Header */}
        <header
          className="px-4 sm:px-6 py-4 sm:py-5 flex items-start justify-between gap-3 sm:gap-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
                {eyebrow}
                {dirty ? " · unsaved" : ""}
              </p>
            )}
            <h2 className="text-lg font-semibold mt-1 truncate" style={{ color: "var(--text-primary)" }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition hover:bg-[var(--surface-muted)]"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border-soft)", background: "var(--surface)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">{children}</div>

        {/* Footer */}
        {footer !== undefined ? (
          footer
        ) : (
          <footer
            className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 shrink-0"
            style={{ borderTop: "1px solid var(--border-soft)" }}
          >
            <button
              type="button"
              className="ui-btn justify-center"
              onClick={requestClose}
              disabled={saving}
            >
              {secondaryLabel ?? (dirty ? "Discard" : "Close")}
            </button>
            {primaryFormId ? (
              <button
                type="submit"
                form={primaryFormId}
                className="ui-btn ui-btn-primary justify-center"
                disabled={saving || primaryDisabled}
              >
                {saving ? "Saving…" : primaryLabel}
              </button>
            ) : (
              <button
                type="button"
                className="ui-btn ui-btn-primary justify-center"
                onClick={onPrimary}
                disabled={saving || primaryDisabled}
              >
                {saving ? "Saving…" : primaryLabel}
              </button>
            )}
          </footer>
        )}
      </aside>

      <style jsx global>{`
        @keyframes emsSlideIn { from { transform: translateX(16px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes emsPop { from { transform: scale(.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes emsFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
