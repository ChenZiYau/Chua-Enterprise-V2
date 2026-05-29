"use client";

import { useCallback, useEffect, useState } from "react";
import { PropertyForm, type PropertyFormValues } from "./PropertyForm";
import type { Property } from "@/types/rental";

const FORM_ID = "property-edit-form";

type View = "normal" | "expanded" | "minimized";

export function PropertyEditDrawer({
  open,
  onClose,
  property,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  property: Property | null;
  onSave: (values: PropertyFormValues) => void;
}) {
  const [view, setView] = useState<View>("normal");
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Reset transient state each time the drawer opens (or target property changes).
  useEffect(() => {
    if (open) {
      setView("normal");
      setDirty(false);
      setConfirmOpen(false);
    }
  }, [open, property?.id]);

  // Attempt to close — guard unsaved changes with the center confirm dialog.
  const attemptClose = useCallback(() => {
    if (dirty) {
      setConfirmOpen(true);
    } else {
      onClose();
    }
  }, [dirty, onClose]);

  // Lock body scroll only while the drawer is visible and not minimized.
  useEffect(() => {
    if (!open || view === "minimized") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, view]);

  // Escape closes the confirm dialog first, then attempts to close the drawer.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmOpen) {
        setConfirmOpen(false);
      } else if (view !== "minimized") {
        attemptClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirmOpen, view, attemptClose]);

  if (!open || !property) return null;

  // ── Minimized: a compact floating bar; the page behind stays interactive ──
  if (view === "minimized") {
    return (
      <div
        className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-soft)",
          boxShadow: "0 8px 32px rgba(15,17,22,0.16)",
          animation: "peSlideUp 200ms cubic-bezier(.2,.7,.2,1)",
          maxWidth: "min(92vw, 340px)",
        }}
      >
        <div className="min-w-0">
          <p
            className="text-[10px] uppercase tracking-[0.16em]"
            style={{ color: "var(--text-faint)" }}
          >
            Editing{dirty ? " · unsaved" : ""}
          </p>
          <p
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {property.name}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setView("normal")}
            className="ui-btn"
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
          >
            Restore
          </button>
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Close editor"
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border-soft)" }}
          >
            <CloseIcon />
          </button>
        </div>

        {confirmOpen && (
          <ConfirmDialog
            dirty={dirty}
            formId={FORM_ID}
            onDiscard={() => {
              setConfirmOpen(false);
              onClose();
            }}
            onCancel={() => setConfirmOpen(false)}
          />
        )}
        <DrawerKeyframes />
      </div>
    );
  }

  const widthClass = view === "expanded" ? "max-w-3xl" : "max-w-md";

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close editor"
        onClick={attemptClose}
        className="absolute inset-0"
        style={{ background: "rgba(15,17,22,0.40)", animation: "peFadeIn 140ms ease" }}
      />

      {/* Right-side panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-edit-title"
        className={`relative ml-auto h-full w-full ${widthClass} flex flex-col`}
        style={{
          background: "var(--surface)",
          borderLeft: "1px solid var(--border-soft)",
          boxShadow: "-8px 0 32px rgba(15,17,22,0.10)",
          animation: "peSlideIn 220ms cubic-bezier(.2,.7,.2,1)",
        }}
      >
        {/* Header */}
        <header
          className="px-6 py-5 flex items-start justify-between gap-4"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div className="min-w-0">
            <p
              className="text-[10px] uppercase tracking-[0.16em]"
              style={{ color: "var(--text-faint)" }}
            >
              Edit property{dirty ? " · unsaved changes" : ""}
            </p>
            <h2
              id="property-edit-title"
              className="text-lg font-semibold mt-1 truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {property.name}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <IconBtn
              label="Minimize"
              onClick={() => setView("minimized")}
            >
              <MinimizeIcon />
            </IconBtn>
            <IconBtn
              label={view === "expanded" ? "Collapse" : "Expand"}
              onClick={() => setView(view === "expanded" ? "normal" : "expanded")}
            >
              {view === "expanded" ? <CollapseIcon /> : <ExpandIcon />}
            </IconBtn>
            <IconBtn label="Close" onClick={attemptClose}>
              <CloseIcon />
            </IconBtn>
          </div>
        </header>

        {/* Body — the existing property form, footer handled by the drawer */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <PropertyForm
            id={FORM_ID}
            initial={property}
            submitLabel="Save Changes"
            hideFooter
            onDirtyChange={setDirty}
            onSubmit={onSave}
          />
        </div>

        {/* Footer */}
        <footer
          className="px-6 py-4 flex items-center justify-end gap-2"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          <button type="button" className="ui-btn" onClick={attemptClose}>
            {dirty ? "Discard" : "Close"}
          </button>
          <button
            type="submit"
            form={FORM_ID}
            className="ui-btn ui-btn-primary"
            disabled={!dirty}
            style={{ opacity: dirty ? 1 : 0.55 }}
          >
            Save Changes
          </button>
        </footer>
      </aside>

      {/* Center confirm dialog — discard or save unsaved changes */}
      {confirmOpen && (
        <ConfirmDialog
          dirty={dirty}
          formId={FORM_ID}
          onDiscard={() => {
            setConfirmOpen(false);
            onClose();
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      <DrawerKeyframes />
    </div>
  );
}

// ── Center modal asking the user to discard or save ──
function ConfirmDialog({
  dirty,
  formId,
  onDiscard,
  onCancel,
}: {
  dirty: boolean;
  formId: string;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Keep editing"
        onClick={onCancel}
        className="absolute inset-0"
        style={{ background: "rgba(15,17,22,0.48)", animation: "peFadeIn 120ms ease" }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-title"
        className="relative w-full max-w-sm rounded-2xl p-6"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-soft)",
          boxShadow: "0 24px 64px rgba(15,17,22,0.24)",
          animation: "pePop 160ms cubic-bezier(.2,.7,.2,1)",
        }}
      >
        <h3
          id="discard-title"
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Unsaved changes
        </h3>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          You have unsaved changes to this property. Would you like to save them or
          discard and close?
        </p>
        <div className="flex items-center justify-end gap-2 mt-6">
          <button type="button" className="ui-btn" onClick={onCancel}>
            Keep editing
          </button>
          <button
            type="button"
            className="ui-btn"
            onClick={onDiscard}
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
          >
            Discard
          </button>
          <button
            type="submit"
            form={formId}
            className="ui-btn ui-btn-primary"
            disabled={!dirty}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-8 h-8 rounded-md flex items-center justify-center"
      style={{
        color: "var(--text-muted)",
        border: "1px solid var(--border-soft)",
        background: "var(--surface)",
      }}
    >
      {children}
    </button>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );
}

function DrawerKeyframes() {
  return (
    <style jsx global>{`
      @keyframes peSlideIn { from { transform: translateX(16px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes peSlideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes peFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes pePop { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `}</style>
  );
}
