import { IconArrowDown, IconArrowUp } from "./icons";

type Trend = "up" | "down" | "flat";

type Props = {
  label: string;
  value: string;
  delta?: string;
  trend?: Trend;
  hint?: string;
};

export function OverviewCard({ label, value, delta, trend = "flat", hint }: Props) {
  const isUp = trend === "up";
  const isDown = trend === "down";
  const Arrow = isUp ? IconArrowUp : isDown ? IconArrowDown : null;
  const deltaColor = isUp ? "var(--success)" : isDown ? "var(--danger)" : "var(--text-muted)";

  return (
    <div className="ui-kpi">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
        {delta && (
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "var(--surface)", color: deltaColor }}
          >
            {Arrow && <Arrow className="w-3 h-3" />}
            {delta}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
      {hint && (
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>{hint}</p>
      )}
    </div>
  );
}
