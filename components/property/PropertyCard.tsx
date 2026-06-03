"use client";

import Link from "next/link";
import { useState } from "react";
import {
  RENTAL_MODEL_LABEL,
  STATUS_LABEL,
  type Property,
} from "@/types/rental";
import { PROPERTY_FALLBACK_IMAGE } from "@/data/rentalData";

function formatMYR(value: number | undefined) {
  if (value === undefined || value === null) return "-";
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
    case "under_service":
      return "ui-chip-warning";
    default:
      return "";
  }
}

export function PropertyCard({ property }: { property: Property }) {
  const [imgSrc, setImgSrc] = useState(property.image_url || PROPERTY_FALLBACK_IMAGE);

  const isInactive = property.status === "inactive";
  const total = property.total_units || 0;
  const rented = property.rented_units || 0;
  const occPct = total > 0 ? Math.round((rented / total) * 100) : 0;
  const unitWord = property.rental_model === "whole_unit" ? "unit" : "rooms";

  const revenue = property.ytd_revenue ?? 0;
  const expenses = property.ytd_expenses ?? 0;
  const net = revenue - expenses;

  const detailHref = `/admin/properties/${property.id}`;

  return (
    <Link
      href={detailHref}
      className="ui-card flex flex-col overflow-hidden transition hover:shadow-md focus:outline-none focus-visible:ring-2"
      style={{
        opacity: isInactive ? 0.7 : 1,
        // @ts-expect-error css var
        "--tw-ring-color": "var(--accent-ring)",
      }}
    >
      <div className="relative h-36 w-full overflow-hidden" style={{ background: "var(--surface-subtle)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={property.name}
          className="w-full h-full object-cover"
          onError={() => setImgSrc(PROPERTY_FALLBACK_IMAGE)}
        />
        <div className="absolute top-3 left-3">
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

      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="min-w-0">
          <h3
            className="text-base font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {property.name}
          </h3>
          <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>
            {property.city}{property.state ? `, ${property.state}` : ""}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span style={{ color: "var(--text-secondary)" }}>
              {rented} of {total} {unitWord} rented
            </span>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {occPct}%
            </span>
          </div>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ background: "var(--surface-subtle)" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${occPct}%`, background: "var(--accent)" }}
            />
          </div>
        </div>

        <div
          className="grid grid-cols-3 gap-3 pt-3 mt-auto"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          <KPI label="Revenue" value={formatMYR(revenue)} />
          <KPI label="Expenses" value={formatMYR(expenses)} />
          <KPI
            label="Net"
            value={formatMYR(net)}
            color={net >= 0 ? "var(--success)" : "var(--danger)"}
          />
        </div>
      </div>
    </Link>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p
        className="text-sm font-semibold mt-0.5 tabular-nums"
        style={{ color: color ?? "var(--text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}
