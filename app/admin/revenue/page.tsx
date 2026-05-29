"use client";

import { useState } from "react";
import Link from "next/link";
import { useRental } from "@/context/RentalContext";
import { MONTHS } from "@/types/rental";

const CUR_YEAR = new Date().getFullYear();

function fmt(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function RevenuePage() {
  const { revenueEntries, visibleProperties, getUnit } = useRental();
  const [filterYear, setFilterYear] = useState(CUR_YEAR);
  const [filterProp, setFilterProp] = useState("all");

  const filtered = revenueEntries
    .filter((e) => e.year === filterYear)
    .filter((e) => filterProp === "all" || e.property_id === filterProp)
    .sort((a, b) => {
      if (a.property_id !== b.property_id) return a.property_id.localeCompare(b.property_id);
      if (a.month !== b.month) return a.month - b.month;
      return a.unit_id.localeCompare(b.unit_id);
    });

  const totalRevenue = filtered.reduce((s, e) => s + e.total_amount, 0);

  const years = Array.from({ length: 5 }, (_, i) => CUR_YEAR - i);

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Revenue Ledger
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            All rental income across all properties.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="ui-card p-4 flex flex-wrap gap-3 items-center">
        <select
          className="ui-select w-auto min-w-[120px]"
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          className="ui-select w-auto min-w-[180px]"
          value={filterProp}
          onChange={(e) => setFilterProp(e.target.value)}
        >
          <option value="all">All Properties</option>
          {visibleProperties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="ml-auto text-sm font-semibold" style={{ color: "var(--success)" }}>
          Total: {fmt(totalRevenue)}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="ui-card p-12 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No revenue entries found.{" "}
            <Link href="/admin/properties" style={{ color: "var(--accent)" }}>
              Open a property
            </Link>{" "}
            to start entering rent.
          </p>
        </div>
      ) : (
        <div className="ui-card overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: "var(--surface-muted)" }}>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="text-left text-xs uppercase tracking-wider px-5 py-3">Property</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Unit</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Month</th>
                <th className="text-right text-xs uppercase tracking-wider px-4 py-3">Rental</th>
                <th className="text-right text-xs uppercase tracking-wider px-4 py-3">Electricity</th>
                <th className="text-right text-xs uppercase tracking-wider px-5 py-3">Total</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const prop = visibleProperties.find((p) => p.id === entry.property_id);
                const unit = getUnit(entry.unit_id);
                return (
                  <tr
                    key={entry.id}
                    className="border-t"
                    style={{ borderColor: "var(--border-soft)" }}
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/properties/${entry.property_id}`}
                        className="font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {prop?.name ?? entry.property_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                      {unit?.name ?? entry.unit_id}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                      {MONTHS[entry.month - 1]} {entry.year}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: "var(--text-secondary)" }}>
                      {fmt(entry.rental_amount)}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: "var(--text-secondary)" }}>
                      {entry.electricity_amount != null ? fmt(entry.electricity_amount) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold" style={{ color: "var(--success)" }}>
                      {fmt(entry.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.invoice_generated ? (
                        <span className="ui-chip ui-chip-success">✓ Generated</span>
                      ) : (
                        <span className="ui-chip">Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "var(--surface-muted)" }}>
              <tr className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                <td colSpan={5} className="px-5 py-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Total ({filtered.length} entries)
                </td>
                <td className="px-5 py-3 text-right font-bold" style={{ color: "var(--success)" }}>
                  {fmt(totalRevenue)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
