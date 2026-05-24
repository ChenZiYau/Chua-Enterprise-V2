"use client";

import Link from "next/link";
import { useState } from "react";
import {
  RENTAL_MODEL_LABEL,
  STATUS_LABEL,
  type Property,
} from "@/types/rental";
import { PROPERTY_FALLBACK_IMAGE } from "@/data/rentalData";

function formatCurrency(value: number | undefined) {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusChipClass(status: Property["status"]) {
  switch (status) {
    case "active":
      return "ui-chip-success";
    case "inactive":
      return "";
    case "under_service":
      return "ui-chip-warning";
  }
}

export function PropertyCard({ property }: { property: Property }) {
  const [imgSrc, setImgSrc] = useState(property.image_url || PROPERTY_FALLBACK_IMAGE);

  const isInactive = property.status === "inactive";
  const occupancyLabel =
    property.rental_model === "whole_unit"
      ? `${property.rented_units} / ${property.total_units} unit rented`
      : `${property.rented_units} / ${property.total_units} rooms rented`;
  const occPct = property.total_units > 0
    ? Math.round((property.rented_units / property.total_units) * 100)
    : 0;

  const revenue = property.ytd_revenue ?? 0;
  const expenses = property.ytd_expenses ?? 0;
  const net = revenue - expenses;

  const detailHref = `/admin/properties/${property.id}`;
  const revenueHref = `/admin/revenue/new?property=${property.id}`;
  const expenseHref = `/admin/expenses/new?property=${property.id}`;
  const editHref = `/admin/properties/${property.id}/edit`;

  return (
    <article
      className="ui-card flex flex-col overflow-hidden transition"
      style={{ opacity: isInactive ? 0.7 : 1 }}
    >
      <div className="relative h-44 w-full overflow-hidden" style={{ background: "var(--surface-subtle)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={property.name}
          className="w-full h-full object-cover"
          onError={() => setImgSrc(PROPERTY_FALLBACK_IMAGE)}
        />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span
            className="ui-chip"
            style={{ background: "rgba(15,17,22,0.72)", color: "#fff" }}
          >
            {RENTAL_MODEL_LABEL[property.rental_model]}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className={"ui-chip " + statusChipClass(property.status)}>
            {STATUS_LABEL[property.status]}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5 flex-1">
        <div className="min-w-0">
          <h3
            className="text-base font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {property.name}
          </h3>
          <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>
            {property.address}
          </p>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            {property.city}
            {property.state ? `, ${property.state}` : ""}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span style={{ color: "var(--text-secondary)" }}>{occupancyLabel}</span>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{occPct}%</span>
          </div>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ background: "var(--surface-subtle)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${occPct}%`,
                background: "var(--accent)",
              }}
            />
          </div>
        </div>

        <div
          className="grid grid-cols-3 gap-2 rounded-lg p-3"
          style={{ background: "var(--surface-muted)" }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Revenue</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
              {formatCurrency(revenue)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Expenses</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
              {formatCurrency(expenses)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Net P&amp;L</p>
            <p
              className="text-sm font-semibold mt-0.5"
              style={{ color: net >= 0 ? "var(--success)" : "var(--danger)" }}
            >
              {formatCurrency(net)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-auto pt-1">
          <Link href={detailHref} className="ui-btn ui-btn-primary">
            Open Property
          </Link>
          <Link href={revenueHref} className="ui-btn">
            Enter Revenue
          </Link>
          <Link href={expenseHref} className="ui-btn">
            Add Expense
          </Link>
          <Link
            href={editHref}
            className="ui-btn"
            aria-label={`Edit ${property.name}`}
            title="Edit Property"
          >
            Edit
          </Link>
        </div>
      </div>
    </article>
  );
}
