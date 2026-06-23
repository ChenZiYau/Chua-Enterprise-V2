"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EditModalShell } from "@/components/ui/EditModalShell";
import { Select } from "@/components/ui/Select";
import { DatePickerField, StepDatePicker } from "@/components/ui/DatePicker";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import {
  MONTHS,
  PAYMENT_STATUS_LABEL,
  type PaymentStatus,
  type Tenant,
} from "@/types/rental";

type ViewMode = "table" | "grid";
const VIEW_STORAGE_KEY = "tenants:viewMode";

type LeaseTone = "good" | "warn" | "danger";
type LeaseStatus = { label: string; tone: LeaseTone };
const LEASE_SOON_DAYS = 30;

const LEASE_TONE_COLORS: Record<LeaseTone, { bg: string; text: string }> = {
  good: { bg: "rgba(47,158,111,0.10)", text: "var(--success)" },
  warn: { bg: "rgba(224,162,61,0.10)", text: "var(--warning)" },
  danger: { bg: "rgba(211,84,84,0.10)", text: "var(--danger)" },
};

/** Current payment status for a tenant's unit, derived from real revenue rows.
 *  Overdue anywhere wins; otherwise the most recent month's status. Null when
 *  there are no revenue rows for the unit (so we never invent a value). */
function derivePaymentStatus(
  unitId: string | null | undefined,
  revenueEntries: ReturnType<typeof useRental>["revenueEntries"]
): PaymentStatus | null {
  if (!unitId) return null;
  const entries = revenueEntries.filter((e) => e.unit_id === unitId);
  if (entries.length === 0) return null;
  if (entries.some((e) => e.payment_status === "overdue")) return "overdue";
  const latest = entries.reduce((a, b) =>
    b.year > a.year || (b.year === a.year && b.month > a.month) ? b : a
  );
  return latest.payment_status ?? null;
}

/** Lease status from lease_end, mirroring the dashboard's 30-day window. Null
 *  when there's no (valid) lease end date. */
function deriveLeaseStatus(leaseEnd: string | null | undefined): LeaseStatus | null {
  if (!leaseEnd) return null;
  const end = new Date(`${leaseEnd}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: "Expired", tone: "danger" };
  if (days <= LEASE_SOON_DAYS) return { label: "Ending Soon", tone: "warn" };
  return { label: "Active", tone: "good" };
}

function fmt(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

/** Today as a "YYYY-MM-DD" string in local time (matches the date-picker format). */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Rectangular textarea styling. The shared `.ui-input` is a fully-rounded pill
// (border-radius: 9999px) meant for single-line inputs — on a resizable
// textarea its rounded corners let it warp into a circle, so multi-line fields
// use this squared-off, non-resizable style instead.
const textareaCls =
  "w-full px-3.5 py-2.5 text-sm rounded-[10px] border outline-none transition resize-none focus:border-[var(--accent)]";
const fieldCls =
  "w-full px-3.5 py-2.5 text-sm rounded-[10px] border outline-none transition focus:border-[var(--accent)]";
const textareaStyle: React.CSSProperties = {
  background: "var(--surface)",
  borderColor: "var(--border-soft)",
  color: "var(--text-primary)",
};

const STATUS_COLORS: Record<PaymentStatus, { bg: string; text: string }> = {
  paid: { bg: "rgba(47,158,111,0.10)", text: "var(--success)" },
  partial: { bg: "rgba(224,162,61,0.10)", text: "var(--warning)" },
  pending: { bg: "rgba(224,162,61,0.10)", text: "var(--warning)" },
  overdue: { bg: "rgba(211,84,84,0.10)", text: "var(--danger)" },
};

/** Aura/glow tone for a tenant card by payment status: paid → green,
 *  pending/partial → yellow, overdue → red. Null payment → no glow. */
const STATUS_GLOW: Record<PaymentStatus, string> = {
  paid: "ui-glow-green",
  partial: "ui-glow-orange",
  pending: "ui-glow-orange",
  overdue: "ui-glow-red",
};

type DrawerState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; tenant: Tenant }
  | { mode: "view"; tenant: Tenant };

export default function TenantsPage() {
  const {
    tenants,
    visibleProperties,
    units,
    getUnit,
    addTenant,
    updateTenant,
    deleteTenant,
    revenueEntries,
  } = useRental();

  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });
  const [search, setSearch] = useState("");
  const [filterProp, setFilterProp] = useState("all");
  const [filterLease, setFilterLease] = useState<"all" | "active" | "expired">("all");
  const [filterPay, setFilterPay] = useState<"all" | PaymentStatus>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const confirm = useConfirm();

  // Restore the preferred view on mount (kept in an effect to avoid SSR/hydration
  // mismatch), and persist any change back to localStorage.
  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "grid" || saved === "table") setViewMode(saved);
  }, []);
  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants
      .map((t) => {
        const unit = t.unit_id ? getUnit(t.unit_id) : undefined;
        const prop = unit
          ? visibleProperties.find((p) => p.id === unit.property_id)
          : undefined;
        return {
          tenant: t,
          unit,
          prop,
          payment: derivePaymentStatus(t.unit_id, revenueEntries),
          lease: deriveLeaseStatus(t.lease_end),
        };
      })
      .filter(({ prop }) => filterProp === "all" || prop?.id === filterProp)
      .filter(({ lease }) => {
        if (filterLease === "all") return true;
        // "Expired" matches the danger tone; "Active" is any live lease (active
        // or ending-soon). Tenants without a lease end are excluded from both.
        if (!lease) return false;
        return filterLease === "expired"
          ? lease.tone === "danger"
          : lease.tone !== "danger";
      })
      .filter(({ payment }) => filterPay === "all" || payment === filterPay)
      .filter(({ tenant, unit, prop }) => {
        if (!q) return true;
        return (
          tenant.name.toLowerCase().includes(q) ||
          (tenant.ic_number ?? "").toLowerCase().includes(q) ||
          (tenant.email ?? "").toLowerCase().includes(q) ||
          (tenant.phone ?? "").toLowerCase().includes(q) ||
          (tenant.previous_address ?? "").toLowerCase().includes(q) ||
          (tenant.notes ?? "").toLowerCase().includes(q) ||
          (unit?.name ?? "").toLowerCase().includes(q) ||
          (prop?.name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.tenant.name.localeCompare(b.tenant.name));
  }, [tenants, visibleProperties, getUnit, search, filterProp, filterLease, filterPay, revenueEntries]);

  const { page, setPage, totalPages, total, pageSize, pageItems } = usePagination(
    rows,
    10,
    `${search}|${filterProp}|${filterLease}|${filterPay}`
  );

  async function handleDelete(t: Tenant) {
    const { confirmed } = await confirm({
      title: "Delete tenant?",
      message: `Delete tenant "${t.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteTenant(t.id);
      setDrawer({ mode: "closed" });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete tenant from the database.");
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Tenants
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Customer directory - IC, contact, current unit, and payment history.
          </p>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn-primary"
          onClick={() => setDrawer({ mode: "create" })}
        >
          + Add Tenant
        </button>
      </div>

      <div className="ui-card p-4 flex flex-wrap gap-3 items-center">
        <input
          type="search"
          className="ui-input w-auto min-w-[240px] flex-1 max-w-[360px]"
          placeholder="Search name, IC, email, phone, unit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          className="w-auto min-w-[220px]"
          ariaLabel="Filter by property"
          value={filterProp}
          onChange={setFilterProp}
          options={[
            { value: "all", label: "All Properties" },
            ...visibleProperties.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <Select
          className="w-auto min-w-[160px]"
          ariaLabel="Filter by lease status"
          value={filterLease}
          onChange={(v) => setFilterLease(v as typeof filterLease)}
          options={[
            { value: "all", label: "All Leases" },
            { value: "active", label: "Active Lease" },
            { value: "expired", label: "Expired Lease" },
          ]}
        />
        <Select
          className="w-auto min-w-[170px]"
          ariaLabel="Filter by payment status"
          value={filterPay}
          onChange={(v) => setFilterPay(v as typeof filterPay)}
          options={[
            { value: "all", label: "All Payments" },
            ...(["paid", "partial", "pending", "overdue"] as PaymentStatus[]).map((s) => ({
              value: s,
              label: PAYMENT_STATUS_LABEL[s],
            })),
          ]}
        />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {rows.length} of {tenants.length} tenant{tenants.length === 1 ? "" : "s"}
          </span>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {actionError && (
        <div className="ui-card px-4 py-3 flex items-center justify-between gap-3" style={{ borderColor: "var(--danger)", background: "rgba(211,84,84,0.08)" }}>
          <p className="text-sm" style={{ color: "var(--danger)" }}>{actionError}</p>
          <button type="button" className="ui-btn" onClick={() => setActionError(null)}>Dismiss</button>
        </div>
      )}

      {rows.length === 0 ? (
        tenants.length === 0 ? (
          <div className="ui-card p-12 text-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No tenants yet.{" "}
              <button
                type="button"
                onClick={() => setDrawer({ mode: "create" })}
                style={{ color: "var(--accent)" }}
              >
                Add a tenant
              </button>{" "}
              to get started.
            </p>
          </div>
        ) : (
          <div className="ui-card p-12 text-center flex flex-col gap-1">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              No tenants found.
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Try adjusting your search or property filter.
            </p>
          </div>
        )
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

          {pageItems.map(({ tenant, unit, prop, payment, lease }) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              propertyName={prop?.name ?? null}
              unitName={unit?.name ?? null}
              payment={payment}
              lease={lease}
              onView={() => setDrawer({ mode: "view", tenant })}
              onEdit={() => setDrawer({ mode: "edit", tenant })}
              onDelete={() => handleDelete(tenant)}
              onSetLeaseEnd={async (iso) => {
                setActionError(null);
                try {
                  // Reuse the existing tenant-update path; only touch lease_end.
                  await updateTenant(tenant.id, { lease_end: iso });
                } catch (err) {
                  setActionError(
                    err instanceof Error ? err.message : "Could not update lease end date."
                  );
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="ui-card overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead style={{ background: "var(--surface-muted)" }}>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="text-left text-xs uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Property</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Unit</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">IC #</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Email</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Phone</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Payment</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Lease</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Lease End</th>
                <th
                  className="text-center text-xs uppercase tracking-wider px-3 py-3 sticky right-0"
                  style={{ background: "var(--surface-muted)", borderLeft: "1px solid var(--border-soft)" }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(({ tenant, unit, prop, payment, lease }) => (
                <tr
                  key={tenant.id}
                  onClick={() => setDrawer({ mode: "view", tenant })}
                  className="border-t cursor-pointer hover:bg-[var(--surface-muted)] transition-colors"
                  style={{ borderColor: "var(--border-soft)" }}
                >
                  <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                    {tenant.name}
                  </td>
                  <td className="px-4 py-3" style={{ color: prop ? "var(--text-secondary)" : "var(--text-faint)" }}>
                    {prop?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3" style={{ color: unit ? "var(--text-secondary)" : "var(--text-faint)" }}>
                    {unit?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                    {tenant.ic_number ?? "-"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {tenant.email ?? "-"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {tenant.phone ?? "-"}
                  </td>
                  <td
                    className="px-4 py-3 font-semibold"
                    style={{ color: payment ? STATUS_COLORS[payment].text : "var(--text-faint)" }}
                  >
                    {payment ? PAYMENT_STATUS_LABEL[payment] : "—"}
                  </td>
                  <td
                    className="px-4 py-3 font-semibold"
                    style={{ color: lease ? LEASE_TONE_COLORS[lease.tone].text : "var(--text-faint)" }}
                  >
                    {lease ? lease.label : "—"}
                  </td>
                  <td
                    className="px-4 py-3"
                    style={{ color: tenant.lease_end ? "var(--text-secondary)" : "var(--text-faint)" }}
                  >
                    {tenant.lease_end ?? "—"}
                  </td>
                  {/* Actions pinned to the right edge so they stay visible while
                      the table scrolls horizontally. */}
                  <td
                    className="px-3 py-3 sticky right-0 z-[1]"
                    style={{ background: "var(--surface)", borderLeft: "1px solid var(--border-soft)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <LeaseEndPicker
                        value={tenant.lease_end}
                        onChange={async (iso) => {
                          setActionError(null);
                          try {
                            await updateTenant(tenant.id, { lease_end: iso });
                          } catch (err) {
                            setActionError(
                              err instanceof Error ? err.message : "Could not update lease end date."
                            );
                          }
                        }}
                      />
                      <CardMenu
                        onPreview={() => setDrawer({ mode: "view", tenant })}
                        onEdit={() => setDrawer({ mode: "edit", tenant })}
                        onDelete={() => handleDelete(tenant)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPage={setPage}
          unit="tenant"
        />
      )}

      {drawer.mode === "view" && (
        <TenantDetailDrawer
          tenant={drawer.tenant}
          onClose={() => setDrawer({ mode: "closed" })}
          onEdit={() => setDrawer({ mode: "edit", tenant: drawer.tenant })}
          onDelete={() => handleDelete(drawer.tenant)}
          revenueEntries={revenueEntries.filter(
            (e) => e.unit_id === drawer.tenant.unit_id
          )}
          getUnit={getUnit}
          properties={visibleProperties}
        />
      )}

      {(drawer.mode === "create" || drawer.mode === "edit") && (
        <TenantFormDrawer
          initial={drawer.mode === "edit" ? drawer.tenant : null}
          properties={visibleProperties}
          units={units}
          tenants={tenants}
          onClose={() => setDrawer({ mode: "closed" })}
          onSubmit={async (input) => {
            setActionError(null);
            try {
              if (drawer.mode === "edit") {
                await updateTenant(drawer.tenant.id, input);
              } else {
                await addTenant(input);
              }
              setDrawer({ mode: "closed" });
            } catch (err) {
              setActionError(err instanceof Error ? err.message : "Could not save tenant to the database.");
              throw err;
            }
          }}
        />
      )}
    </div>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const options: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
    {
      value: "table",
      label: "Table",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      ),
    },
    {
      value: "grid",
      label: "Grid",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="inline-flex p-0.5 rounded-lg"
      style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}
      role="group"
      aria-label="Switch tenant view"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            title={`${opt.label} view`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition"
            style={{
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
              boxShadow: active ? "var(--shadow-xs)" : "none",
              border: active ? "1px solid var(--accent)" : "1px solid transparent",
            }}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Read-only tenant card: a clean "Label : value" record with a single actions
 *  dropdown (Preview / Edit / Delete). Nothing here is edited inline except the
 *  lease cogwheel — the card itself is just for showing. */
function TenantCard({
  tenant,
  propertyName,
  unitName,
  payment,
  lease,
  onView,
  onEdit,
  onDelete,
  onSetLeaseEnd,
}: {
  tenant: Tenant;
  propertyName: string | null;
  unitName: string | null;
  payment: PaymentStatus | null;
  lease: LeaseStatus | null;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetLeaseEnd: (iso: string) => void | Promise<void>;
}) {
  return (
    <div className={"ui-card p-4 flex flex-col gap-3 " + (payment ? STATUS_GLOW[payment] : "")}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold truncate min-w-0" style={{ color: "var(--text-primary)" }}>
          {tenant.name}
        </p>
        <CardMenu onPreview={onView} onEdit={onEdit} onDelete={onDelete} />
      </div>

      <dl className="flex flex-col gap-1.5 text-xs">
        <CardRow icon={ICONS.property} label="Property" value={propertyName} />
        <CardRow icon={ICONS.unit} label="Unit" value={unitName} />
        <CardRow icon={ICONS.ic} label="IC" value={tenant.ic_number} mono />
        <CardRow icon={ICONS.email} label="Email" value={tenant.email} />
        <CardRow icon={ICONS.phone} label="Phone" value={tenant.phone} />
        <CardRow icon={ICONS.lease} label="Lease end" value={tenant.lease_end} />
      </dl>

      {/* Footer split 50/50 — Payment status on the left, Lease status on the
          right — so each gets the full half-width instead of a small chip. */}
      <div
        className="grid grid-cols-2 mt-auto pt-3 border-t"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div className="pr-3 flex flex-col gap-1 min-w-0">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Payment
          </span>
          <span
            className="text-sm font-semibold truncate"
            style={{ color: payment ? STATUS_COLORS[payment].text : "var(--text-faint)" }}
          >
            {payment ? PAYMENT_STATUS_LABEL[payment] : "—"}
          </span>
        </div>
        <div
          className="pl-3 flex items-end justify-between gap-2 min-w-0"
          style={{ borderLeft: "1px solid var(--border-soft)" }}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Lease
            </span>
            <span
              className="text-sm font-semibold truncate"
              style={{ color: lease ? LEASE_TONE_COLORS[lease.tone].text : "var(--text-faint)" }}
            >
              {lease ? lease.label : "—"}
            </span>
          </div>
          <LeaseEndPicker value={tenant.lease_end} onChange={onSetLeaseEnd} />
        </div>
      </div>
    </div>
  );
}

/** Compact "[icon] Label : value" row used on the read-only tenant card. The
 *  leading icon is a quiet visual cue so the record scans cleanly. */
function CardRow({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <dt className="shrink-0 w-24 flex items-center gap-1.5" style={{ color: "var(--text-faint)" }}>
        <span className="shrink-0 inline-flex" style={{ color: "var(--text-faint)" }}>
          {icon}
        </span>
        <span>{label}</span>
        <span aria-hidden>:</span>
      </dt>
      <dd
        className={`truncate min-w-0 flex-1 ${mono ? "font-mono" : ""}`}
        style={{ color: value ? "var(--text-secondary)" : "var(--text-faint)" }}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

/** 13px line icons for the tenant card rows — kept tiny and muted so they read
 *  as quiet cues, not decoration. */
const ICONS = {
  property: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" />
    </svg>
  ),
  unit: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 12h.01" />
    </svg>
  ),
  ic: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2" /><path d="M14 10h4M14 14h4" />
    </svg>
  ),
  email: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" />
    </svg>
  ),
  phone: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  lease: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
} as const;

/** Single actions dropdown on a tenant card/row: Preview / Edit / Delete (delete
 *  routes through the shared confirm dialog). The menu renders in a fixed-position
 *  portal so it's never clipped by a scroll container (e.g. the table's
 *  overflow-x-auto). Closes on outside click / Esc / scroll. */
function CardMenu({
  onPreview,
  onEdit,
  onDelete,
}: {
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Anchor the portal menu just under the button, right-aligned to it.
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  };

  useEffect(() => {
    if (!open) return;
    place();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // A fixed menu can't follow a scroll, so close on scroll/resize.
    function onScrollResize() {
      setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Tenant actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 shrink-0 rounded-lg inline-flex items-center justify-center border hover:bg-[var(--surface-muted)] transition"
        style={{ color: open ? "var(--accent)" : "var(--text-muted)", borderColor: "var(--border-soft)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[80] w-36 rounded-lg border overflow-hidden"
              style={{
                top: pos.top,
                right: pos.right,
                background: "var(--surface)",
                borderColor: "var(--border-soft)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <MenuItem onClick={run(onPreview)}>Preview</MenuItem>
              <MenuItem onClick={run(onEdit)}>Edit</MenuItem>
              <MenuItem danger onClick={run(onDelete)}>Delete</MenuItem>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full px-3 py-2 text-left text-xs transition hover:bg-[var(--surface-muted)]"
      style={{ color: danger ? "var(--danger)" : "var(--text-secondary)" }}
    >
      {children}
    </button>
  );
}

/** Cogwheel trigger that opens the shared StepDatePicker to edit the lease end
 *  date. Click-only; selecting commits via `onChange` and closes. The calendar
 *  renders in a fixed-position portal so it's never clipped by a scroll
 *  container (e.g. the table's overflow-x-auto). Opens upward when there's room,
 *  else downward. Closes on outside click / Esc / scroll. */
function LeaseEndPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (iso: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Anchor the portal calendar to the button — above it if there's room, else below.
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const POP_H = 340; // approx calendar height
    const right = Math.max(8, window.innerWidth - r.right);
    if (r.top > POP_H + 12) setPos({ bottom: window.innerHeight - r.top + 6, right });
    else setPos({ top: r.bottom + 6, right });
  };

  useEffect(() => {
    if (!open) return;
    place();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScrollResize() {
      setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="Change lease end date"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Change lease end date"
        className="w-8 h-8 shrink-0 rounded-lg inline-flex items-center justify-center border hover:bg-[var(--surface-muted)] transition"
        style={{ color: open ? "var(--accent)" : "var(--text-muted)", borderColor: "var(--border-soft)" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popRef}
              className="fixed z-[80] w-[280px] max-w-[88vw]"
              style={{
                top: pos.top,
                bottom: pos.bottom,
                right: pos.right,
                filter: "drop-shadow(0 16px 40px rgba(0,0,0,0.22))",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <StepDatePicker
                value={value ?? ""}
                onChange={(iso) => onChange(iso)}
                granularity="day"
                onCommit={() => setOpen(false)}
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function TenantDetailDrawer({
  tenant,
  onClose,
  onEdit,
  onDelete,
  revenueEntries,
  getUnit,
  properties,
}: {
  tenant: Tenant;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  revenueEntries: ReturnType<typeof useRental>["revenueEntries"];
  getUnit: ReturnType<typeof useRental>["getUnit"];
  properties: ReturnType<typeof useRental>["visibleProperties"];
}) {
  const unit = tenant.unit_id ? getUnit(tenant.unit_id) : undefined;
  const prop = unit ? properties.find((p) => p.id === unit.property_id) : undefined;

  const [histStatus, setHistStatus] = useState<PaymentStatus | "all">("all");
  const [histFrom, setHistFrom] = useState("");
  const [histTo, setHistTo] = useState("");

  const history = useMemo(
    () =>
      [...revenueEntries].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      }),
    [revenueEntries]
  );

  const totalPaid = history
    .filter((e) => e.payment_status === "paid")
    .reduce((s, e) => s + e.total_amount, 0);
  const totalOutstanding = history
    .filter((e) => e.payment_status !== "paid")
    .reduce((s, e) => s + e.total_amount, 0);

  const filteredHistory = useMemo(() => {
    const key = (s: string) => {
      if (!s) return null;
      const [y, m] = s.split("-").map(Number);
      return y && m ? y * 100 + m : null;
    };
    const from = key(histFrom);
    const to = key(histTo);
    return history.filter((e) => {
      if (histStatus !== "all" && (e.payment_status ?? "pending") !== histStatus) return false;
      const ek = e.year * 100 + e.month;
      if (from && ek < from) return false;
      if (to && ek > to) return false;
      return true;
    });
  }, [history, histStatus, histFrom, histTo]);

  const histPaging = usePagination(
    filteredHistory,
    6,
    `${histStatus}|${histFrom}|${histTo}`
  );

  return (
    <EditModalShell
      open
      onClose={onClose}
      placement="center"
      widthClass="max-w-5xl"
      eyebrow="Tenant"
      title={tenant.name}
      footer={
        <footer
          className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 shrink-0"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          <button
            type="button"
            className="ui-btn justify-center sm:mr-auto"
            onClick={onDelete}
            style={{ color: "var(--danger)" }}
          >
            Delete
          </button>
          <button type="button" className="ui-btn justify-center" onClick={onClose}>
            Close
          </button>
          <button type="button" className="ui-btn ui-btn-primary justify-center" onClick={onEdit}>
            Edit
          </button>
        </footer>
      }
    >
      {/* Same inline "Label : value" layout as the Add/Edit form, but read-only. */}
      <div className="flex flex-col gap-4 text-sm">
        <Row label="Property">
          <ReadField value={prop?.name ?? null} />
        </Row>
        <Row label="Unit">
          <ReadField value={unit?.name ?? null} />
        </Row>
        <Row label="Full Name">
          <ReadField value={tenant.name} />
        </Row>
        <Row label="IC Number">
          <ReadField value={tenant.ic_number} mono />
        </Row>
        <Row label="Email">
          <ReadField value={tenant.email} />
        </Row>
        <Row label="Phone">
          <ReadField value={tenant.phone} />
        </Row>
        <Row label="Previous Rental Address" align="start">
          <ReadField value={tenant.previous_address} />
        </Row>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Row label="Lease Start">
            <ReadField value={tenant.lease_start} />
          </Row>
          <Row label="Lease End">
            <ReadField value={tenant.lease_end} />
          </Row>
        </div>
        <Row label="Notes" align="start">
          <ReadField value={tenant.notes} />
        </Row>

        <section className="border-t pt-5 mt-1" style={{ borderColor: "var(--border-soft)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Payment History
            </p>
            <div className="flex gap-4 text-xs">
              <span style={{ color: "var(--success)" }}>Paid: {fmt(totalPaid)}</span>
              <span style={{ color: "var(--danger)" }}>Outstanding: {fmt(totalOutstanding)}</span>
            </div>
          </div>

          {history.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
                No payment records for this tenant&apos;s unit yet.
              </p>
            ) : (
              <>
                {/* Filters: status + month range */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Select
                    className="w-auto min-w-[130px]"
                    ariaLabel="Filter payment status"
                    value={histStatus}
                    onChange={(v) => setHistStatus(v as PaymentStatus | "all")}
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "paid", label: "Paid" },
                      { value: "partial", label: "Partial" },
                      { value: "pending", label: "Pending" },
                      { value: "overdue", label: "Overdue" },
                    ]}
                  />
                  <DatePickerField
                    granularity="month"
                    className="w-[150px]"
                    value={histFrom}
                    onChange={setHistFrom}
                    placeholder="From month"
                    ariaLabel="History from month"
                  />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
                  <DatePickerField
                    granularity="month"
                    className="w-[150px]"
                    value={histTo}
                    onChange={setHistTo}
                    placeholder="To month"
                    ariaLabel="History to month"
                  />
                  {(histStatus !== "all" || histFrom || histTo) && (
                    <button
                      type="button"
                      className="ui-btn"
                      onClick={() => {
                        setHistStatus("all");
                        setHistFrom("");
                        setHistTo("");
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>

                {filteredHistory.length === 0 ? (
                  <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
                    No payments match these filters.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto -mx-6">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ color: "var(--text-faint)" }}>
                            <th className="text-left text-xs uppercase tracking-wider px-6 py-2">Period</th>
                            <th className="text-right text-xs uppercase tracking-wider px-3 py-2">Amount</th>
                            <th className="text-center text-xs uppercase tracking-wider px-6 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {histPaging.pageItems.map((e) => {
                            const sc = STATUS_COLORS[e.payment_status ?? "pending"];
                            return (
                              <tr key={e.id} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                                <td className="px-6 py-2" style={{ color: "var(--text-secondary)" }}>
                                  {MONTHS[e.month - 1]} {e.year}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
                                  {fmt(e.total_amount)}
                                </td>
                                <td className="px-6 py-2 text-center">
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
                    </div>
                    <Pagination
                      className="mt-3"
                      page={histPaging.page}
                      totalPages={histPaging.totalPages}
                      total={histPaging.total}
                      pageSize={histPaging.pageSize}
                      onPage={histPaging.setPage}
                      unit="payment"
                    />
                  </>
                )}
              </>
            )}
        </section>
      </div>
    </EditModalShell>
  );
}

/** Read-only value box that mirrors the form's input look, so Preview lines up
 *  field-for-field with Add/Edit. Empty values show a muted em-dash. */
function ReadField({ value, mono }: { value?: string | null; mono?: boolean }) {
  return (
    <div
      className={`w-full px-3.5 py-2.5 text-sm rounded-[10px] border min-h-[42px] whitespace-pre-wrap break-words ${mono ? "font-mono" : ""}`}
      style={{
        background: "var(--surface-muted)",
        borderColor: "var(--border-soft)",
        color: value ? "var(--text-primary)" : "var(--text-faint)",
      }}
    >
      {value || "—"}
    </div>
  );
}

function TenantFormDrawer({
  initial,
  properties,
  units,
  tenants,
  onClose,
  onSubmit,
}: {
  initial: Tenant | null;
  properties: ReturnType<typeof useRental>["visibleProperties"];
  units: ReturnType<typeof useRental>["units"];
  tenants: ReturnType<typeof useRental>["tenants"];
  onClose: () => void;
  onSubmit: (input: Omit<Tenant, "id" | "created_at">) => Promise<void>;
}) {
  // Lease Start defaults to today for a brand-new tenant; an existing tenant
  // keeps its saved value. Captured once so the dirty-check baseline matches.
  const initialLeaseStart = useRef(initial?.lease_start ?? todayISO()).current;

  const [name, setName] = useState(initial?.name ?? "");
  const [icNumber, setIcNumber] = useState(initial?.ic_number ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [previousAddress, setPreviousAddress] = useState(initial?.previous_address ?? "");
  const [unitId, setUnitId] = useState(initial?.unit_id ?? "");
  const [propertyId, setPropertyId] = useState(() => {
    if (!initial?.unit_id) return "";
    const u = units.find((x) => x.id === initial.unit_id);
    return u?.property_id ?? "";
  });
  const [leaseStart, setLeaseStart] = useState(initialLeaseStart);
  const [leaseEnd, setLeaseEnd] = useState(initial?.lease_end ?? "");
  const [leaseEndError, setLeaseEndError] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitOptions = propertyId
    ? units.filter((u) => u.property_id === propertyId).sort((a, b) => a.sort_order - b.sort_order)
    : [];

  // Whole-unit properties have one rentable unit, auto-selected on property
  // choice — so the Unit selector is locked (nothing else to pick).
  const isWholeProperty =
    properties.find((p) => p.id === propertyId)?.rental_model === "whole_unit";

  // A unit holds one tenant at a time. Flag when another tenant already occupies
  // the chosen unit (excluding this tenant's own record while editing).
  const conflictTenant = unitId
    ? tenants.find((t) => t.unit_id === unitId && t.id !== initial?.id)
    : undefined;
  const unitOccupied = !!conflictTenant;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    // Phone and Lease End are required — flag any missing ones and block the save.
    const missingPhone = !phone.trim();
    const missingLeaseEnd = !leaseEnd;
    if (missingPhone || missingLeaseEnd) {
      setPhoneError(missingPhone);
      setLeaseEndError(missingLeaseEnd);
      return;
    }
    // One tenant per unit — block assigning a unit that's already taken.
    if (conflictTenant) {
      setError(`This unit is already occupied by ${conflictTenant.name}. A unit can only hold one tenant at a time.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        ic_number: icNumber.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        previous_address: previousAddress.trim() || null,
        unit_id: unitId || null,
        lease_start: leaseStart || null,
        lease_end: leaseEnd || null,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save tenant to the database.");
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    name.trim() !== (initial?.name ?? "") ||
    icNumber !== (initial?.ic_number ?? "") ||
    email !== (initial?.email ?? "") ||
    phone !== (initial?.phone ?? "") ||
    previousAddress !== (initial?.previous_address ?? "") ||
    unitId !== (initial?.unit_id ?? "") ||
    leaseStart !== initialLeaseStart ||
    leaseEnd !== (initial?.lease_end ?? "") ||
    notes !== (initial?.notes ?? "");

  return (
    <EditModalShell
      open
      onClose={onClose}
      placement="center"
      widthClass="max-w-5xl"
      eyebrow={initial ? "Edit tenant" : "New tenant"}
      title={initial ? initial.name : "Add tenant"}
      dirty={dirty}
      saving={saving}
      primaryFormId="tenant-form"
      primaryDisabled={unitOccupied}
      primaryLabel={initial ? "Save Changes" : "Add Tenant"}
    >
      <form id="tenant-form" onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
          {/* Choose property & unit first — drives which room the tenant occupies. */}
          <Row label="Property">
            <Select
              value={propertyId}
              placeholder="Choose"
              onChange={(v) => {
                setPropertyId(v);
                // A whole-unit property has a single rentable unit — select it
                // automatically so the user doesn't have to pick from a list of one.
                const prop = properties.find((p) => p.id === v);
                const propUnits = v
                  ? units
                      .filter((u) => u.property_id === v)
                      .sort((a, b) => a.sort_order - b.sort_order)
                  : [];
                setUnitId(
                  prop?.rental_model === "whole_unit" && propUnits[0]
                    ? propUnits[0].id
                    : ""
                );
              }}
              options={[
                { value: "", label: "Choose" },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </Row>
          <Row label="Unit">
            <Select
              value={unitId}
              disabled={!propertyId || isWholeProperty}
              placeholder={propertyId ? "Choose" : "Choose property first"}
              onChange={setUnitId}
              options={[
                { value: "", label: propertyId ? "Choose" : "Choose property first" },
                ...unitOptions.map((u) => ({ value: u.id, label: u.name })),
              ]}
            />
          </Row>

          {unitOccupied && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: "rgba(224,162,61,0.10)", border: "1px solid var(--warning)", color: "var(--warning)" }}
            >
              <span className="mt-px">&#9888;</span>
              <span>
                This unit is already occupied by {conflictTenant?.name}. A unit can only hold one
                tenant at a time — pick a different unit.
              </span>
            </div>
          )}

          <Row label="Full Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
              className={fieldCls}
              style={textareaStyle}
            />
          </Row>
          <Row label="IC Number">
            <input
              value={icNumber}
              onChange={(e) => setIcNumber(e.target.value)}
              placeholder="e.g. 901231-14-5678"
              className={fieldCls}
              style={textareaStyle}
            />
          </Row>
          <Row label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={fieldCls}
              style={textareaStyle}
            />
          </Row>
          <Row label="Phone" required error={phoneError ? "Phone is required." : undefined}>
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError(false);
              }}
              placeholder="e.g. +60 12-345 6789"
              required
              className={fieldCls}
              style={textareaStyle}
            />
          </Row>

          <Row label="Previous Rental Address" align="start">
            <textarea
              value={previousAddress}
              onChange={(e) => setPreviousAddress(e.target.value)}
              rows={2}
              placeholder="Previous rental address"
              className={textareaCls}
              style={textareaStyle}
            />
          </Row>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Row label="Lease Start">
              <DatePickerField value={leaseStart} onChange={setLeaseStart} ariaLabel="Lease Start" placeholder="Select date..." />
            </Row>
            <Row
              label="Lease End"
              required
              error={leaseEndError ? "Lease End is required." : undefined}
            >
              <DatePickerField
                value={leaseEnd}
                onChange={(v) => {
                  setLeaseEnd(v);
                  setLeaseEndError(false);
                }}
                invalid={leaseEndError}
                ariaLabel="Lease End"
                placeholder="Select date..."
              />
            </Row>
          </div>

          <Row label="Notes" align="start">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes"
              className={textareaCls}
              style={textareaStyle}
            />
          </Row>
        {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
      </form>
    </EditModalShell>
  );
}

/** Inline "Label : [input]" row — mirrors the Add Property form layout. Stacks
 *  to a single column on mobile; `align="start"` top-aligns the label for
 *  multi-line fields (textareas). */
function Row({
  label,
  required,
  error,
  align = "center",
  labelWidth = "sm:w-44",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  align?: "center" | "start";
  /** Tailwind width class for the label column (e.g. narrower for side-by-side fields). */
  labelWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "flex flex-col gap-1 sm:flex-row sm:gap-3 " +
        (align === "start" ? "sm:items-start" : "sm:items-center")
      }
    >
      <label
        className={
          `shrink-0 ${labelWidth} flex items-center gap-1 text-sm font-medium ` +
          (align === "start" ? "sm:pt-2.5" : "")
        }
        style={{ color: "var(--text-secondary)" }}
      >
        <span>{label}</span>
        {required ? <span style={{ color: "var(--accent)" }}>*</span> : null}
        <span aria-hidden>:</span>
      </label>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {children}
        {error ? (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
