import { DashboardClient } from "@/components/admin/DashboardClient";
import { RecentActivity } from "@/components/admin/DashboardSections";
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

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8">
      {/* Interactive overview: rent, occupancy, properties, today's checkup */}
      <DashboardClient data={d} />

      {/* Bottom: activity feed */}
      <RecentActivity items={d.activity} />
    </div>
  );
}
