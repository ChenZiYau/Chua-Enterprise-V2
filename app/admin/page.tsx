import { OverviewCard } from "@/components/admin/OverviewCard";
import { YearlyChart } from "@/components/admin/YearlyChart";
import {
  TodaysCheckup,
  RentCollectionStatus,
  OverdueTenants,
  MaintenancePriority,
  LeaseAlerts,
  PropertyCondition,
  RecentActivity,
} from "@/components/admin/DashboardSections";
import {
  getProperties,
  getRevenue,
  getExpenses,
  getUnits,
  getTenants,
  getMaintenance,
  type RevenueRow,
  type ExpenseRow,
  type PropertyRow,
  type UnitRow,
  type TenantRow,
  type MaintenanceRow,
} from "@/lib/notion";
import { buildDashboard } from "@/lib/dashboard";

export const revalidate = 30;

function fmtMYR(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function AdminOverviewPage() {
  let properties: PropertyRow[] = [];
  let units: UnitRow[] = [];
  let tenants: TenantRow[] = [];
  let revenue: RevenueRow[] = [];
  let expenses: ExpenseRow[] = [];
  let maintenance: MaintenanceRow[] = [];
  let loadError: string | null = null;

  try {
    [properties, units, tenants, revenue, expenses, maintenance] = await Promise.all([
      getProperties(),
      getUnits(),
      getTenants(),
      getRevenue(),
      getExpenses(),
      getMaintenance(),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  if (loadError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="ui-card p-12 text-center max-w-xl mx-auto">
          <p className="text-base font-semibold" style={{ color: "var(--danger)" }}>
            Couldn&apos;t load the dashboard from Notion.
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            {loadError}
          </p>
          <p className="text-xs mt-4" style={{ color: "var(--text-faint)" }}>
            Check the Notion integration token and database sharing, then refresh.
          </p>
        </div>
      </div>
    );
  }

  const d = buildDashboard({ properties, units, tenants, revenue, expenses, maintenance });
  const k = d.kpis;

  const kpis = [
    {
      label: "Rent Collected",
      value: fmtMYR(k.collectedThisMonth),
      hint: `${k.paidCount} of ${k.billedCount} tenants paid this month`,
      trend: "up" as const,
    },
    {
      label: "Outstanding Rent",
      value: fmtMYR(k.outstanding),
      hint: `${k.pendingCount} ${k.pendingCount === 1 ? "payment" : "payments"} pending`,
      trend: "flat" as const,
    },
    {
      label: "Overdue Rent",
      value: fmtMYR(k.overdue),
      hint: `${k.overdueTenantCount} ${k.overdueTenantCount === 1 ? "tenant" : "tenants"} overdue`,
      trend: (k.overdue > 0 ? "down" : "flat") as "down" | "flat",
    },
    {
      label: "Occupancy",
      value: `${k.occupancyPct}%`,
      hint: `${k.vacantUnits} vacant · ${k.rentedUnits}/${k.totalUnits} units`,
      trend: "flat" as const,
    },
    {
      label: "Net Profit",
      value: fmtMYR(k.netProfit),
      hint: "Collected − expenses (this month)",
      trend: (k.netProfit >= 0 ? "up" : "down") as "up" | "down",
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8">
      {/* Top: rental-focused KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {kpis.map((kpi) => (
          <OverviewCard key={kpi.label} {...kpi} />
        ))}
      </section>

      {/* Main: action items + health (left), operational alerts (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 sm:gap-6">
        <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
          <TodaysCheckup data={d.checkup} />
          <YearlyChart />
          <PropertyCondition rows={d.propertyHealth} />
        </div>

        <aside className="flex flex-col gap-4 sm:gap-6">
          <RentCollectionStatus data={d.collection} />
          <OverdueTenants tenants={d.overdueTenants} />
          <MaintenancePriority data={d.maintenance} />
          <LeaseAlerts data={d.leaseAlerts} />
        </aside>
      </div>

      {/* Bottom: activity feed */}
      <RecentActivity items={d.activity} />
    </div>
  );
}
