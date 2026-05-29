"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useRental } from "@/context/RentalContext";
import { RENTAL_MODEL_LABEL, STATUS_LABEL, type Property } from "@/types/rental";
import { PROPERTY_FALLBACK_IMAGE } from "@/data/rentalData";
import { EntryDrawer } from "@/components/property/EntryDrawer";
import { RoomCalendarDrawer } from "@/components/property/RoomCalendarDrawer";

function formatMYR(value: number | undefined) {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("en-MY", {
    style: "currency", currency: "MYR", maximumFractionDigits: 0,
  }).format(value);
}

function statusChipClass(status: Property["status"]) {
  switch (status) {
    case "active": return "ui-chip-success";
    case "under_service": return "ui-chip-warning";
    default: return "";
  }
}

type CalendarState = { open: false } | { open: true; unitId: string; roomLabel: string };
type DrawerState =
  | { open: false }
  | { open: true; tab: "revenue" | "expense"; unitId: string; unitName: string; month?: number; year?: number };

export default function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { getProperty, softDeleteProperty, getUnitsForProperty, getPropertyYTD } = useRental();

  const property = getProperty(id);
  const units = getUnitsForProperty(id);
  const [imgSrc, setImgSrc] = useState(property?.image_url || PROPERTY_FALLBACK_IMAGE);
  const [calendar, setCalendar] = useState<CalendarState>({ open: false });
  const [drawer, setDrawer] = useState<DrawerState>({ open: false });

  if (!property) {
    return (
      <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-4">
        <BackLink href="/admin/properties" label="Back to Properties" />
        <div className="ui-card p-12 text-center">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Property not found
          </h2>
        </div>
      </div>
    );
  }

  const now = new Date();
  const curYear = now.getFullYear();

  const ytd = getPropertyYTD(id, curYear);
  const rentedCount = units.filter((u) => u.is_rented).length;
  const total = units.length;
  const occPct = total > 0 ? Math.round((rentedCount / total) * 100) : 0;
  const isWhole = property.rental_model === "whole_unit";
  const unitWord = isWhole ? "unit" : "rooms";

  function handleDelete() {
    if (!confirm("Move this property to Trash?")) return;
    softDeleteProperty(property!.id);
    router.push("/admin/properties");
  }

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-8 max-w-6xl">
      <BackLink href="/admin/properties" label="Back to Properties" />

      {/* Hero */}
      <header className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start">
        <div
          className="relative aspect-[4/3] md:aspect-square w-full rounded-xl overflow-hidden"
          style={{ background: "var(--surface-subtle)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={property.name}
            className="w-full h-full object-cover"
            onError={() => setImgSrc(PROPERTY_FALLBACK_IMAGE)}
          />
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="ui-chip">{RENTAL_MODEL_LABEL[property.rental_model]}</span>
                <span className={"ui-chip " + statusChipClass(property.status)}>
                  {STATUS_LABEL[property.status]}
                </span>
              </div>
              <h1 className="text-2xl font-semibold mt-3 tracking-tight" style={{ color: "var(--text-primary)" }}>
                {property.name}
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{property.address}</p>
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                {property.city}{property.state ? `, ${property.state}` : ""}{property.postcode ? ` ${property.postcode}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href={`/admin/properties/${property.id}/edit`} className="ui-btn">Edit</Link>
              <button type="button" className="ui-btn" onClick={handleDelete}>Move to Trash</button>
            </div>
          </div>
          {property.description && (
            <p className="text-sm leading-relaxed max-w-2xl" style={{ color: "var(--text-secondary)" }}>
              {property.description}
            </p>
          )}
        </div>
      </header>

      {/* KPI strip */}
      <section
        className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden"
        style={{ background: "var(--border-soft)", border: "1px solid var(--border-soft)" }}
      >
        <Stat label="Occupancy" value={`${occPct}%`} sub={`${rentedCount} of ${total} ${unitWord}`} />
        <Stat label={`Revenue ${curYear}`} value={formatMYR(ytd.revenue)} />
        <Stat label={`Expenses ${curYear}`} value={formatMYR(ytd.expenses)} />
        <Stat label="Net YTD" value={formatMYR(ytd.net)} valueColor={ytd.net >= 0 ? "var(--success)" : "var(--danger)"} />
      </section>

      {/* Rooms / Units */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          eyebrow={isWhole ? "Whole Unit" : "Rooms"}
          title={isWhole ? "Rented as one unit" : `${total} rooms in this property`}
          hint="Revenue is recorded per room or unit. Click a room to view the monthly calendar."
          action={
            units.length > 0 ? (
              <button
                type="button"
                className="ui-btn ui-btn-primary"
                onClick={() => {
                  const first = units[0];
                  setDrawer({ open: true, tab: "revenue", unitId: first.id, unitName: first.name });
                }}
              >
                + Add Entry
              </button>
            ) : null
          }
        />

        {units.length === 0 ? (
          <EmptyRow text="No rooms recorded yet. Edit the property to set up rooms." />
        ) : (
          <div className="ui-card overflow-hidden">
            <ul>
              {units.map((unit, i) => (
                <li
                  key={unit.id}
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-soft)" }}
                >
                  <button
                    type="button"
                    onClick={() => setCalendar({ open: true, unitId: unit.id, roomLabel: unit.name })}
                    className="w-full flex items-center gap-4 px-5 py-3.5 text-left transition hover:bg-[var(--surface-muted)]"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: unit.is_rented ? "var(--accent-soft)" : "var(--surface-muted)",
                        color: unit.is_rented ? "var(--accent)" : "var(--text-faint)",
                      }}
                    >
                      {unit.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {unit.name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                        {unit.tenant_name ?? "Vacant"}
                        {unit.rental_rate ? ` · RM ${unit.rental_rate}/mo` : ""}
                        {" · click to view monthly rent"}
                      </p>
                    </div>
                    <span className={"ui-chip " + (unit.is_rented ? "ui-chip-success" : "")}>
                      {unit.is_rented ? "Rented" : "Available"}
                    </span>
                    <span aria-hidden className="text-base" style={{ color: "var(--text-faint)" }}>→</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Calendar drawer — click room row → month grid */}
      <RoomCalendarDrawer
        open={calendar.open}
        onClose={() => setCalendar({ open: false })}
        propertyName={property.name}
        roomLabel={calendar.open ? calendar.roomLabel : ""}
        unitId={calendar.open ? calendar.unitId : ""}
        onLogMonth={(monthIdx, year) => {
          if (!calendar.open) return;
          const { unitId, roomLabel } = calendar;
          setCalendar({ open: false });
          setDrawer({ open: true, tab: "revenue", unitId, unitName: roomLabel, month: monthIdx, year });
        }}
      />

      {/* Entry drawer — revenue + expense form */}
      <EntryDrawer
        open={drawer.open}
        onClose={() => setDrawer({ open: false })}
        propertyName={property.name}
        propertyId={property.id}
        unitId={drawer.open ? drawer.unitId : ""}
        unitName={drawer.open ? drawer.unitName : ""}
        initialTab={drawer.open ? drawer.tab : "revenue"}
        preselectedMonth={drawer.open ? drawer.month : undefined}
        preselectedYear={drawer.open ? drawer.year : undefined}
      />
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-xs inline-flex items-center gap-1.5 w-fit" style={{ color: "var(--text-muted)" }}>
      <span aria-hidden>←</span>{label}
    </Link>
  );
}

function Stat({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="p-5" style={{ background: "var(--surface)" }}>
      <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>{label}</p>
      <p className="text-xl font-semibold mt-1.5 tabular-nums" style={{ color: valueColor ?? "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function SectionHeader({ eyebrow, title, hint, action }: { eyebrow: string; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>{eyebrow}</p>
        <h3 className="text-base font-semibold mt-1" style={{ color: "var(--text-primary)" }}>{title}</h3>
        {hint && <p className="text-xs mt-1.5 max-w-2xl leading-relaxed" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-lg px-5 py-6 text-center text-xs" style={{ color: "var(--text-muted)", border: "1px dashed var(--border-strong)", background: "var(--surface-muted)" }}>
      {text}
    </div>
  );
}
