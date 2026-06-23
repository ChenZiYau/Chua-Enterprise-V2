"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { RENTAL_MODEL_LABEL, STATUS_LABEL, type Property } from "@/types/rental";
import { PROPERTY_FALLBACK_IMAGE } from "@/data/rentalData";
import { PropertyEditModal } from "@/components/property/PropertyEditModal";
import { PropertyRevenueTab } from "@/components/property/PropertyRevenueTab";
import { PropertyExpensesTab } from "@/components/property/PropertyExpensesTab";
import { PropertyInvoiceTab } from "@/components/property/PropertyInvoiceTab";
import { PropertyImagesTab } from "@/components/property/PropertyImagesTab";

function formatMYR(value: number | undefined) {
  if (value === undefined || value === null) return "RM -";
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

type TabKey = "revenue" | "expenses" | "invoice" | "images";
const TABS: { key: TabKey; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "expenses", label: "Expenses" },
  { key: "invoice", label: "Invoice" },
  { key: "images", label: "Images" },
];

export default function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { getProperty, softDeleteProperty, getUnitsForProperty, getPropertyYTD } = useRental();
  const confirm = useConfirm();

  const property = getProperty(id);
  const units = getUnitsForProperty(id);
  const [imgSrc, setImgSrc] = useState(property?.image_url || PROPERTY_FALLBACK_IMAGE);
  const [editOpen, setEditOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("revenue");

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

  const curYear = new Date().getFullYear();
  const ytd = getPropertyYTD(id, curYear);
  const rentedCount = units.filter((u) => u.is_rented).length;
  const totalUnits = units.length;
  const isWhole = property.rental_model === "whole_unit";
  const occupied = rentedCount > 0;

  async function handleDelete() {
    const { confirmed } = await confirm({
      title: "Move property to Trash?",
      message: `"${property!.name}" will be moved to Trash and hidden from the dashboard.`,
      confirmLabel: "Move to Trash",
      danger: true,
    });
    if (!confirmed) return;
    setActionError(null);
    try {
      await softDeleteProperty(property!.id);
      router.push("/admin/properties");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not remove property from the database.");
    }
  }

  return (
    <div className="flex flex-col">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-20 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--border-soft)" }}
      >
        <div className="min-w-0">
          <BackLink href="/admin/properties" label="Property" />
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {property.name} — property details
          </p>
        </div>
        <button type="button" className="ui-btn shrink-0" onClick={handleDelete}>
          Move to Trash
        </button>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">
        {actionError && (
          <div className="ui-card px-4 py-3 flex items-center justify-between gap-3" style={{ borderColor: "var(--danger)", background: "rgba(211,84,84,0.08)" }}>
            <p className="text-sm" style={{ color: "var(--danger)" }}>{actionError}</p>
            <button type="button" className="ui-btn" onClick={() => setActionError(null)}>Dismiss</button>
          </div>
        )}

        {/* Cover image with overlaid property details */}
        <section className="relative w-full rounded-lg overflow-hidden" style={{ background: "var(--surface-subtle)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={property.name}
            className="w-full h-[240px] sm:h-[300px] lg:h-[340px] object-cover"
            onError={() => setImgSrc(PROPERTY_FALLBACK_IMAGE)}
          />
          {/* Gradient so the overlaid text stays legible over any image. */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.05) 100%)" }}
          />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white drop-shadow">
                {property.name}
              </h1>
              <p className="text-sm mt-1 text-white/85 drop-shadow">
                {property.address}
                {property.city ? `, ${property.city}` : ""}
                {property.state ? `, ${property.state}` : ""}
                {property.postcode ? ` ${property.postcode}` : ""}
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-3">
                <span className="ui-chip" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>
                  {RENTAL_MODEL_LABEL[property.rental_model]}
                </span>
                <span className={"ui-chip " + statusChipClass(property.status)}>
                  {STATUS_LABEL[property.status]}
                </span>
              </div>
            </div>
            <button type="button" className="ui-btn shrink-0" onClick={() => setEditOpen(true)}>
              Edit
            </button>
          </div>
        </section>

        {/* Stat cards: status · revenue · expenses · net PnL */}
        <section
          className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-lg overflow-hidden"
          style={{ background: "var(--border-soft)", border: "1px solid var(--border-soft)" }}
        >
          <Stat
            label="Status"
            value={occupied ? "OCCUPIED" : "VACANT"}
            valueColor={occupied ? "var(--success)" : "var(--warning)"}
            sub={isWhole ? undefined : `${rentedCount} of ${totalUnits} rooms`}
          />
          <Stat label={`Revenue ${curYear}`} value={formatMYR(ytd.revenue)} />
          <Stat label={`Expenses ${curYear}`} value={formatMYR(ytd.expenses)} />
          <Stat
            label="Net PnL"
            value={formatMYR(ytd.net)}
            valueColor={ytd.net >= 0 ? "var(--success)" : "var(--danger)"}
          />
        </section>

        {/* Tabs */}
        <nav
          className="grid grid-cols-4 rounded-lg overflow-hidden border"
          style={{ borderColor: "var(--border-soft)" }}
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="px-4 py-3 text-sm font-medium transition border-l first:border-l-0"
                style={{
                  borderColor: "var(--border-soft)",
                  background: active ? "var(--surface-muted)" : "var(--surface)",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  boxShadow: active ? "inset 0 -2px 0 var(--accent)" : "none",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Tab content — each scoped to this property */}
        {tab === "revenue" && <PropertyRevenueTab property={property} />}
        {tab === "expenses" && <PropertyExpensesTab property={property} />}
        {tab === "invoice" && <PropertyInvoiceTab property={property} />}
        {tab === "images" && <PropertyImagesTab property={property} />}

        {/* Footer */}
        <footer
          className="mt-2 pt-4 text-center text-xs border-t"
          style={{ color: "var(--text-faint)", borderColor: "var(--border-soft)" }}
        >
          {property.name} · {RENTAL_MODEL_LABEL[property.rental_model]} · {totalUnits}{" "}
          {isWhole ? "unit" : "rooms"}
        </footer>
      </div>

      {/* Edit modal — the same reusable form used to add a property */}
      <PropertyEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        property={property}
      />
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-xs inline-flex items-center gap-1.5 w-fit" style={{ color: "var(--text-muted)" }}>
      <span aria-hidden>&#8592;</span>{label}
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
