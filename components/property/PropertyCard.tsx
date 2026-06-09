"use client";

import Link from "next/link";
import { useState } from "react";
import {
  RENTAL_MODEL_LABEL,
  STATUS_LABEL,
  type Property,
} from "@/types/rental";
import { PROPERTY_FALLBACK_IMAGE } from "@/data/rentalData";
import { QuickEntryModal } from "@/components/property/QuickEntryModal";

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
  const [quickEntry, setQuickEntry] = useState<null | "revenue" | "expense">(null);

  const isInactive = property.status === "inactive";
  const isWhole = property.rental_model === "whole_unit";
  const total = property.total_units || 0;
  const rented = property.rented_units || 0;
  const occPct = total > 0 ? Math.round((rented / total) * 100) : 0;
  const isOccupied = rented > 0;
  const unitWord = isWhole ? "unit" : "rooms";

  const revenue = property.ytd_revenue ?? 0;
  const expenses = property.ytd_expenses ?? 0;
  const net = revenue - expenses;

  const detailHref = `/admin/properties/${property.id}`;

  return (
    <div
      className="ui-card relative flex flex-col overflow-hidden transition hover:shadow-md"
      style={{ opacity: isInactive ? 0.7 : 1 }}
    >
      {/* Stretched overlay link: clicking anywhere on the card (except the
          interactive KPI buttons, which sit above it) opens the detail page. */}
      <Link
        href={detailHref}
        aria-label={`View ${property.name}`}
        className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 rounded-[inherit]"
        style={{
          // @ts-expect-error css var
          "--tw-ring-color": "var(--accent-ring)",
        }}
      />

      <div className="relative h-36 w-full overflow-hidden" style={{ background: "var(--surface-subtle)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={property.name}
          className="w-full h-full object-cover"
          onError={() => setImgSrc(PROPERTY_FALLBACK_IMAGE)}
        />
      </div>

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Labels live in the body (not over the image) so they stay legible */}
        <div className="flex items-center justify-between gap-2">
          <span className="ui-chip">{RENTAL_MODEL_LABEL[property.rental_model]}</span>
          <span className={"ui-chip " + statusChipClass(property.status)}>
            {STATUS_LABEL[property.status]}
          </span>
        </div>

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

        {isWhole ? (
          /* Whole unit is let as one — occupancy ratios are meaningless, so just
             show whether it is occupied or available. */
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: "var(--text-secondary)" }}>Whole unit</span>
            <span className={"ui-chip " + (isOccupied ? "ui-chip-success" : "ui-chip-warning")}>
              {isOccupied ? "Occupied" : "Available"}
            </span>
          </div>
        ) : (
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
        )}

        <div
          className="grid grid-cols-3 gap-3 pt-3 mt-auto"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          <KPIButton
            label="Revenue"
            value={formatMYR(revenue)}
            onClick={() => setQuickEntry("revenue")}
          />
          <KPIButton
            label="Expenses"
            value={formatMYR(expenses)}
            onClick={() => setQuickEntry("expense")}
          />
          <KPI
            label="Net"
            value={formatMYR(net)}
            color={net >= 0 ? "var(--success)" : "var(--danger)"}
          />
        </div>
      </div>

      {/* Quick Entry popup - opened from the Revenue / Expenses KPI buttons */}
      <QuickEntryModal
        open={quickEntry !== null}
        onClose={() => setQuickEntry(null)}
        propertyId={property.id}
        initialTab={quickEntry ?? "revenue"}
      />
    </div>
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

/** A KPI that doubles as a button to open Quick Entry. Sits above the card's
 *  stretched overlay link (relative + z-10) so its click is not swallowed by
 *  navigation. */
function KPIButton({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Add ${label.toLowerCase()}`}
      aria-label={`Add ${label.toLowerCase()}`}
      className="relative z-10 text-left px-2.5 py-1.5 rounded-lg border transition hover:bg-[var(--surface-muted)] hover:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
    >
      <p className="text-[10px] uppercase tracking-wider flex items-center gap-1" style={{ color: "var(--text-faint)" }}>
        {label}
        <span aria-hidden style={{ color: "var(--text-muted)" }}>+</span>
      </p>
      <p className="text-sm font-semibold mt-0.5 tabular-nums" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </button>
  );
}
