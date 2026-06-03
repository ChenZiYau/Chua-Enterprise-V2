"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useRental } from "@/context/RentalContext";
import { MONTHS, PAYMENT_STATUS_LABEL } from "@/types/rental";
import { startOfDay, todayIso } from "@/lib/date";

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
  const { revenueEntries, maintenanceEntries, tenants, visibleProperties, getUnit } = useRental();

  const data = useMemo(() => {
    const nowIso = todayIso();
    const now = startOfDay(nowIso).getTime();
    const current = startOfDay(nowIso);
    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth() + 1;
    const lastMonth = new Date(currentYear, currentMonth - 2, 1);

    const thisMonth = revenueEntries.filter((entry) => entry.year === currentYear && entry.month === currentMonth);
    const lastMonthEntries = revenueEntries.filter(
      (entry) => entry.year === lastMonth.getFullYear() && entry.month === lastMonth.getMonth() + 1
    );
    const thisMonthRevenue = thisMonth.reduce((sum, entry) => sum + entry.total_amount, 0);
    const lastMonthRevenue = lastMonthEntries.reduce((sum, entry) => sum + entry.total_amount, 0);
    const delta = lastMonthRevenue ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : null;

    const urgentMaintenance = maintenanceEntries
      .filter(
        (entry) =>
          entry.status !== "completed" &&
          (entry.priority === "urgent" || (!!entry.due_date && startOfDay(entry.due_date).getTime() < now))
      )
      .sort((a, b) => startOfDay(a.due_date || nowIso).getTime() - startOfDay(b.due_date || nowIso).getTime());

    const invoiceReminders = revenueEntries.filter((entry) => !entry.invoice_generated);
    const outstandingPayments = revenueEntries.filter((entry) => entry.payment_status === "pending" || entry.payment_status === "overdue");
    const leaseRenewals = tenants
      .filter((tenant) => tenant.lease_end && daysUntil(tenant.lease_end) >= 0 && daysUntil(tenant.lease_end) <= 30)
      .sort((a, b) => startOfDay(a.lease_end || nowIso).getTime() - startOfDay(b.lease_end || nowIso).getTime());

    return {
      currentYear,
      currentMonth,
      thisMonthRevenue,
      lastMonthRevenue,
      delta,
      urgentMaintenance,
      invoiceReminders,
      outstandingPayments,
      leaseRenewals,
    };
  }, [revenueEntries, maintenanceEntries, tenants]);

  const urgentCount =
    data.urgentMaintenance.length + data.invoiceReminders.length + data.outstandingPayments.length + data.leaseRenewals.length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Insights
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Priority items pulled from live dashboard data.
          </p>
        </div>
        <span className="ui-chip" style={{ color: urgentCount > 0 ? "var(--danger)" : "var(--success)" }}>
          {urgentCount} item{urgentCount === 1 ? "" : "s"} need attention
        </span>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <InsightCard label="Revenue This Month" value={fmt(data.thisMonthRevenue)} detail={`${MONTHS[data.currentMonth - 1]} ${data.currentYear}`} href="/admin/revenue" />
        <InsightCard
          label="Revenue Trend"
          value={data.delta == null ? "No baseline" : `${data.delta >= 0 ? "+" : ""}${data.delta}%`}
          detail={`Last month: ${fmt(data.lastMonthRevenue)}`}
          href="/admin/reports"
        />
        <InsightCard label="Urgent Maintenance" value={String(data.urgentMaintenance.length)} detail="Open or overdue cases" href="/admin/maintenance" />
        <InsightCard label="Invoices To Generate" value={String(data.invoiceReminders.length)} detail="Revenue entries without invoices" href="/admin/invoices" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel title="Maintenance Attention" href="/admin/maintenance" empty="No urgent or overdue maintenance cases.">
          {data.urgentMaintenance.map((entry) => (
            <Row
              key={entry.id}
              title={entry.issue}
              detail={`${entry.property || "Property"} - ${entry.unit || "Unit"} - ${entry.status.replace(/_/g, " ")}`}
              meta={entry.due_date ? `Due ${entry.due_date}` : "No due date"}
              tone={entry.priority === "urgent" ? "danger" : "warning"}
            />
          ))}
        </Panel>

        <Panel title="Invoice Reminders" href="/admin/invoices" empty="All revenue entries have generated invoices.">
          {data.invoiceReminders.slice(0, 8).map((entry) => {
            const unit = getUnit(entry.unit_id);
            const property = visibleProperties.find((p) => p.id === entry.property_id);
            return (
              <Row
                key={entry.id}
                title={`${property?.name ?? "Property"} - ${unit?.name ?? "Unit"}`}
                detail={`${MONTHS[entry.month - 1]} ${entry.year} - ${unit?.tenant_name ?? "Tenant"}`}
                meta={fmt(entry.total_amount)}
                tone="warning"
              />
            );
          })}
        </Panel>

        <Panel title="Payment Follow-Up" href="/admin/invoices" empty="No pending or overdue payments.">
          {data.outstandingPayments.slice(0, 8).map((entry) => {
            const unit = getUnit(entry.unit_id);
            const property = visibleProperties.find((p) => p.id === entry.property_id);
            return (
              <Row
                key={entry.id}
                title={`${property?.name ?? "Property"} - ${unit?.name ?? "Unit"}`}
                detail={`${MONTHS[entry.month - 1]} ${entry.year} - ${PAYMENT_STATUS_LABEL[entry.payment_status]}`}
                meta={fmt(entry.total_amount)}
                tone={entry.payment_status === "overdue" ? "danger" : "warning"}
              />
            );
          })}
        </Panel>

        <Panel title="Lease Renewals" href="/admin/tenants" empty="No leases ending in the next 30 days.">
          {data.leaseRenewals.map((tenant) => {
            const unit = tenant.unit_id ? getUnit(tenant.unit_id) : undefined;
            return (
              <Row
                key={tenant.id}
                title={tenant.name}
                detail={`${unit?.name ?? "No unit"} - lease ends ${tenant.lease_end}`}
                meta={`${daysUntil(tenant.lease_end || todayIso())} days left`}
                tone={daysUntil(tenant.lease_end || todayIso()) <= 7 ? "danger" : "warning"}
              />
            );
          })}
        </Panel>
      </section>
    </div>
  );
}

function InsightCard({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) {
  return (
    <Link href={href} className="ui-card p-5 transition hover:border-[var(--accent)]">
      <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-2xl font-semibold mt-4" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>
        {detail}
      </p>
    </Link>
  );
}

function Panel({ title, href, empty, children }: { title: string; href: string; empty: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="ui-card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b" style={{ borderColor: "var(--border-soft)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
        <Link href={href} className="text-xs font-medium" style={{ color: "var(--accent)" }}>
          Open
        </Link>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {hasChildren ? children : <p className="px-2 py-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>{empty}</p>}
      </div>
    </section>
  );
}

function Row({ title, detail, meta, tone }: { title: string; detail: string; meta: string; tone: "danger" | "warning" }) {
  const color = tone === "danger" ? "var(--danger)" : "var(--warning)";
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
      <span className="text-xs font-semibold shrink-0" style={{ color }}>
        {meta}
      </span>
    </div>
  );
}
