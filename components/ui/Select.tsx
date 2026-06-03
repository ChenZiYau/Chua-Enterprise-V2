"use client";

import { useEffect, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

/** Custom dropdown matching the Maintenance page styling, so dropdowns look
 *  consistent across the app instead of falling back to native <select>. */
export function Select({
  value,
  options,
  onChange,
  placeholder = "Select...",
  className = "",
  ariaLabel,
  disabled = false,
  invalid = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const display = selected?.label || placeholder;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, Math.max(options.length - 1, 0)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      }
      if (e.key === "Enter" && options[activeIndex]) {
        e.preventDefault();
        onChange(options[activeIndex].value);
        setOpen(false);
      }
    }
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, options, activeIndex, onChange]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = Math.max(options.findIndex((o) => o.value === value), 0);
    setActiveIndex(selectedIndex);
  }, [open, options, value]);

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full px-3.5 py-2.5 rounded-[10px] border text-left text-sm flex items-center justify-between gap-3 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => !disabled && setOpen((c) => !c)}
        style={{
          background: "var(--surface)",
          borderColor: invalid ? "var(--danger)" : open ? "var(--accent)" : "var(--border-soft)",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
          boxShadow: open ? "0 0 0 3px var(--accent-ring)" : undefined,
        }}
      >
        <span className="truncate">{display}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 transition-transform"
          style={{ color: "var(--text-faint)", transform: open ? "rotate(180deg)" : "none" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[70] overflow-hidden rounded-[12px] border"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border-soft)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
          }}
        >
          <div className="max-h-56 overflow-y-auto py-1" role="listbox">
            {options.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: "var(--text-faint)" }}>
                No options available
              </div>
            ) : (
              options.map((option, index) => {
                const active = option.value === value;
                const highlighted = index === activeIndex;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className="w-full px-4 py-2.5 text-left text-sm transition"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={{
                      background: active ? "var(--accent-soft)" : highlighted ? "var(--surface-muted)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text-primary)",
                    }}
                    onMouseMove={() => setActiveIndex(index)}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = "var(--surface-muted)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {option.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
