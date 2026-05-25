"use client";

import { useEffect, useRef, useState } from "react";

type Payment = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  when: string;
  // animation lifecycle: 'entering' (slides in + pulses), 'live' (steady), 'leaving' (fades out)
  phase: "entering" | "live" | "leaving";
};

const SEED: Payment[] = [
  { id: "p0", name: "Steven Summer", amount: 1520, unit: "Menjalara · Room A", when: "02 min ago", phase: "live" },
  { id: "p1", name: "Jordan Maizee", amount: 830,  unit: "Paramount · Room C", when: "12 min ago", phase: "live" },
  { id: "p2", name: "Jessica Alba",  amount: 2160, unit: "Kayangan · Whole",   when: "1 hr ago",   phase: "live" },
  { id: "p3", name: "Anna Armas",    amount: 1150, unit: "Nova · Whole",       when: "today",      phase: "live" },
];

const NAMES = [
  "Aisyah Rahman", "Daniel Tan", "Priya Suresh", "Jordan Lim",
  "Marcus Wong", "Chloe Lee", "Hafiz Idris", "Vera Goh",
  "Nicholas Soh", "Tania Reyes", "Adrian Ng", "Mei Lin",
];
const UNITS = [
  "Menjalara · Room A", "Menjalara · Room C", "Menjalara · Room F",
  "Paramount · Room B", "Paramount · Master E", "Paramount · Studio",
  "Kayangan · Whole", "Nova · Whole",
];

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomAmount() {
  // skew toward common rents
  const opts = [720, 830, 850, 900, 980, 1150, 1280, 1450, 1850, 2160, 2800];
  return opts[Math.floor(Math.random() * opts.length)];
}

function formatMYR(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

const MAX_VISIBLE = 4;
const CADENCE_MS = 5200;
const ENTER_HOLD_MS = 700;
const LEAVE_FADE_MS = 600;

export function RecentPayments() {
  const [payments, setPayments] = useState<Payment[]>(SEED);
  const counter = useRef(SEED.length);

  useEffect(() => {
    let cancelled = false;

    function pushOne() {
      if (cancelled) return;

      const id = `p${counter.current++}`;
      const next: Payment = {
        id,
        name: pick(NAMES),
        amount: randomAmount(),
        unit: pick(UNITS),
        when: "just now",
        phase: "entering",
      };

      // Mark current oldest (last) as leaving if we're at capacity
      setPayments((prev) => {
        const live = prev.filter((p) => p.phase !== "leaving");
        let updated = [...prev];
        if (live.length >= MAX_VISIBLE) {
          // Mark the oldest non-leaving as leaving
          const oldest = [...live].reverse().find((p) => p.phase !== "leaving");
          if (oldest) {
            updated = updated.map((p) =>
              p.id === oldest.id ? { ...p, phase: "leaving" } : p
            );
          }
        }
        return [next, ...updated];
      });

      // Promote the new one to 'live' after the entrance animation
      setTimeout(() => {
        if (cancelled) return;
        setPayments((prev) =>
          prev.map((p) => (p.id === id ? { ...p, phase: "live" } : p))
        );
      }, ENTER_HOLD_MS);

      // Remove leaving items after their fade
      setTimeout(() => {
        if (cancelled) return;
        setPayments((prev) => prev.filter((p) => p.phase !== "leaving"));
      }, LEAVE_FADE_MS + 50);
    }

    const interval = setInterval(pushOne, CADENCE_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="ui-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Recent Payments
          </h3>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded"
            style={{ color: "var(--success)", background: "color-mix(in srgb, var(--success) 14%, transparent)" }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--success)", animation: "pulseDot 1.4s ease-in-out infinite" }}
            />
            Live
          </span>
        </div>
        <button className="text-xs font-medium" style={{ color: "var(--accent)" }}>See all</button>
      </div>

      <ul className="flex flex-col">
        {payments.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 py-2.5 px-1 rounded-md"
            style={{
              transition: "opacity 600ms ease, transform 600ms ease, background-color 700ms ease, max-height 600ms ease",
              opacity: p.phase === "leaving" ? 0 : 1,
              transform: p.phase === "leaving" ? "translateX(-6px)" : "translateX(0)",
              background:
                p.phase === "entering"
                  ? "color-mix(in srgb, var(--success) 8%, transparent)"
                  : "transparent",
              animation: p.phase === "entering" ? "slideInTop 500ms ease both" : "none",
            }}
          >
            <div
              className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold"
              style={{
                background: "linear-gradient(135deg,#dcd6c7,#b6ad99)",
                color: "#3a3a3a",
              }}
            >
              {p.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {p.name}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {p.unit} · {p.when}
              </p>
            </div>
            <span
              className="text-sm font-semibold tabular-nums shrink-0"
              style={{ color: "var(--success)" }}
            >
              +{formatMYR(p.amount)}
            </span>
          </li>
        ))}
      </ul>

      <style jsx>{`
        @keyframes slideInTop {
          0%   { opacity: 0; transform: translateY(-12px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0)     scale(1);    }
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1);   opacity: 1;   box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 35%, transparent); }
          50%      { transform: scale(1.4); opacity: 0.8; box-shadow: 0 0 0 4px color-mix(in srgb, var(--success) 0%, transparent); }
        }
      `}</style>
    </div>
  );
}
