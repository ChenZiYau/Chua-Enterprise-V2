"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useRental } from "@/context/RentalContext";
import {
  RENTAL_MODEL_LABEL,
  STATUS_LABEL,
  type Property,
} from "@/types/rental";
import { PROPERTY_FALLBACK_IMAGE } from "@/data/rentalData";
import { EntryDrawer } from "@/components/property/EntryDrawer";
import { RoomCalendarDrawer } from "@/components/property/RoomCalendarDrawer";

function formatMYR(value: number | undefined) {
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
    case "under_service":
      return "ui-chip-warning";
    default:
      return "";
  }
}

/** Derive room labels from total_units. Real per-room records live on
 *  the (forthcoming) Rooms page — this is the visual representation
 *  required by Rule 1 (revenue belongs to a room/unit). */
function deriveRoomLabels(total: number): string[] {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: Math.max(0, total) }, (_, i) =>
    `Room ${i < letters.length ? letters[i] : i + 1}`
  );
}

type DrawerState =
  | { open: false }
  | { open: true; tab: "revenue" | "expense"; initialRoom?: string };

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
  const [drawer, setDrawer] = useState<DrawerState>({ open: false });
  const [calendarRoom, setCalendarRoom] = useState<string | null>(null);

  if (!property) {
    return (
      <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-4">
        <BackLink href="/admin/properties" label="Back to Properties" />
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

  const total = property.total_units || 0;
  const rented = property.rented_units || 0;
  const occPct = total > 0 ? Math.round((rented / total) * 100) : 0;
  const revenue = property.ytd_revenue ?? 0;
  const expenses = property.ytd_expenses ?? 0;
  const net = revenue - expenses;

  const isWhole = property.rental_model === "whole_unit";
  const unitWord = isWhole ? "unit" : "rooms";
  const rooms = isWhole ? ["Whole Unit"] : deriveRoomLabels(total);

  function handleDelete() {
    if (!confirm("Move this property to Trash?")) return;
    softDeleteProperty(property!.id);
    router.push("/admin/properties");
  }

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-8 max-w-6xl">
      <BackLink href="/admin/properties" label="Back to Properties" />

      {/* Hero header */}
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
                <span className="ui-chip ui-chip-accent">
                  {RENTAL_MODEL_LABEL[property.rental_model]}
                </span>
                <span className={"ui-chip " + statusChipClass(property.status)}>
                  {STATUS_LABEL[property.status]}
                </span>
              </div>
              <h1
                className="text-2xl font-semibold mt-3 tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {property.name}
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {property.address}
              </p>
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                {property.city}
                {property.state ? `, ${property.state}` : ""}
                {property.postcode ? ` ${property.postcode}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href={`/admin/properties/${property.id}/edit`} className="ui-btn">
                Edit
              </Link>
              <button type="button" className="ui-btn" onClick={handleDelete}>
                Move to Trash
              </button>
            </div>
          </div>

          {property.description ? (
            <p
              className="text-sm leading-relaxed max-w-2xl"
              style={{ color: "var(--text-secondary)" }}
            >
              {property.description}
            </p>
          ) : null}
        </div>
      </header>

      {/* KPI strip */}
      <section
        className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden"
        style={{ background: "var(--border-soft)", border: "1px solid var(--border-soft)" }}
      >
        <Stat
          label="Occupancy"
          value={`${occPct}%`}
          sub={`${rented} of ${total} ${unitWord}`}
        />
        <Stat label="Revenue YTD" value={formatMYR(revenue)} />
        <Stat label="Expenses YTD" value={formatMYR(expenses)} />
        <Stat
          label="Net YTD"
          value={formatMYR(net)}
          valueColor={net >= 0 ? "var(--success)" : "var(--danger)"}
        />
      </section>

      {/* Rooms / Units */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          eyebrow={isWhole ? "Whole Unit" : "Rooms"}
          title={isWhole ? "Rented as one unit" : `${total} rooms in this property`}
          hint="Revenue is recorded per room or unit."
          action={
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              onClick={() => setDrawer({ open: true, tab: "revenue" })}
            >
              + Add Entry
            </button>
          }
        />

        {rooms.length === 0 ? (
          <EmptyRow text="No rooms recorded yet. Edit the property to set the total room count." />
        ) : (
          <div className="ui-card overflow-hidden">
            <ul>
              {rooms.map((label, i) => {
                const isRented = i < rented;
                return (
                  <li
                    key={label}
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--border-soft)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setCalendarRoom(label)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 text-left transition hover:bg-[var(--surface-muted)]"
                    >
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-semibold shrink-0"
                        style={{
                          background: "var(--surface-muted)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {label}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                          {isRented ? "Occupied" : "Vacant"} · click to view monthly rent
                        </p>
                      </div>
                      <span
                        className={
                          "ui-chip " + (isRented ? "ui-chip-success" : "")
                        }
                      >
                        {isRented ? "Rented" : "Available"}
                      </span>
                      <span
                        aria-hidden
                        className="text-base"
                        style={{ color: "var(--text-faint)" }}
                      >
                        →
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Combined revenue / expense slide-over */}
      <EntryDrawer
        open={drawer.open}
        onClose={() => setDrawer({ open: false })}
        propertyName={property.name}
        rooms={rooms}
        initialTab={drawer.open ? drawer.tab : "revenue"}
        initialRoom={drawer.open ? drawer.initialRoom : undefined}
      />

      {/* Calendar drawer for a clicked room/unit */}
      <RoomCalendarDrawer
        open={calendarRoom !== null}
        onClose={() => setCalendarRoom(null)}
        propertyName={property.name}
        roomLabel={calendarRoom ?? ""}
        onLogMonth={(monthIndex, year) => {
          const room = calendarRoom;
          setCalendarRoom(null);
          if (room) {
            setDrawer({ open: true, tab: "revenue", initialRoom: room });
            if (typeof window !== "undefined") {
              const monthLabel = new Date(year, monthIndex, 1).toLocaleString(
                undefined,
                { month: "long", year: "numeric" }
              );
              window.history.replaceState(null, "", `#log=${encodeURIComponent(monthLabel)}`);
            }
          }
        }}
      />
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-xs inline-flex items-center gap-1.5 w-fit"
      style={{ color: "var(--text-muted)" }}
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
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
    <div className="p-5" style={{ background: "var(--surface)" }}>
      <p
        className="text-[10px] uppercase tracking-[0.14em]"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <p
        className="text-xl font-semibold mt-1.5 tabular-nums"
        style={{ color: valueColor ?? "var(--text-primary)" }}
      >
        {value}
      </p>
      {sub ? (
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  hint,
  action,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p
          className="text-[11px] uppercase tracking-[0.16em]"
          style={{ color: "var(--text-faint)" }}
        >
          {eyebrow}
        </p>
        <h3
          className="text-base font-semibold mt-1"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h3>
        {hint ? (
          <p
            className="text-xs mt-1.5 max-w-2xl leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {hint}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg px-5 py-6 text-center text-xs"
      style={{
        color: "var(--text-muted)",
        border: "1px dashed var(--border-strong)",
        background: "var(--surface-muted)",
      }}
    >
      {text}
    </div>
  );
}
