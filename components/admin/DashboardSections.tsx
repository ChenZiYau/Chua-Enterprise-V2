import Link from "next/link";
import type { Activity } from "@/lib/dashboard";

function SectionHeader({ title, href, action }: { title: string; href?: string; action?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {href ? (
        <Link href={href} className="text-xs font-medium" style={{ color: "var(--accent)" }}>
          {action ?? "View all"}
        </Link>
      ) : null}
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm py-3" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

/* ----------------------------- Recent Activity ----------------------------- */

export function RecentActivity({ items }: { items: Activity[] }) {
  const dot = (s: Activity["status"]) =>
    s === "success" ? "var(--success)" : s === "danger" ? "var(--danger)" : s === "warning" ? "var(--warning)" : "var(--accent)";
  const chipClass = (s: Activity["status"]) =>
    s === "success" ? "ui-chip-success" : s === "danger" ? "ui-chip-danger" : s === "warning" ? "ui-chip-warning" : "";

  return (
    <section className="ui-card p-4 sm:p-6">
      <SectionHeader title="Recent Activity" href="/admin/reports" />
      {items.length === 0 ? (
        <EmptyRow>No recent activity.</EmptyRow>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {items.map((a, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot(a.status) }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {a.who}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {a.what} · {a.when}
                </p>
              </div>
              <span className={"ui-chip shrink-0 " + chipClass(a.status)}>{a.amount}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
