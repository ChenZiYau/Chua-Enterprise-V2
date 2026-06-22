"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type RowAction = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

/** Kebab (⋮) action dropdown for a table row. Renders the menu in a
 *  fixed-position portal so a table's `overflow-x-auto` can't clip it. Closes on
 *  outside click / Esc / scroll. */
export function RowActionMenu({
  items,
  ariaLabel = "Row actions",
}: {
  items: RowAction[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  };

  useEffect(() => {
    if (!open) return;
    place();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScrollResize() {
      setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 shrink-0 rounded-lg inline-flex items-center justify-center border hover:bg-[var(--surface-muted)] transition"
        style={{ color: open ? "var(--accent)" : "var(--text-muted)", borderColor: "var(--border-soft)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[80] w-32 rounded-lg border overflow-hidden"
              style={{
                top: pos.top,
                right: pos.right,
                background: "var(--surface)",
                borderColor: "var(--border-soft)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
              }}
            >
              {items.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  onClick={run(item.onClick)}
                  className="w-full px-3 py-2 text-left text-xs transition hover:bg-[var(--surface-muted)]"
                  style={{ color: item.danger ? "var(--danger)" : "var(--text-secondary)" }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
