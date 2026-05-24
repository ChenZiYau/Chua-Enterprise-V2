"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useRental } from "@/context/RentalContext";
import {
  RENTAL_MODEL_LABEL,
  STATUS_LABEL,
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

export default function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { getProperty, softDeleteProperty } = useRental();
  const property = getProperty(id);
  const [imgSrc, setImgSrc] = useState(
    property?.image_url || PROPERTY_FALLBACK_IMAGE
  );

  if (!property) {
    return (
      <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-4">
        <Link href="/admin/properties" className="text-sm" style={{ color: "var(--text-muted)" }}>
          ← Back to Properties
        </Link>
        <div className="ui-card p-12 text-center">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Property not found
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            The property you’re looking for doesn’t exist or was removed.
          </p>
        </div>
      </div>
    );
  }

  const occPct = property.total_units > 0
    ? Math.round((property.rented_units / property.total_units) * 100)
    : 0;
  const occLabel = property.rental_model === "whole_unit"
    ? `${property.rented_units} / ${property.total_units} unit rented`
    : `${property.rented_units} / ${property.total_units} rooms rented`;
  const revenue = property.ytd_revenue ?? 0;
  const expenses = property.ytd_expenses ?? 0;
  const net = revenue - expenses;

  function handleDelete() {
    if (!confirm("Move this property to Trash?")) return;
    softDeleteProperty(property!.id);
    router.push("/admin/properties");
  }

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">
      <Link href="/admin/properties" className="text-sm" style={{ color: "var(--text-muted)" }}>
        ← Back to Properties
      </Link>

      <div className="ui-card overflow-hidden">
        <div className="relative h-56 w-full" style={{ background: "var(--surface-subtle)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={property.name}
            className="w-full h-full object-cover"
            onError={() => setImgSrc(PROPERTY_FALLBACK_IMAGE)}
          />
          <div className="absolute top-4 left-4 flex gap-2">
            <span className="ui-chip" style={{ background: "rgba(15,17,22,0.72)", color: "#fff" }}>
              {RENTAL_MODEL_LABEL[property.rental_model]}
            </span>
            <span
              className={
                "ui-chip " +
                (property.status === "active"
                  ? "ui-chip-success"
                  : property.status === "under_service"
                  ? "ui-chip-warning"
                  : "")
              }
            >
              {STATUS_LABEL[property.status]}
            </span>
          </div>
        </div>

        <div className="p-6 lg:p-8 flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                {property.name}
              </h2>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {property.address}
              </p>
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                {property.city}{property.state ? `, ${property.state}` : ""}{property.postcode ? ` ${property.postcode}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/revenue/new?property=${property.id}`} className="ui-btn ui-btn-primary">
                Enter Revenue
              </Link>
              <Link href={`/admin/expenses/new?property=${property.id}`} className="ui-btn">
                Add Expense
              </Link>
              <Link href={`/admin/properties/${property.id}/edit`} className="ui-btn">
                Edit
              </Link>
              <button type="button" className="ui-btn" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>

          {property.description ? (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {property.description}
            </p>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Stat label="Occupancy" value={`${occPct}%`} sub={occLabel} />
            <Stat label="Revenue (YTD)" value={formatCurrency(revenue)} />
            <Stat label="Expenses (YTD)" value={formatCurrency(expenses)} />
            <Stat
              label="Net P&L (YTD)"
              value={formatCurrency(net)}
              valueColor={net >= 0 ? "var(--success)" : "var(--danger)"}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="ui-card p-6">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Recent Revenue
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Revenue entries will appear here. Use{" "}
            <Link href={`/admin/revenue/new?property=${property.id}`} style={{ color: "var(--accent)" }}>
              Enter Revenue
            </Link>{" "}
            to add one.
          </p>
        </div>
        <div className="ui-card p-6">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Recent Expenses
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Expense entries will appear here. Use{" "}
            <Link href={`/admin/expenses/new?property=${property.id}`} style={{ color: "var(--accent)" }}>
              Add Expense
            </Link>{" "}
            to add one.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}
    >
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p
        className="text-lg font-semibold mt-1"
        style={{ color: valueColor ?? "var(--text-primary)" }}
      >
        {value}
      </p>
      {sub ? (
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
      ) : null}
    </div>
  );
}
