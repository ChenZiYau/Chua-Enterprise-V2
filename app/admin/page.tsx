import { OverviewCard } from "@/components/admin/OverviewCard";
import { YearlyChart } from "@/components/admin/YearlyChart";
import { RecentPayments } from "@/components/admin/RecentPayments";

const kpis = [
  { label: "Total Revenue", value: "$248,540", delta: "+12.4%", trend: "up" as const, hint: "vs last quarter" },
  { label: "Total Expenses", value: "$76,210", delta: "+4.1%", trend: "down" as const, hint: "vs last quarter" },
  { label: "Net Profit", value: "$172,330", delta: "+18.7%", trend: "up" as const, hint: "vs last quarter" },
  { label: "Occupancy", value: "92%", delta: "+3.0%", trend: "up" as const, hint: "23 of 25 units" },
];

const activity = [
  { who: "Maria Hulama", what: "Rent payment received", when: "2 min ago", amount: "+$1,840", status: "success" as const },
  { who: "David Astee", what: "Maintenance request opened", when: "18 min ago", amount: "Unit 4B", status: "warning" as const },
  { who: "Arnold Swarz", what: "Lease renewed", when: "1 hr ago", amount: "12 months", status: "success" as const },
  { who: "Jessica Alba", what: "Invoice overdue", when: "3 hr ago", amount: "-$620", status: "danger" as const },
  { who: "Steven Summer", what: "New tenant onboarded", when: "Today", amount: "Unit 2A", status: "success" as const },
];

const properties = [
  { name: "Riverside Heights", units: "12 units", occ: "100%", revenue: "$48,200" },
  { name: "Maple Court", units: "8 units", occ: "88%", revenue: "$31,400" },
  { name: "Harbor View Lofts", units: "5 units", occ: "80%", revenue: "$22,950" },
];

export default function AdminOverviewPage() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 p-6 lg:p-8">
      {/* Main column */}
      <div className="flex flex-col gap-6 min-w-0">
        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <OverviewCard key={k.label} {...k} />
          ))}
        </section>

        {/* Yearly Overview chart */}
        <YearlyChart />

        {/* Recent Activity + Property Summary */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="ui-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Recent Activity
              </h3>
              <button className="text-xs font-medium" style={{ color: "var(--accent)" }}>View all</button>
            </div>
            <ul className="flex flex-col gap-4">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full shrink-0"
                    style={{ background: "linear-gradient(135deg,#dcd6c7,#b6ad99)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.who}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{a.what} · {a.when}</p>
                  </div>
                  <span
                    className={
                      "ui-chip " +
                      (a.status === "success" ? "ui-chip-success" : a.status === "warning" ? "ui-chip-warning" : "ui-chip-danger")
                    }
                  >
                    {a.amount}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Property Summary */}
          <div className="ui-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Property Summary
              </h3>
              <button className="text-xs font-medium" style={{ color: "var(--accent)" }}>Manage</button>
            </div>
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: "var(--text-faint)" }}>
                    <th className="font-medium text-[11px] uppercase tracking-wider pb-3">Property</th>
                    <th className="font-medium text-[11px] uppercase tracking-wider pb-3">Occ.</th>
                    <th className="font-medium text-[11px] uppercase tracking-wider pb-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p, i) => (
                    <tr key={p.name} className={i !== properties.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--border-soft)" }}>
                      <td className="py-3.5">
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{p.units}</p>
                      </td>
                      <td className="py-3.5" style={{ color: "var(--text-secondary)" }}>{p.occ}</td>
                      <td className="py-3.5 text-right font-semibold" style={{ color: "var(--text-primary)" }}>{p.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* Right summary panel */}
      <aside className="flex flex-col gap-6">
        {/* Monthly Profit */}
        <div className="ui-card p-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Monthly Profit</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Growth of 26%</p>
            </div>
          </div>

          {/* Donut placeholder */}
          <div className="flex items-center justify-center py-4">
            <div
              className="relative w-40 h-40 rounded-full flex items-center justify-center"
              style={{
                background:
                  "conic-gradient(var(--accent) 0 60%, #e8a743 60% 84%, #2b2e36 84% 100%)",
              }}
            >
              <div
                className="w-28 h-28 rounded-full flex flex-col items-center justify-center"
                style={{ background: "var(--surface)" }}
              >
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Total</span>
                <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>$76,356</span>
              </div>
            </div>
          </div>

          <ul className="flex flex-col gap-2 text-xs mt-2">
            {[
              { label: "Rentals", pct: "60%", color: "var(--accent)" },
              { label: "Fees", pct: "24%", color: "#e8a743" },
              { label: "Other", pct: "16%", color: "#2b2e36" },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                  {row.label}
                </span>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>{row.pct}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent Payments — live feed */}
        <RecentPayments />
      </aside>
    </div>
  );
}
