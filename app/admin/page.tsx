import { OverviewCard } from "@/components/admin/OverviewCard";
import { YearlyChart } from "@/components/admin/YearlyChart";
import { RecentPayments } from "@/components/admin/RecentPayments";
import {
  getProperties,
  getRevenue,
  getExpenses,
  getUnits,
  type RevenueRow,
  type ExpenseRow,
  type PropertyRow,
  type UnitRow,
} from "@/lib/notion";

export const revalidate = 30;

function fmtMYR(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(num: number, den: number) {
  if (!den) return "0%";
  return `${Math.round((num / den) * 100)}%`;
}

function buildYearlyData(revenue: RevenueRow[]): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  for (const r of revenue) {
    if (!r.year || !r.month) continue;
    if (!out[r.year]) out[r.year] = Array(12).fill(0);
    out[r.year][r.month - 1] += r.totalAmount;
  }
  return out;
}

function buildPropertySummary(properties: PropertyRow[], units: UnitRow[], revenue: RevenueRow[]) {
  return properties.map((p) => {
    const propUnits = units.filter((u) => u.property === p.name);
    const total = propUnits.length || p.totalUnits || 0;
    const rented = propUnits.filter((u) => u.isRented).length || p.rentedUnits || 0;
    const rev = revenue
      .filter((r) => r.property === p.name)
      .reduce((acc, r) => acc + r.totalAmount, 0);
    return {
      name: p.name,
      units: `${total} units`,
      occ: pct(rented, total),
      revenue: fmtMYR(rev),
    };
  });
}

type Activity = {
  who: string;
  what: string;
  when: string;
  amount: string;
  status: "success" | "warning" | "danger";
};

function timeAgo(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function buildActivity(revenue: RevenueRow[], expenses: ExpenseRow[]): Activity[] {
  const items: (Activity & { ts: number })[] = [];
  for (const r of revenue) {
    if (!r.paymentDate) continue;
    const ts = new Date(r.paymentDate).getTime();
    if (Number.isNaN(ts)) continue;
    const status: Activity["status"] =
      r.paymentStatus === "paid"
        ? "success"
        : r.paymentStatus === "overdue"
          ? "danger"
          : "warning";
    items.push({
      who: r.unit ? `${r.property} · ${r.unit}` : r.property,
      what: r.paymentStatus === "paid" ? "Rent payment received" : `Payment ${r.paymentStatus}`,
      when: timeAgo(r.paymentDate),
      amount: `+${fmtMYR(r.totalAmount)}`,
      status,
      ts,
    });
  }
  for (const e of expenses) {
    if (!e.expenseDate) continue;
    const ts = new Date(e.expenseDate).getTime();
    if (Number.isNaN(ts)) continue;
    items.push({
      who: e.property,
      what: `${e.category} expense`,
      when: timeAgo(e.expenseDate),
      amount: `-${fmtMYR(e.amount)}`,
      status: e.isIrregular ? "warning" : "danger",
      ts,
    });
  }
  return items.sort((a, b) => b.ts - a.ts).slice(0, 5);
}

export default async function AdminOverviewPage() {
  const [properties, units, revenue, expenses] = await Promise.all([
    getProperties(),
    getUnits(),
    getRevenue(),
    getExpenses(),
  ]);

  const totalRevenue = revenue.reduce((a, r) => a + r.totalAmount, 0);
  const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const totalUnits = units.length;
  const rentedUnits = units.filter((u) => u.isRented).length;

  const kpis = [
    {
      label: "Total Revenue",
      value: fmtMYR(totalRevenue),
      hint: `${revenue.length} entries`,
      trend: "up" as const,
    },
    {
      label: "Total Expenses",
      value: fmtMYR(totalExpenses),
      hint: `${expenses.length} entries`,
      trend: "down" as const,
    },
    {
      label: "Net Profit",
      value: fmtMYR(netProfit),
      hint: "Revenue − Expenses",
      trend: (netProfit >= 0 ? "up" : "down") as "up" | "down",
    },
    {
      label: "Occupancy",
      value: pct(rentedUnits, totalUnits),
      hint: `${rentedUnits} of ${totalUnits} units`,
      trend: "flat" as const,
    },
  ];

  const yearlyData = buildYearlyData(revenue);
  const propertySummary = buildPropertySummary(properties, units, revenue);
  const activity = buildActivity(revenue, expenses);

  // Donut: revenue split by payment method
  const methodTotals: Record<string, number> = {};
  for (const r of revenue) {
    const k = r.paymentMethod || "other";
    methodTotals[k] = (methodTotals[k] ?? 0) + r.totalAmount;
  }
  const methodEntries = Object.entries(methodTotals).sort((a, b) => b[1] - a[1]);
  const methodSum = methodEntries.reduce((a, [, v]) => a + v, 0) || 1;
  const donutColors = ["var(--accent)", "#e8a743", "#6b8e6e", "#a06bb4", "#2b2e36"];
  let stop = 0;
  const donutStops = methodEntries.map(([k, v], i) => {
    const start = stop;
    stop += (v / methodSum) * 100;
    return {
      label: k,
      pct: `${Math.round((v / methodSum) * 100)}%`,
      color: donutColors[i % donutColors.length],
      start,
      end: stop,
    };
  });
  const conicGradient =
    donutStops.length > 0
      ? `conic-gradient(${donutStops
          .map((d) => `${d.color} ${d.start}% ${d.end}%`)
          .join(", ")})`
      : "conic-gradient(var(--accent) 0 100%)";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map((k) => (
            <OverviewCard key={k.label} {...k} />
          ))}
        </section>

        <YearlyChart data={yearlyData} />

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="ui-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Recent Activity
              </h3>
              <button className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                View all
              </button>
            </div>
            <ul className="flex flex-col gap-4">
              {activity.length === 0 ? (
                <li className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No recent activity
                </li>
              ) : (
                activity.map((a, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full shrink-0"
                      style={{ background: "linear-gradient(135deg,#dcd6c7,#b6ad99)" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {a.who}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {a.what} · {a.when}
                      </p>
                    </div>
                    <span
                      className={
                        "ui-chip " +
                        (a.status === "success"
                          ? "ui-chip-success"
                          : a.status === "warning"
                            ? "ui-chip-warning"
                            : "ui-chip-danger")
                      }
                    >
                      {a.amount}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="ui-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Property Summary
              </h3>
              <button className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                Manage
              </button>
            </div>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: "var(--text-faint)" }}>
                    <th className="font-medium text-[11px] uppercase tracking-wider pb-3">
                      Property
                    </th>
                    <th className="font-medium text-[11px] uppercase tracking-wider pb-3">Occ.</th>
                    <th className="font-medium text-[11px] uppercase tracking-wider pb-3 text-right">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {propertySummary.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        No properties yet
                      </td>
                    </tr>
                  ) : (
                    propertySummary.map((p, i) => (
                      <tr
                        key={p.name}
                        className={i !== propertySummary.length - 1 ? "border-b" : ""}
                        style={{ borderColor: "var(--border-soft)" }}
                      >
                        <td className="py-3.5">
                          <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                            {p.name}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {p.units}
                          </p>
                        </td>
                        <td className="py-3.5" style={{ color: "var(--text-secondary)" }}>
                          {p.occ}
                        </td>
                        <td
                          className="py-3.5 text-right font-semibold whitespace-nowrap"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {p.revenue}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <aside className="flex flex-col gap-4 sm:gap-6">
        <div className="ui-card p-4 sm:p-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Revenue by Method
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Across {revenue.length} entries
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center py-4">
            <div
              className="relative w-40 h-40 rounded-full flex items-center justify-center"
              style={{ background: conicGradient }}
            >
              <div
                className="w-28 h-28 rounded-full flex flex-col items-center justify-center"
                style={{ background: "var(--surface)" }}
              >
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Total
                </span>
                <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {fmtMYR(totalRevenue)}
                </span>
              </div>
            </div>
          </div>

          <ul className="flex flex-col gap-2 text-xs mt-2">
            {donutStops.length === 0 ? (
              <li style={{ color: "var(--text-muted)" }}>No data</li>
            ) : (
              donutStops.map((row) => (
                <li key={row.label} className="flex items-center justify-between">
                  <span
                    className="flex items-center gap-2 capitalize"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                    {row.label.replace(/_/g, " ")}
                  </span>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {row.pct}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <RecentPayments />
      </aside>
    </div>
  );
}
