// Pure dashboard compute layer. Takes the raw Notion rows and derives the
// rental-operations view the admin needs for a daily checkup. No network here
// so it stays easy to reason about and reuse; all values come from real rows.

import type {
  PropertyRow,
  UnitRow,
  TenantRow,
  RevenueRow,
  ExpenseRow,
  MaintenanceRow,
} from "@/lib/notion";
import { startOfDay, todayIso } from "@/lib/date";

export type OverdueTenant = {
  id: string;
  tenant: string;
  unit: string;
  amount: number;
  daysOverdue: number;
};

export type UrgentMaintenance = {
  id: string;
  issue: string;
  unit: string;
  reason: "urgent" | "overdue";
};

export type LeaseAlert = {
  id: string;
  tenant: string;
  unit: string;
  leaseEnd: string;
  daysLeft: number;
};

export type PropertyHealth = {
  name: string;
  rentalModel: string; // raw Notion value: "whole_unit" | "room_rental"
  modelLabel: string; // "Whole Unit" | "Room Rental"
  unitWord: string; // "unit"/"units" | "room"/"rooms"
  totalUnits: number;
  rentedUnits: number;
  occupancyPct: number;
  monthlyRevenue: number;
  outstanding: number;
  issues: number;
  urgentIssues: number;
  status: "Good" | "Attention" | "Critical";
  reason: string;
};

export type Activity = {
  who: string;
  what: string;
  when: string;
  amount: string;
  status: "success" | "warning" | "danger" | "info";
};

export type RecentPayment = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  when: string;
};

export type DashboardData = {
  kpis: {
    collectedThisMonth: number;
    paidCount: number;
    billedCount: number;
    outstanding: number;
    pendingCount: number;
    overdue: number;
    overdueTenantCount: number;
    occupancyPct: number;
    rentedUnits: number;
    totalUnits: number;
    vacantUnits: number;
    netProfit: number;
  };
  checkup: {
    dueToday: number;
    overduePayments: number;
    urgentMaintenance: number;
    leasesEndingSoon: number;
    vacantUnits: number;
  };
  collection: {
    collected: number;
    pending: number;
    overdue: number;
    billed: number;
    ratePct: number;
  };
  overdueTenants: OverdueTenant[];
  maintenance: {
    urgent: number;
    pending: number;
    inProgress: number;
    completed: number;
    topUrgent: UrgentMaintenance[];
  };
  leaseAlerts: {
    endingSoon: LeaseAlert[];
    expired: number;
  };
  propertyHealth: PropertyHealth[];
  activity: Activity[];
  recentPayments: RecentPayment[];
};

const LEASE_SOON_DAYS = 30;

function lc(s: string) {
  return (s ?? "").trim().toLowerCase();
}

/** Billing period (year, month) for a revenue row, with paymentDate fallback. */
function revPeriod(r: RevenueRow): { year: number; month: number } {
  if (r.year && r.month) return { year: r.year, month: r.month };
  if (r.paymentDate) {
    const d = new Date(r.paymentDate);
    if (!Number.isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return { year: 0, month: 0 };
}

function daysSince(iso: string, today: Date): number {
  if (!iso) return 0;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.round((today.getTime() - d.getTime()) / 86_400_000));
}

function daysUntil(iso: string, today: Date): number {
  if (!iso) return NaN;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return NaN;
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function timeAgo(iso: string, today: Date): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const days = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function fmtMYR(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function buildDashboard(input: {
  properties: PropertyRow[];
  units: UnitRow[];
  tenants: TenantRow[];
  revenue: RevenueRow[];
  expenses: ExpenseRow[];
  maintenance: MaintenanceRow[];
}): DashboardData {
  const { properties, units, tenants, revenue, expenses, maintenance } = input;
  const today = startOfDay(todayIso());
  const curYear = today.getFullYear();
  const curMonth = today.getMonth() + 1;
  const todayStr = todayIso();

  // ---- tenant name lookup by property|unit ----
  const tenantByUnit = new Map<string, string>();
  for (const u of units) {
    if (u.tenantName) tenantByUnit.set(`${u.property}|${u.name}`, u.tenantName);
  }
  for (const t of tenants) {
    if (t.name && t.unit) tenantByUnit.set(`${t.property}|${t.unit}`, t.name);
  }
  const nameFor = (property: string, unit: string) =>
    tenantByUnit.get(`${property}|${unit}`) || (unit ? `${property} - ${unit}` : property);
  const unitLabel = (property: string, unit: string) =>
    unit ? `${property} - ${unit}` : property || "-";

  // ---- occupancy ----
  let totalUnits = units.length;
  let rentedUnits = units.filter((u) => u.isRented).length;
  if (totalUnits === 0) {
    totalUnits = properties.reduce((a, p) => a + (p.totalUnits || 0), 0);
    rentedUnits = properties.reduce((a, p) => a + (p.rentedUnits || 0), 0);
  }
  const vacantUnits = Math.max(0, totalUnits - rentedUnits);
  const occupancyPct = totalUnits ? Math.round((rentedUnits / totalUnits) * 100) : 0;

  // ---- current-month rent collection ----
  const monthRows = revenue.filter((r) => {
    const p = revPeriod(r);
    return p.year === curYear && p.month === curMonth;
  });
  let collected = 0;
  let pending = 0;
  let overdueMonth = 0;
  let paidCount = 0;
  for (const r of monthRows) {
    const s = lc(r.paymentStatus);
    if (s === "paid") {
      collected += r.totalAmount;
      paidCount += 1;
    } else if (s === "overdue") {
      overdueMonth += r.totalAmount;
    } else {
      pending += r.totalAmount; // pending / partial / anything not paid|overdue
    }
  }
  const billed = collected + pending + overdueMonth;
  const ratePct = billed ? Math.round((collected / billed) * 100) : 0;

  // ---- overdue across all months (overdue is overdue regardless of period) ----
  const overdueRows = revenue.filter((r) => lc(r.paymentStatus) === "overdue" && r.totalAmount > 0);
  const overdueTotal = overdueRows.reduce((a, r) => a + r.totalAmount, 0);
  const overdueTenants: OverdueTenant[] = overdueRows
    .map((r) => {
      const p = revPeriod(r);
      const ref = r.paymentDate || (p.year ? `${p.year}-${String(p.month).padStart(2, "0")}-28` : "");
      return {
        id: r.id,
        tenant: nameFor(r.property, r.unit),
        unit: unitLabel(r.property, r.unit),
        amount: r.totalAmount,
        daysOverdue: daysSince(ref, today),
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.amount - a.amount);

  // ---- outstanding (all unpaid pending rent, any period) ----
  const outstanding = revenue
    .filter((r) => {
      const s = lc(r.paymentStatus);
      return s !== "paid" && s !== "overdue" && r.totalAmount > 0;
    })
    .reduce((a, r) => a + r.totalAmount, 0);
  const pendingCount = revenue.filter((r) => {
    const s = lc(r.paymentStatus);
    return s !== "paid" && s !== "overdue" && r.totalAmount > 0;
  }).length;

  // ---- rent due today (unpaid with due/payment date == today) ----
  const dueToday = revenue.filter((r) => {
    const s = lc(r.paymentStatus);
    return s !== "paid" && r.paymentDate?.slice(0, 10) === todayStr;
  }).length;

  // ---- net profit this month ----
  const monthExpenses = expenses
    .filter((e) => {
      if (e.year && e.month) return e.year === curYear && e.month === curMonth;
      const d = e.expenseDate ? new Date(e.expenseDate) : null;
      return d && d.getFullYear() === curYear && d.getMonth() + 1 === curMonth;
    })
    .reduce((a, e) => a + e.amount, 0);
  const netProfit = collected - monthExpenses;

  // ---- maintenance ----
  const openMaint = maintenance.filter((m) => lc(m.status) !== "completed");
  const isMaintOverdue = (m: MaintenanceRow) =>
    lc(m.status) !== "completed" && m.dueDate ? new Date(`${m.dueDate}T00:00:00`) < today : false;
  let urgent = 0;
  let pendingMaint = 0;
  let inProgress = 0;
  let completed = 0;
  for (const m of maintenance) {
    const st = lc(m.status);
    if (st === "completed") completed += 1;
    else if (st === "in progress" || st === "in_progress") inProgress += 1;
    else pendingMaint += 1;
    if (lc(m.priority) === "urgent" || isMaintOverdue(m)) {
      if (st !== "completed") urgent += 1;
    }
  }
  const topUrgent: UrgentMaintenance[] = openMaint
    .filter((m) => lc(m.priority) === "urgent" || isMaintOverdue(m))
    .sort((a, b) => Number(isMaintOverdue(b)) - Number(isMaintOverdue(a)))
    .slice(0, 4)
    .map((m) => ({
      id: m.id,
      issue: m.name || m.category || "Maintenance issue",
      unit: unitLabel(m.property, m.unit),
      reason: lc(m.priority) === "urgent" ? "urgent" : "overdue",
    }));

  // ---- lease alerts ----
  const leaseRanked = tenants
    .filter((t) => t.leaseEnd)
    .map((t) => ({ t, daysLeft: daysUntil(t.leaseEnd, today) }))
    .filter((x) => !Number.isNaN(x.daysLeft));
  const endingSoon: LeaseAlert[] = leaseRanked
    .filter((x) => x.daysLeft >= 0 && x.daysLeft <= LEASE_SOON_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .map(({ t, daysLeft }) => ({
      id: t.id,
      tenant: t.name || "Tenant",
      unit: unitLabel(t.property, t.unit),
      leaseEnd: t.leaseEnd,
      daysLeft,
    }));
  const expired = leaseRanked.filter((x) => x.daysLeft < 0).length;

  // ---- property health ----
  const propertyHealth: PropertyHealth[] = properties.map((p) => {
    const propUnits = units.filter((u) => u.property === p.name);
    const total = propUnits.length || p.totalUnits || 0;
    const rented = propUnits.length
      ? propUnits.filter((u) => u.isRented).length
      : p.rentedUnits || 0;
    const occ = total ? Math.round((rented / total) * 100) : 0;
    const propRev = monthRows
      .filter((r) => r.property === p.name && lc(r.paymentStatus) === "paid")
      .reduce((a, r) => a + r.totalAmount, 0);
    const propOutstanding = revenue
      .filter((r) => r.property === p.name && lc(r.paymentStatus) !== "paid" && r.totalAmount > 0)
      .reduce((a, r) => a + r.totalAmount, 0);
    const propIssues = openMaint.filter((m) => m.property === p.name).length;
    const urgentIssues = openMaint.filter(
      (m) => m.property === p.name && (lc(m.priority) === "urgent" || isMaintOverdue(m))
    ).length;

    const isWhole = lc(p.rentalModel) === "whole_unit";
    const modelLabel = isWhole ? "Whole Unit" : "Room Rental";
    const unitWord = isWhole ? (total === 1 ? "unit" : "units") : total === 1 ? "room" : "rooms";

    // Status: Critical = vacant / urgent issue; Attention = outstanding / partial
    // vacancy / pending maintenance; Good = full, paid, no urgent issues.
    let status: PropertyHealth["status"];
    if (total === 0 || occ === 0 || urgentIssues > 0) status = "Critical";
    else if (propOutstanding > 0 || occ < 100 || propIssues > 0) status = "Attention";
    else status = "Good";

    // Reason: dynamically generated from the actual data (most urgent first).
    let reason: string;
    if (total === 0) reason = "No units configured yet";
    else if (occ === 0) reason = "Property is vacant and generating no revenue";
    else if (urgentIssues > 0) reason = "Urgent maintenance requires attention";
    else if (propOutstanding > 0) reason = "Outstanding rent needs follow-up";
    else if (occ < 100) reason = `Partial vacancy — ${rented} of ${total} ${unitWord} rented`;
    else if (propIssues > 0) reason = "Open maintenance to monitor";
    else reason = "Fully occupied with no urgent issues";

    return {
      name: p.name,
      rentalModel: p.rentalModel,
      modelLabel,
      unitWord,
      totalUnits: total,
      rentedUnits: rented,
      occupancyPct: occ,
      monthlyRevenue: propRev,
      outstanding: propOutstanding,
      issues: propIssues,
      urgentIssues,
      status,
      reason,
    };
  });
  const statusRank = { Critical: 0, Attention: 1, Good: 2 } as const;
  propertyHealth.sort(
    (a, b) => statusRank[a.status] - statusRank[b.status] || b.outstanding - a.outstanding
  );

  // ---- recent activity (payments, expenses, maintenance, invoices) ----
  const acts: (Activity & { ts: number })[] = [];
  for (const r of revenue) {
    if (!r.paymentDate) continue;
    const ts = new Date(r.paymentDate).getTime();
    if (Number.isNaN(ts)) continue;
    const s = lc(r.paymentStatus);
    acts.push({
      who: nameFor(r.property, r.unit),
      what: s === "paid" ? "Rent payment received" : `Payment ${s || "recorded"}`,
      when: timeAgo(r.paymentDate, today),
      amount: `+${fmtMYR(r.totalAmount)}`,
      status: s === "paid" ? "success" : s === "overdue" ? "danger" : "warning",
      ts,
    });
    if (r.invoiceSent && r.invoiceSentAt) {
      const its = new Date(r.invoiceSentAt).getTime();
      if (!Number.isNaN(its)) {
        acts.push({
          who: unitLabel(r.property, r.unit),
          what: `Invoice ${r.invoiceNumber || "sent"}`,
          when: timeAgo(r.invoiceSentAt, today),
          amount: "Invoice",
          status: "info",
          ts: its,
        });
      }
    }
  }
  for (const e of expenses) {
    if (!e.expenseDate) continue;
    const ts = new Date(e.expenseDate).getTime();
    if (Number.isNaN(ts)) continue;
    acts.push({
      who: e.property,
      what: `${e.category || "Expense"} expense`,
      when: timeAgo(e.expenseDate, today),
      amount: `-${fmtMYR(e.amount)}`,
      status: e.isIrregular ? "warning" : "danger",
      ts,
    });
  }
  for (const m of maintenance) {
    const dateRef = m.reportedDate;
    if (!dateRef) continue;
    const ts = new Date(`${dateRef}T00:00:00`).getTime();
    if (Number.isNaN(ts)) continue;
    const st = lc(m.status);
    acts.push({
      who: unitLabel(m.property, m.unit),
      what: st === "completed" ? `Maintenance resolved: ${m.name}` : `Maintenance: ${m.name}`,
      when: timeAgo(dateRef, today),
      amount: st === "completed" ? "Resolved" : "Open",
      status: st === "completed" ? "success" : lc(m.priority) === "urgent" ? "danger" : "info",
      ts,
    });
  }
  const activity = acts.sort((a, b) => b.ts - a.ts).slice(0, 6).map(({ ts: _ts, ...a }) => a);

  // ---- recent payments (paid only) ----
  const recentPayments: RecentPayment[] = revenue
    .filter((r) => lc(r.paymentStatus) === "paid" && r.paymentDate)
    .map((r) => ({ r, ts: new Date(r.paymentDate).getTime() }))
    .filter((x) => !Number.isNaN(x.ts))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 6)
    .map(({ r, ts }) => ({
      id: r.id,
      name: nameFor(r.property, r.unit),
      amount: r.totalAmount,
      unit: unitLabel(r.property, r.unit),
      when: timeAgo(new Date(ts).toISOString(), today),
    }));

  return {
    kpis: {
      collectedThisMonth: collected,
      paidCount,
      billedCount: monthRows.length,
      outstanding,
      pendingCount,
      overdue: overdueTotal,
      overdueTenantCount: overdueRows.length,
      occupancyPct,
      rentedUnits,
      totalUnits,
      vacantUnits,
      netProfit,
    },
    checkup: {
      dueToday,
      overduePayments: overdueRows.length,
      urgentMaintenance: urgent,
      leasesEndingSoon: endingSoon.length,
      vacantUnits,
    },
    collection: { collected, pending, overdue: overdueMonth, billed, ratePct },
    overdueTenants,
    maintenance: { urgent, pending: pendingMaint, inProgress, completed, topUrgent },
    leaseAlerts: { endingSoon, expired },
    propertyHealth,
    activity,
    recentPayments,
  };
}
