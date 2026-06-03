"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive action. */
  danger?: boolean;
  /** Optional free-text note collected from the user (e.g. completion note). */
  withNote?: boolean;
  notePlaceholder?: string;
  noteLabel?: string;
};

type ConfirmResult = { confirmed: boolean; note: string };

type ConfirmContextValue = (options: ConfirmOptions) => Promise<ConfirmResult>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [note, setNote] = useState("");
  const resolver = useRef<((r: ConfirmResult) => void) | null>(null);

  const confirm = useCallback<ConfirmContextValue>((opts) => {
    setNote("");
    setOptions(opts);
    return new Promise<ConfirmResult>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback(
    (confirmed: boolean) => {
      resolver.current?.({ confirmed, note: note.trim() });
      resolver.current = null;
      setOptions(null);
    },
    [note]
  );

  useEffect(() => {
    if (!options) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter" && !options?.withNote) close(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={options.cancelLabel ?? "Cancel"}
            onClick={() => close(false)}
            className="absolute inset-0"
            style={{ background: "rgba(15,17,22,0.48)", animation: "cdFadeIn 120ms ease" }}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            className="relative w-full max-w-sm rounded-2xl p-6"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-soft)",
              boxShadow: "0 24px 64px rgba(15,17,22,0.24)",
              animation: "cdPop 160ms cubic-bezier(.2,.7,.2,1)",
            }}
          >
            <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {options.title}
            </h3>
            {options.message && (
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {options.message}
              </p>
            )}
            {options.withNote && (
              <div className="mt-4">
                {options.noteLabel && (
                  <label
                    className="block text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {options.noteLabel}
                  </label>
                )}
                <textarea
                  autoFocus
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={options.notePlaceholder ?? "Add a note (optional)…"}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none resize-none transition focus:border-[var(--accent)]"
                  style={{
                    borderColor: "var(--border-soft)",
                    background: "var(--surface-muted)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            )}
            <div className="flex items-center justify-end gap-2 mt-6">
              <button type="button" className="ui-btn" onClick={() => close(false)}>
                {options.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                className={options.danger ? "ui-btn" : "ui-btn ui-btn-primary"}
                onClick={() => close(true)}
                style={
                  options.danger
                    ? { color: "#fff", background: "var(--danger)", borderColor: "var(--danger)" }
                    : undefined
                }
              >
                {options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
          <style jsx global>{`
            @keyframes cdFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes cdPop { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          `}</style>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx;
}
