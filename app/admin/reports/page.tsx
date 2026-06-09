"use client";

import { useMemo, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { DatePickerField } from "@/components/ui/DatePicker";
import {
  MONTHS,
  MONTHS_FULL,
  EXPENSE_CATEGORY_LABEL,
  PAYMENT_STATUS_LABEL,
  type PaymentStatus,
} from "@/types/rental";

const CUR_YEAR = new Date().getFullYear();
const CUR_MONTH = new Date().getMonth() + 1;

function fmt(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

const STATUS_COLORS: Record<PaymentStatus, { bg: string; text: string }> = {
  paid: { bg: "rgba(47,158,111,0.10)", text: "var(--success)" },
  partial: { bg: "rgba(224,162,61,0.10)", text: "var(--warning)" },
  pending: { bg: "rgba(93,95,239,0.10)", text: "var(--accent)" },
  overdue: { bg: "rgba(211,84,84,0.10)", text: "var(--danger)" },
};

export default function ReportsPage() {
  const {
    revenueEntries,
    expenseEntries,
    visibleProperties,
    units,
    getUnit,
  } = useRental();

  const [year, setYear] = useState(CUR_YEAR);
  const [month, setMonth] = useState(CUR_MONTH);

  const data = useMemo(() => {
    const revs = revenueEntries.filter((e) => e.year === year && e.month === month);
    const exps = expenseEntries.filter((e) => e.year === year && e.month === month);

    const totalRevenue = revs.reduce((s, e) => s + e.total_amount, 0);
    const totalExpenses = exps.reduce((s, e) => s + e.amount, 0);
    const net = totalRevenue - totalExpenses;

    const paid = revs
      .filter((e) => e.payment_status === "paid")
      .reduce((s, e) => s + e.total_amount, 0);
    const outstanding = revs
      .filter((e) => e.payment_status !== "paid")
      .reduce((s, e) => s + e.total_amount, 0);

    const byProperty = visibleProperties
      .map((p) => {
        const rev = revs
          .filter((e) => e.property_id === p.id)
          .reduce((s, e) => s + e.total_amount, 0);
        const exp = exps
          .filter((e) => e.property_id === p.id)
          .reduce((s, e) => s + e.amount, 0);
        const propUnits = units.filter((u) => u.property_id === p.id);
        const rented = propUnits.filter((u) => u.is_rented).length;
        return {
          property: p,
          revenue: rev,
          expenses: exp,
          net: rev - exp,
          totalUnits: propUnits.length,
          rentedUnits: rented,
        };
      })
      .filter((r) => r.revenue > 0 || r.expenses > 0 || r.totalUnits > 0);

    const expensesByCategory = exps.reduce<Record<string, number>>((acc, e) => {
      const key =
        e.category === "other" && e.custom_category
          ? e.custom_category
          : EXPENSE_CATEGORY_LABEL[e.category];
      acc[key] = (acc[key] ?? 0) + e.amount;
      return acc;
    }, {});

    const totalUnits = units.length;
    const rentedUnits = units.filter((u) => u.is_rented).length;
    const occupancy = totalUnits > 0 ? (rentedUnits / totalUnits) * 100 : 0;

    const statusBuckets: Record<PaymentStatus, { count: number; amount: number }> = {
      paid: { count: 0, amount: 0 },
      partial: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 },
    };
    revs.forEach((e) => {
      const s = e.payment_status ?? "pending";
      statusBuckets[s].count += 1;
      statusBuckets[s].amount += e.total_amount;
    });

    return {
      revs,
      exps,
      totalRevenue,
      totalExpenses,
      net,
      paid,
      outstanding,
      byProperty,
      expensesByCategory,
      totalUnits,
      rentedUnits,
      occupancy,
      statusBuckets,
    };
  }, [revenueEntries, expenseEntries, visibleProperties, units, year, month]);

  const generatedAt = new Date().toLocaleString("en-MY", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6 print-area">
      <div className="flex flex-wrap items-start justify-between gap-4 no-print">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Monthly Report
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Full dashboard summary for the selected month. Use Print to save as PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <DatePickerField
            granularity="month"
            className="w-[170px]"
            ariaLabel="Report month"
            value={`${year}-${String(month).padStart(2, "0")}`}
            onChange={(v) => {
              const [yy, mm] = v.split("-").map(Number);
              setYear(yy);
              setMonth(mm);
            }}
          />
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            onClick={() => window.print()}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="ui-card p-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Chua Enterprise - Monthly Report
          </p>
          <h1 className="text-2xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>
            {MONTHS_FULL[month - 1]} {year}
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Generated {generatedAt}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Net for the Month
          </p>
          <p
            className="text-2xl font-bold mt-1 tabular-nums"
            style={{ color: data.net >= 0 ? "var(--success)" : "var(--danger)" }}
          >
            {fmt(data.net)}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Revenue" value={fmt(data.totalRevenue)} tone="success" />
        <Kpi label="Expenses" value={fmt(data.totalExpenses)} tone="danger" />
        <Kpi label="Paid / Outstanding" value={`${fmt(data.paid)} / ${fmt(data.outstanding)}`} />
        <Kpi
          label="Occupancy"
          value={`${data.occupancy.toFixed(0)}%`}
          hint={`${data.rentedUnits} of ${data.totalUnits} units`}
        />
      </section>

      <section className="ui-card p-6">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Revenue & Expenses by Property
        </h3>
        {data.byProperty.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No activity in this period.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="text-left text-xs uppercase tracking-wider pb-2">Property</th>
                <th className="text-left text-xs uppercase tracking-wider pb-2">Occupancy</th>
                <th className="text-right text-xs uppercase tracking-wider pb-2">Revenue</th>
                <th className="text-right text-xs uppercase tracking-wider pb-2">Expenses</th>
                <th className="text-right text-xs uppercase tracking-wider pb-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.byProperty.map((r) => (
                <tr key={r.property.id} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                  <td className="py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>
                    {r.property.name}
                  </td>
                  <td className="py-2.5" style={{ color: "var(--text-secondary)" }}>
                    {r.rentedUnits}/{r.totalUnits}
                  </td>
                  <td className="py-2.5 text-right tabular-nums" style={{ color: "var(--success)" }}>
                    {fmt(r.revenue)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums" style={{ color: "var(--danger)" }}>
                    {fmt(r.expenses)}
                  </td>
                  <td
                    className="py-2.5 text-right font-semibold tabular-nums"
                    style={{ color: r.net >= 0 ? "var(--text-primary)" : "var(--danger)" }}
                  >
                    {fmt(r.net)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold" style={{ borderColor: "var(--border-soft)" }}>
                <td className="pt-3" style={{ color: "var(--text-primary)" }}>Total</td>
                <td />
                <td className="pt-3 text-right tabular-nums" style={{ color: "var(--success)" }}>
                  {fmt(data.totalRevenue)}
                </td>
                <td className="pt-3 text-right tabular-nums" style={{ color: "var(--danger)" }}>
                  {fmt(data.totalExpenses)}
                </td>
                <td
                  className="pt-3 text-right tabular-nums"
                  style={{ color: data.net >= 0 ? "var(--text-primary)" : "var(--danger)" }}
                >
                  {fmt(data.net)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="ui-card p-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Expense Breakdown by Category
          </h3>
          {Object.keys(data.expensesByCategory).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No expenses recorded.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {Object.entries(data.expensesByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => {
                  const pct = data.totalExpenses > 0 ? (amt / data.totalExpenses) * 100 : 0;
                  return (
                    <li key={cat} className="flex items-center justify-between text-sm">
                      <span style={{ color: "var(--text-secondary)" }}>
                        {cat}
                        <span className="ml-2 text-xs" style={{ color: "var(--text-faint)" }}>
                          {pct.toFixed(0)}%
                        </span>
                      </span>
                      <span className="tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
                        {fmt(amt)}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>

        <div className="ui-card p-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Payment Status
          </h3>
          <ul className="flex flex-col gap-2">
            {(Object.keys(data.statusBuckets) as PaymentStatus[]).map((s) => {
              const sc = STATUS_COLORS[s];
              const b = data.statusBuckets[s];
              return (
                <li key={s} className="flex items-center justify-between text-sm">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: sc.bg, color: sc.text }}
                  >
                    {PAYMENT_STATUS_LABEL[s]}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {b.count} {b.count === 1 ? "entry" : "entries"}
                  </span>
                  <span className="tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
                    {fmt(b.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="ui-card p-6">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Revenue Entries - {MONTHS[month - 1]} {year}
        </h3>
        {data.revs.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No revenue entries for this period.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="text-left text-xs uppercase tracking-wider pb-2">Property</th>
                <th className="text-left text-xs uppercase tracking-wider pb-2">Unit</th>
                <th className="text-right text-xs uppercase tracking-wider pb-2">Amount</th>
                <th className="text-center text-xs uppercase tracking-wider pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.revs.map((e) => {
                const p = visibleProperties.find((x) => x.id === e.property_id);
                const u = getUnit(e.unit_id);
                const sc = STATUS_COLORS[e.payment_status ?? "pending"];
                return (
                  <tr key={e.id} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="py-2" style={{ color: "var(--text-primary)" }}>
                      {p?.name ?? e.property_id}
                    </td>
                    <td className="py-2" style={{ color: "var(--text-secondary)" }}>
                      {u?.name ?? e.unit_id}
                    </td>
                    <td
                      className="py-2 text-right tabular-nums font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {fmt(e.total_amount)}
                    </td>
                    <td className="py-2 text-center">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: sc.bg, color: sc.text }}
                      >
                        {PAYMENT_STATUS_LABEL[e.payment_status ?? "pending"]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "danger";
}) {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "danger"
        ? "var(--danger)"
        : "var(--text-primary)";
  return (
    <div className="ui-card p-5">
      <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="text-xl font-bold mt-2 tabular-nums" style={{ color }}>
        {value}
      </p>
      {hint && (
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
