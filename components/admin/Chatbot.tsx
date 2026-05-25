"use client";

import { useEffect, useState } from "react";

const SUGGESTIONS = [
  "Show overdue invoices",
  "Which room is vacant this month?",
  "Total revenue for Menjalara",
];

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  // Esc closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-3">
      {/* Panel */}
      {open ? (
        <section
          role="dialog"
          aria-label="Assistant"
          className="w-[340px] max-w-[92vw] rounded-2xl flex flex-col overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-soft)",
            boxShadow: "0 20px 50px rgba(15,17,22,0.25)",
            animation: "chatIn 220ms cubic-bezier(.2,.7,.2,1) both",
          }}
        >
          {/* Header */}
          <header
            className="px-4 py-3 flex items-center gap-3"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, var(--surface)) 0%, var(--surface) 100%)",
              borderBottom: "1px solid var(--border-soft)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #000))",
                color: "#fff",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                Assistant
              </p>
              <p className="text-[10px] mt-0.5 inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--success)" }}
                />
                Online · Demo
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border-soft)", background: "var(--surface)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          {/* Body */}
          <div className="flex-1 px-4 py-4 flex flex-col gap-3 max-h-[360px] overflow-y-auto">
            {/* Greeting bubble */}
            <div className="flex items-start gap-2.5">
              <div
                className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-semibold"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                AI
              </div>
              <div
                className="text-xs leading-relaxed px-3 py-2.5 rounded-xl rounded-tl-sm max-w-[80%]"
                style={{
                  background: "var(--surface-muted)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-soft)",
                }}
              >
                Hi 👋 I&apos;m your property assistant. Ask me anything about rooms, revenue, or tenants.
              </div>
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-col items-start gap-2 mt-1">
              <p
                className="text-[10px] uppercase tracking-[0.14em] ml-9"
                style={{ color: "var(--text-faint)" }}
              >
                Try
              </p>
              <div className="flex flex-wrap gap-1.5 ml-9">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="text-[11px] px-2.5 py-1 rounded-full transition"
                    style={{
                      border: "1px solid var(--border-soft)",
                      background: "var(--surface)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Composer */}
          <form
            className="px-3 py-3 flex items-center gap-2"
            style={{ borderTop: "1px solid var(--border-soft)", background: "var(--surface-muted)" }}
            onSubmit={(e) => {
              e.preventDefault();
              setInput("");
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything…"
              className="flex-1 px-3 py-2 text-sm rounded-lg outline-none transition"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-soft)",
                color: "var(--text-primary)",
              }}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send"
              className="w-9 h-9 rounded-lg flex items-center justify-center transition disabled:opacity-40"
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "1px solid var(--accent)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22l-4-9-9-4z" />
              </svg>
            </button>
          </form>
        </section>
      ) : null}

      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="w-14 h-14 rounded-full flex items-center justify-center text-white transition"
        style={{
          background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 65%, #000))",
          boxShadow:
            "0 12px 28px color-mix(in srgb, var(--accent) 35%, transparent), 0 2px 6px rgba(0,0,0,0.18)",
        }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <span className="relative">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
              style={{
                background: "var(--success)",
                border: "2px solid var(--surface)",
                animation: "pulseDot 1.6s ease-in-out infinite",
              }}
            />
          </span>
        )}
      </button>

      <style jsx>{`
        @keyframes chatIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%      { transform: scale(1.3); opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}
