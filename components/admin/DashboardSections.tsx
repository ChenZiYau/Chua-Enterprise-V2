import Link from "next/link";
import type {
  DashboardData,
  OverdueTenant,
  UrgentMaintenance,
  LeaseAlert,
  PropertyHealth,
  Activity,
} from "@/lib/dashboard";

function fmtMYR(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

function compactMYR(n: number) {
  if (Math.abs(n) >= 1000) return `RM ${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k`;
  return `RM ${Math.round(n)}`;
}

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

/* ----------------------------- Today's Checkup ----------------------------- */

export function TodaysCheckup({ data }: { data: DashboardData["checkup"] }) {
  const items = [
    { n: data.dueToday, label: data.dueToday === 1 ? "rent payment due today" : "rent payments due today", tone: "warning", href: "/admin/revenue" },
    { n: data.overduePayments, label: data.overduePayments === 1 ? "overdue payment" : "overdue payments", tone: "danger", href: "/admin/revenue" },
    { n: data.urgentMaintenance, label: data.urgentMaintenance === 1 ? "urgent maintenance request" : "urgent maintenance requests", tone: "danger", href: "/admin/maintenance" },
    { n: data.leasesEndingSoon, label: data.leasesEndingSoon === 1 ? "lease ending within 30 days" : "leases ending within 30 days", tone: "warning", href: "/admin/tenants" },
    { n: data.vacantUnits, label: data.vacantUnits === 1 ? "vacant unit to follow up" : "vacant units to follow up", tone: "info", href: "/admin/properties" },
  ] as const;

  const active = items.filter((i) => i.n > 0);
  const toneColor = (t: string) =>
    t === "danger" ? "var(--danger)" : t === "warning" ? "var(--warning)" : "var(--accent)";
  const toneBg = (t: string) =>
    t === "danger"
      ? "rgba(211,84,84,0.12)"
      : t === "warning"
        ? "rgba(224,162,61,0.14)"
        : "var(--accent-soft)";

  return (
    <section className="ui-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: active.length ? "var(--danger)" : "var(--success)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Today&apos;s Checkup
          </h3>
        </div>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          {active.length ? `${active.length} need${active.length === 1 ? "s" : ""} attention` : "All clear"}
        </span>
      </div>

      {active.length === 0 ? (
        <EmptyRow>Nothing needs attention today. You&apos;re all caught up.</EmptyRow>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {active.map((i, idx) => (
            <li key={idx}>
              <Link
                href={i.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition hover:opacity-90"
                style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}
              >
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold tabular-nums shrink-0"
                  style={{ background: toneBg(i.tone), color: toneColor(i.tone) }}
                >
                  {i.n}
                </span>
                <span className="text-xs font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>
                  {i.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------- Rent Collection Status ------------------------- */

export function RentCollectionStatus({ data }: { data: DashboardData["collection"] }) {
  const { collected, pending, overdue, ratePct } = data;
  const rows = [
    { label: "Collected", value: collected, color: "var(--success)" },
    { label: "Pending", value: pending, color: "var(--warning)" },
    { label: "Overdue", value: overdue, color: "var(--danger)" },
  ];

  return (
    <section className="ui-card p-4 sm:p-6">
      <SectionHeader title="Rent Collection · This Month" href="/admin/revenue" action="Details" />

      {data.billed === 0 ? (
        <EmptyRow>No rent collection data found for this month.</EmptyRow>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {ratePct}%
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              collection rate
            </span>
          </div>

          {/* Segmented progress bar */}
          <div className="flex h-2.5 w-full rounded-full overflow-hidden mb-4" style={{ background: "var(--surface-muted)" }}>
            {rows.map((r) =>
              r.value > 0 ? (
                <div key={r.label} style={{ width: `${(r.value / data.billed) * 100}%`, background: r.color }} />
              ) : null
            )}
          </div>

          <ul className="flex flex-col gap-2.5">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                  {r.label}
                </span>
                <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {fmtMYR(r.value)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ---------------------------- Overdue Tenants ------------------------------ */

export function OverdueTenants({ tenants }: { tenants: OverdueTenant[] }) {
  return (
    <section className="ui-card p-4 sm:p-6">
      <SectionHeader title="Overdue Tenants" href="/admin/revenue" />
      {tenants.length === 0 ? (
        <EmptyRow>No overdue tenants. 🎉</EmptyRow>
      ) : (
        <ul className="flex flex-col">
          {tenants.slice(0, 5).map((t, i) => (
            <li
              key={t.id}
              className={"flex items-center gap-3 py-2.5 " + (i !== 0 ? "border-t" : "")}
              style={{ borderColor: "var(--border-soft)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {t.tenant}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {t.unit} · {t.daysOverdue}d overdue
                </p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--danger)" }}>
                  {fmtMYR(t.amount)}
                </span>
                <span className="ui-chip ui-chip-danger mt-0.5">Overdue</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------- Maintenance Priority ---------------------------- */

export function MaintenancePriority({ data }: { data: DashboardData["maintenance"] }) {
  const stats = [
    { label: "Urgent", value: data.urgent, color: "var(--danger)" },
    { label: "Pending", value: data.pending, color: "var(--warning)" },
    { label: "In Progress", value: data.inProgress, color: "var(--accent)" },
    { label: "Completed", value: data.completed, color: "var(--success)" },
  ];

  return (
    <section className="ui-card p-4 sm:p-6">
      <SectionHeader title="Maintenance Priority" href="/admin/maintenance" />

      <div className="grid grid-cols-4 gap-2 mb-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center px-1 py-2 rounded-lg" style={{ background: "var(--surface-muted)" }}>
            <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--text-muted)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {data.topUrgent.length === 0 ? (
        <EmptyRow>No urgent maintenance requests.</EmptyRow>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.topUrgent.map((m: UrgentMaintenance) => (
            <li key={m.id} className="flex items-center gap-2.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: m.reason === "urgent" ? "var(--danger)" : "var(--warning)" }}
              />
              <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "var(--text-secondary)" }}>
                {m.issue}
                <span style={{ color: "var(--text-faint)" }}> · {m.unit}</span>
              </span>
              <span className={"ui-chip " + (m.reason === "urgent" ? "ui-chip-danger" : "ui-chip-warning")}>
                {m.reason === "urgent" ? "Urgent" : "Overdue"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------ Lease Alerts ------------------------------- */

export function LeaseAlerts({ data }: { data: DashboardData["leaseAlerts"] }) {
  return (
    <section className="ui-card p-4 sm:p-6">
      <SectionHeader title="Lease Alerts" href="/admin/tenants" />

      <div className="flex gap-2 mb-3 text-xs">
        <span className="ui-chip ui-chip-warning">{data.endingSoon.length} ending soon</span>
        {data.expired > 0 ? <span className="ui-chip ui-chip-danger">{data.expired} renewal needed</span> : null}
      </div>

      {data.endingSoon.length === 0 ? (
        <EmptyRow>No leases ending soon.</EmptyRow>
      ) : (
        <ul className="flex flex-col">
          {data.endingSoon.slice(0, 5).map((l: LeaseAlert, i) => (
            <li
              key={l.id}
              className={"flex items-center gap-3 py-2.5 " + (i !== 0 ? "border-t" : "")}
              style={{ borderColor: "var(--border-soft)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {l.tenant}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {l.unit}
                </p>
              </div>
              <span
                className={"ui-chip shrink-0 " + (l.daysLeft <= 7 ? "ui-chip-danger" : "ui-chip-warning")}
              >
                {l.daysLeft === 0 ? "Ends today" : `${l.daysLeft}d left`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------- Property Condition ---------------------------- */

function statusChip(s: PropertyHealth["status"]) {
  return s === "Good" ? "ui-chip-success" : s === "Attention" ? "ui-chip-warning" : "ui-chip-danger";
}

function statusDot(s: PropertyHealth["status"]) {
  return s === "Good" ? "var(--success)" : s === "Attention" ? "var(--warning)" : "var(--danger)";
}

function ConditionStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="text-sm font-semibold mt-0.5 tabular-nums truncate" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

export function PropertyCondition({ rows }: { rows: PropertyHealth[] }) {
  return (
    <section className="ui-card p-4 sm:p-6">
      <SectionHeader title="Property Condition" href="/admin/properties" action="Manage" />

      {rows.length === 0 ? (
        <EmptyRow>No properties yet. Add one to start tracking condition.</EmptyRow>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {rows.map((p) => (
            <Link
              key={p.name}
              href="/admin/properties"
              className="rounded-xl p-4 flex flex-col gap-3 transition hover:shadow-md"
              style={{
                background: "var(--surface-muted)",
                border: "1px solid var(--border-soft)",
                borderLeft: `3px solid ${statusDot(p.status)}`,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {p.name}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                    {p.modelLabel} · {p.rentedUnits} of {p.totalUnits} {p.unitWord} rented
                  </p>
                </div>
                <span className={"ui-chip shrink-0 " + statusChip(p.status)}>{p.status}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
                <ConditionStat label="Revenue" value={compactMYR(p.monthlyRevenue)} />
                <ConditionStat
                  label="Outstanding"
                  value={p.outstanding > 0 ? compactMYR(p.outstanding) : "—"}
                  color={p.outstanding > 0 ? "var(--danger)" : undefined}
                />
                <ConditionStat
                  label="Issues"
                  value={String(p.issues)}
                  color={p.urgentIssues > 0 ? "var(--danger)" : p.issues > 0 ? "var(--warning)" : undefined}
                />
              </div>

              <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusDot(p.status) }} />
                {p.reason}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
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
