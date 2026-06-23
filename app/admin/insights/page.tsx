"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useRental } from "@/context/RentalContext";
import { MONTHS } from "@/types/rental";
import { startOfDay, todayIso } from "@/lib/date";
import { YearlyChart } from "@/components/admin/YearlyChart";

function fmt(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value);
}

function daysUntil(iso: string) {
  const diff = startOfDay(iso).getTime() - startOfDay(todayIso()).getTime();
  return Math.round(diff / 86_400_000);
}

export default function InsightsPage() {
  const {
    revenueEntries,
    expenseEntries,
    maintenanceEntries,
    tenants,
    units,
    visibleProperties,
    getPropertyYTD,
    loadError,
  } = useRental();

  const data = useMemo(() => {
    const nowIso = todayIso();
    const current = startOfDay(nowIso);
    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth() + 1;
    const lastMonthDate = new Date(currentYear, currentMonth - 2, 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonthNum = lastMonthDate.getMonth() + 1;

    // --- Revenue trend (this vs last month) ---
    const thisMonthRevenue = revenueEntries
      .filter((e) => e.year === currentYear && e.month === currentMonth)
      .reduce((s, e) => s + e.total_amount, 0);
    const lastMonthRevenue = revenueEntries
      .filter((e) => e.year === lastMonthYear && e.month === lastMonthNum)
      .reduce((s, e) => s + e.total_amount, 0);
    const revenueDelta = lastMonthRevenue
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null;

    // --- Net profit this month (collected rent − expenses) ---
    const collectedThisMonth = revenueEntries
      .filter((e) => e.year === currentYear && e.month === currentMonth && e.payment_status === "paid")
      .reduce((s, e) => s + e.total_amount, 0);
    const expensesThisMonth = expenseEntries
      .filter((e) => e.year === currentYear && e.month === currentMonth)
      .reduce((s, e) => s + e.amount, 0);
    const netProfit = collectedThisMonth - expensesThisMonth;

    // --- Occupancy snapshot ---
    const totalUnits = units.length;
    const rentedUnits = units.filter((u) => u.is_rented).length;
    const vacantUnits = totalUnits - rentedUnits;
    const occupancyPct = totalUnits ? Math.round((rentedUnits / totalUnits) * 100) : 0;

    // --- Estimated lost rent from vacancy ---
    const vacant = units
      .filter((u) => !u.is_rented)
      .map((u) => ({
        unit: u,
        property: visibleProperties.find((p) => p.id === u.property_id),
        rate: u.rental_rate ?? 0,
      }))
      .sort((a, b) => b.rate - a.rate);
    const lostRent = vacant.reduce((s, v) => s + v.rate, 0);

    // --- Profit margin by property (best & worst) ---
    const margins = visibleProperties
      .map((p) => {
        const { revenue, expenses, net } = getPropertyYTD(p.id, currentYear);
        const margin = revenue > 0 ? Math.round((net / revenue) * 100) : null;
        return { property: p, revenue, expenses, net, margin };
      })
      .filter((m) => m.revenue > 0 || m.expenses > 0)
      .sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity));

    // --- Repeated late-paying tenants (>= 2 overdue entries) ---
    const lateByUnit = new Map<string, { count: number; amount: number }>();
    for (const e of revenueEntries) {
      if (e.payment_status !== "overdue") continue;
      const prev = lateByUnit.get(e.unit_id) ?? { count: 0, amount: 0 };
      lateByUnit.set(e.unit_id, { count: prev.count + 1, amount: prev.amount + e.total_amount });
    }
    const repeatLatePayers = [...lateByUnit.entries()]
      .filter(([, v]) => v.count >= 2)
      .map(([unitId, v]) => {
        const unit = units.find((u) => u.id === unitId);
        const property = unit ? visibleProperties.find((p) => p.id === unit.property_id) : undefined;
        return {
          id: unitId,
          tenant: unit?.tenant_name || "Tenant",
          where: `${property?.name ?? "Property"} - ${unit?.name ?? "Unit"}`,
          count: v.count,
          amount: v.amount,
        };
      })
      .sort((a, b) => b.count - a.count || b.amount - a.amount);

    // --- Maintenance hotspots (properties by issue count) ---
    const maintByProp = new Map<string, { total: number; open: number }>();
    for (const m of maintenanceEntries) {
      const key = m.property || "Unassigned";
      const prev = maintByProp.get(key) ?? { total: 0, open: 0 };
      maintByProp.set(key, {
        total: prev.total + 1,
        open: prev.open + (m.status !== "completed" ? 1 : 0),
      });
    }
    const maintenanceHotspots = [...maintByProp.entries()]
      .map(([property, v]) => ({ property, ...v }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.open - a.open || b.total - a.total)
      .slice(0, 6);

    // --- Invoice reminders ---
    const invoiceReminders = revenueEntries.filter((e) => !e.invoice_generated);

    // --- Lease renewal warnings (ending <= 30d or expired) ---
    const leaseWarnings = tenants
      .filter((t) => t.lease_end)
      .map((t) => ({ tenant: t, days: daysUntil(t.lease_end!) }))
      .filter((x) => x.days <= 30)
      .sort((a, b) => a.days - b.days);

    return {
      currentYear,
      currentMonth,
      thisMonthRevenue,
      lastMonthRevenue,
      revenueDelta,
      collectedThisMonth,
      expensesThisMonth,
      netProfit,
      occupancyPct,
      rentedUnits,
      totalUnits,
      vacantUnits,
      lostRent,
      vacant,
      margins,
      repeatLatePayers,
      maintenanceHotspots,
      invoiceReminders,
      leaseWarnings,
    };
  }, [revenueEntries, expenseEntries, maintenanceEntries, tenants, units, visibleProperties, getPropertyYTD]);

  if (loadError) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="ui-card p-12 text-center max-w-xl mx-auto">
          <p className="text-base font-semibold" style={{ color: "var(--danger)" }}>
            Couldn&apos;t load insights from the database.
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  const bestMargin = data.margins[0];
  const worstMargin = data.margins.length > 1 ? data.margins[data.margins.length - 1] : undefined;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Insights
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Trends, patterns &amp; recommendations — the bigger picture behind the daily dashboard.
        </p>
      </div>

      {/* Trend KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat
          label="Net Profit (This Month)"
          value={fmt(data.netProfit)}
          detail={`${fmt(data.collectedThisMonth)} collected − ${fmt(data.expensesThisMonth)} expenses`}
          tone={data.netProfit >= 0 ? "up" : "down"}
          href="/admin/reports"
        />
        <Stat
          label="Revenue Trend"
          value={data.revenueDelta == null ? "No baseline" : `${data.revenueDelta >= 0 ? "+" : ""}${data.revenueDelta}%`}
          detail={`${fmt(data.thisMonthRevenue)} vs ${fmt(data.lastMonthRevenue)} last month`}
          tone={data.revenueDelta == null ? "neutral" : data.revenueDelta >= 0 ? "up" : "down"}
          href="/admin/reports"
        />
        <Stat
          label="Occupancy"
          value={`${data.occupancyPct}%`}
          detail={`${data.rentedUnits}/${data.totalUnits} occupied · ${data.vacantUnits} vacant`}
          tone={data.occupancyPct >= 80 ? "up" : data.occupancyPct >= 50 ? "neutral" : "down"}
          href="/admin/properties"
        />
        <Stat
          label="Est. Lost Rent / Vacancy"
          value={fmt(data.lostRent)}
          detail={`${data.vacantUnits} vacant ${data.vacantUnits === 1 ? "unit" : "units"} / month`}
          tone={data.lostRent > 0 ? "down" : "up"}
          href="/admin/properties"
        />
        <Stat
          label="Invoices To Generate"
          value={String(data.invoiceReminders.length)}
          detail="Revenue entries without invoices"
          tone={data.invoiceReminders.length > 0 ? "neutral" : "up"}
          href="/admin/invoices"
        />
      </section>

      {/* Revenue chart (moved here from the dashboard) */}
      <YearlyChart />

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Profit margin ranking */}
        <Panel
          title="Profit Margin by Property"
          href="/admin/reports"
          empty="No revenue or expense data yet to compare margins."
          subtitle={
            bestMargin
              ? `Best: ${bestMargin.property.name}${worstMargin ? ` · Worst: ${worstMargin.property.name}` : ""}`
              : undefined
          }
        >
          {data.margins.map((m, i) => {
            const isBest = i === 0 && data.margins.length > 1;
            const isWorst = i === data.margins.length - 1 && data.margins.length > 1;
            const color = m.net >= 0 ? "var(--success)" : "var(--danger)";
            return (
              <div
                key={m.property.id}
                className="rounded-xl px-3.5 py-3 flex items-center justify-between gap-3"
                style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                    {m.property.name}
                    {isBest ? <span className="ui-chip ui-chip-success">Best</span> : null}
                    {isWorst ? <span className="ui-chip ui-chip-danger">Worst</span> : null}
                  </p>
                  <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>
                    {fmt(m.revenue)} revenue · {fmt(m.expenses)} expenses
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums" style={{ color }}>
                    {m.margin == null ? "—" : `${m.margin}%`}
                  </p>
                  <p className="text-xs tabular-nums" style={{ color: "var(--text-faint)" }}>
                    {fmt(m.net)} net
                  </p>
                </div>
              </div>
            );
          })}
        </Panel>

        {/* Maintenance hotspots */}
        <Panel
          title="Maintenance Hotspots"
          href="/admin/maintenance"
          empty="No maintenance history recorded yet."
          subtitle="Properties generating the most maintenance"
        >
          {data.maintenanceHotspots.map((h) => (
            <Row
              key={h.property}
              title={h.property}
              detail={`${h.total} total ${h.total === 1 ? "case" : "cases"} logged`}
              meta={`${h.open} open`}
              tone={h.open > 0 ? "warning" : "neutral"}
            />
          ))}
        </Panel>

        {/* Repeated late payers */}
        <Panel
          title="Repeated Late-Paying Tenants"
          href="/admin/revenue"
          empty="No tenants with repeated overdue payments. 👍"
          subtitle="2 or more overdue payments on record"
        >
          {data.repeatLatePayers.map((t) => (
            <Row
              key={t.id}
              title={t.tenant}
              detail={`${t.where} · ${fmt(t.amount)} overdue total`}
              meta={`${t.count}× late`}
              tone="danger"
            />
          ))}
        </Panel>

        {/* Lost rent — vacant units */}
        <Panel
          title="Estimated Lost Rent"
          href="/admin/properties"
          empty="Every unit is occupied — no vacancy loss."
          subtitle={data.lostRent > 0 ? `${fmt(data.lostRent)} / month across ${data.vacantUnits} vacant` : undefined}
        >
          {data.vacant.map((v) => (
            <Row
              key={v.unit.id}
              title={`${v.property?.name ?? "Property"} - ${v.unit.name}`}
              detail={v.rate > 0 ? "Vacant — potential monthly rent" : "Vacant — rental rate not set"}
              meta={v.rate > 0 ? `${fmt(v.rate)}/mo` : "—"}
              tone="warning"
            />
          ))}
        </Panel>

        {/* Invoice reminders */}
        <Panel title="Invoice Reminders" href="/admin/invoices" empty="All revenue entries have generated invoices.">
          {data.invoiceReminders.slice(0, 8).map((e) => {
            const unit = units.find((u) => u.id === e.unit_id);
            const property = visibleProperties.find((p) => p.id === e.property_id);
            return (
              <Row
                key={e.id}
                title={`${property?.name ?? "Property"} - ${unit?.name ?? "Unit"}`}
                detail={`${MONTHS[e.month - 1]} ${e.year} · ${unit?.tenant_name ?? "Tenant"}`}
                meta={fmt(e.total_amount)}
                tone="warning"
              />
            );
          })}
        </Panel>

        {/* Lease renewal warnings */}
        <Panel title="Lease Renewal Warnings" href="/admin/tenants" empty="No leases ending in the next 30 days.">
          {data.leaseWarnings.map(({ tenant, days }) => {
            const unit = tenant.unit_id ? units.find((u) => u.id === tenant.unit_id) : undefined;
            return (
              <Row
                key={tenant.id}
                title={tenant.name}
                detail={`${unit?.name ?? "No unit"} · lease ends ${tenant.lease_end}`}
                meta={days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Ends today" : `${days}d left`}
                tone={days <= 7 ? "danger" : "warning"}
              />
            );
          })}
        </Panel>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  tone,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "up" | "down" | "neutral";
  href: string;
}) {
  const color = tone === "up" ? "var(--success)" : tone === "down" ? "var(--danger)" : "var(--text-primary)";
  return (
    <Link href={href} className="ui-card p-5 transition hover:border-[var(--accent)]">
      <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-2xl font-semibold mt-3 tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>
        {detail}
      </p>
    </Link>
  );
}

function Panel({
  title,
  href,
  empty,
  subtitle,
  children,
}: {
  title: string;
  href: string;
  empty: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="ui-card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b" style={{ borderColor: "var(--border-soft)" }}>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h3>
          {subtitle ? (
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-faint)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <Link href={href} className="text-xs font-medium shrink-0" style={{ color: "var(--accent)" }}>
          Open
        </Link>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {hasChildren ? children : <p className="px-2 py-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>{empty}</p>}
      </div>
    </section>
  );
}

function Row({
  title,
  detail,
  meta,
  tone,
}: {
  title: string;
  detail: string;
  meta: string;
  tone: "danger" | "warning" | "neutral";
}) {
  const color = tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : "var(--text-secondary)";
  return (
    <div className="rounded-xl px-3.5 py-3 flex items-start justify-between gap-3" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {title}
        </p>
        <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>
          {detail}
        </p>
      </div>
      <span className="text-xs font-semibold shrink-0 tabular-nums" style={{ color }}>
        {meta}
      </span>
    </div>
  );
}
