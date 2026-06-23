"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { DatePickerField } from "@/components/ui/DatePicker";
import { PROPERTY_FALLBACK_IMAGE } from "@/data/rentalData";
import { dbUpdate, isPersistedId } from "@/lib/dbClient";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, type PaymentMethod, type PaymentStatus, type RevenueEntry } from "@/types/rental";
import type {
  DashboardData,
  PropertyHealth,
  RentEntry,
  UnitDetail,
  MaintItem,
  PaymentHistoryItem,
  UnitIssue,
} from "@/lib/dashboard";

/* ------------------------------ formatting -------------------------------- */

function fmtMYR(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

function compactMYR(n: number) {
  if (Math.abs(n) >= 1000) return `RM ${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k`;
  return `RM ${Math.round(n)}`;
}

/* ------------------------------ status meta ------------------------------- */

type RentStatus = RentEntry["status"];

const STATUS_META: Record<
  RentStatus,
  { label: string; glow: string; color: string; chip: string; dot: string }
> = {
  paid: { label: "Paid", glow: "ui-glow-green", color: "var(--success)", chip: "ui-chip-success", dot: "var(--success)" },
  pending: { label: "Pending Payment", glow: "ui-glow-orange", color: "var(--warning)", chip: "ui-chip-warning", dot: "var(--warning)" },
  overdue: { label: "Overdue", glow: "ui-glow-red", color: "var(--danger)", chip: "ui-chip-danger", dot: "var(--danger)" },
};

function statusDot(s: PropertyHealth["status"]) {
  return s === "Good" ? "var(--success)" : s === "Attention" ? "var(--warning)" : "var(--danger)";
}
const STATUS_GLOW: Record<PropertyHealth["status"], string> = {
  Good: "ui-status-good",
  Attention: "ui-status-attention",
  Critical: "ui-status-critical",
};

/* A quiet dot + label — replaces the loud status pills for a premium look. */
function StatusIndicator({ status }: { status: PropertyHealth["status"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusDot(status) }} />
      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{status}</span>
    </span>
  );
}

/* Colour the collection bar by how much rent has come in. */
function rateColor(pct: number) {
  if (pct >= 85) return "var(--success)";
  if (pct >= 50) return "var(--warning)";
  return "var(--danger)";
}
function prioColor(priority: string, reason: "urgent" | "overdue") {
  const p = priority.toLowerCase();
  if (reason === "urgent" || p === "urgent" || p === "high") return "var(--danger)";
  if (p === "medium" || reason === "overdue") return "var(--warning)";
  return "var(--accent)";
}

type MaintStatusKey = "pending" | "in_progress" | "completed";
type MaintPriorityKey = "low" | "medium" | "high" | "urgent";
const STATUS_LABELS: Record<MaintStatusKey, string> = { pending: "Pending", in_progress: "In Progress", completed: "Completed" };
const PRIORITY_LABELS: Record<MaintPriorityKey, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
function normStatus(v: string): MaintStatusKey {
  const s = v.trim().toLowerCase();
  if (s === "in progress" || s === "in_progress") return "in_progress";
  if (s === "completed") return "completed";
  return "pending";
}
function normPriority(v: string): MaintPriorityKey {
  const s = v.trim().toLowerCase();
  if (s === "urgent") return "urgent";
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  return "low";
}

const fieldInputCls = "w-full px-3 py-2 text-sm rounded-lg border outline-none transition focus:border-[var(--accent)]";
const fieldInputStyle: React.CSSProperties = { borderColor: "var(--border-soft)", background: "var(--surface)", color: "var(--text-primary)" };

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>{label}</span>
      {children}
    </label>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b" style={{ borderColor: "var(--border-soft)" }}>
      <span className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>{label}</span>
      <span className={"text-sm text-right truncate " + (mono ? "font-mono" : "")} style={{ color: "var(--text-primary)" }}>{value || "—"}</span>
    </div>
  );
}

/* ----------------------- full payment status meta ----------------------- */

type FullStatus = "paid" | "partial" | "pending" | "overdue" | "none";
const FULL_STATUS_META: Record<FullStatus, { label: string; chip: string; color: string }> = {
  paid: { label: "Paid", chip: "ui-chip-success", color: "var(--success)" },
  partial: { label: "Partial", chip: "ui-chip-warning", color: "var(--warning)" },
  pending: { label: "Pending", chip: "ui-chip-warning", color: "var(--warning)" },
  overdue: { label: "Overdue", chip: "ui-chip-danger", color: "var(--danger)" },
  none: { label: "Not billed", chip: "", color: "var(--text-faint)" },
};

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

function methodLabel(m: string) {
  if (!m) return "";
  return PAYMENT_METHOD_LABEL[m as PaymentMethod] ?? m;
}

/** A small block heading used to group read-only context inside drawers. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: "var(--text-faint)" }}>
      {children}
    </p>
  );
}

/** One row in the payment-history list (read-only). */
function HistoryRow({ h }: { h: PaymentHistoryItem }) {
  const m = FULL_STATUS_META[h.status];
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", borderLeft: `3px solid ${m.color}` }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{h.period || "—"}</p>
        <p className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
          {h.paymentDate ? fmtDate(h.paymentDate) : "No payment date"}
          {h.method ? ` · ${methodLabel(h.method)}` : ""}
        </p>
      </div>
      <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>{fmtMYR(h.amount)}</span>
      <span className={"ui-chip shrink-0 " + m.chip}>{m.label}</span>
    </div>
  );
}

/** One row in the open-issues list (read-only). */
function IssueRow({ i }: { i: UnitIssue }) {
  const p = i.priority.toLowerCase();
  const color = p === "urgent" || p === "high" ? "var(--danger)" : p === "medium" ? "var(--warning)" : "var(--accent)";
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", borderLeft: `3px solid ${color}` }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{i.issue}</p>
        {i.status ? <p className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>{i.status}</p> : null}
      </div>
      {i.priority ? (
        <span className="ui-chip shrink-0" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>{i.priority}</span>
      ) : null}
    </div>
  );
}

/* -------------------------------- Drawer ---------------------------------- */

function Drawer({
  eyebrow,
  title,
  onClose,
  children,
  footer,
  wide,
  dirty = false,
}: {
  eyebrow?: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  /** When true, closing prompts a discard/keep-editing confirmation. */
  dirty?: boolean;
}) {
  const confirm = useConfirm();

  const requestClose = useCallback(async () => {
    if (dirty) {
      const { confirmed } = await confirm({
        title: "Discard changes?",
        message: "You have unsaved changes. Discard them and close?",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      });
      if (!confirmed) return;
    }
    onClose();
  }, [dirty, confirm, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={requestClose}
    >
      <div
        className={"w-full max-h-[92vh] overflow-y-auto flex flex-col rounded-2xl " + (wide ? "max-w-4xl" : "max-w-2xl")}
        style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", boxShadow: "0 24px 64px rgba(15,17,22,0.24)", animation: "emsPop 180ms cubic-bezier(.2,.7,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-3 p-5 sm:p-6 border-b sticky top-0 z-10"
          style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
        >
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                {eyebrow}
              </p>
            ) : null}
            <h3 className="text-lg font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {title}
            </h3>
          </div>
          <button type="button" className="ui-btn shrink-0" onClick={requestClose}>
            Close
          </button>
        </div>

        <div className="p-5 sm:p-6 flex-1">{children}</div>

        {footer ? (
          <div
            className="p-4 border-t flex justify-end gap-2 sticky bottom-0"
            style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------- Toggle control ----------------------------- */

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      className="inline-flex p-0.5 rounded-lg"
      style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className="px-3 py-1 text-[11px] font-medium rounded-md transition"
            style={{
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
              boxShadow: active ? "var(--shadow-xs)" : "none",
              border: active ? "1px solid var(--accent)" : "1px solid transparent",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================== TOP: KPI ROW ============================== */

function RentSummaryButton({ data, onOpen }: { data: DashboardData; onOpen: () => void }) {
  const c = data.collection;
  const k = data.kpis;
  const stats = [
    { label: "Collected", value: c.collected, color: "var(--success)" },
    { label: "Outstanding", value: data.kpis.outstanding, color: "var(--warning)" },
    { label: "Overdue", value: k.overdue, color: "var(--danger)" },
  ];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="ui-kpi ui-breathe text-left w-full transition hover:border-[var(--accent)] cursor-pointer"
      style={{ ["--breathe-color" as string]: "var(--accent-ring)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          Rent · This Month
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {fmtMYR(c.collected)}
        <span className="text-sm font-medium" style={{ color: "var(--text-faint)" }}>
          {" "}/ {fmtMYR(c.billed)}
        </span>
      </div>
      {/* Collection rate — bar carries the status, no badge needed */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>Collection Rate</span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: rateColor(c.ratePct) }}>
            {c.ratePct}%
          </span>
        </div>
        <div className="flex h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--surface-muted)" }}>
          <div style={{ width: `${c.ratePct}%`, background: rateColor(c.ratePct), transition: "width 300ms ease" }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-sm font-semibold tabular-nums" style={{ color: s.color }}>
              {compactMYR(s.value)}
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>
        Tap to view tenants by payment status →
      </p>
    </button>
  );
}

function OccupancyButton({ data, onOpen }: { data: DashboardData; onOpen: () => void }) {
  const k = data.kpis;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="ui-kpi ui-breathe text-left w-full transition hover:border-[var(--accent)] cursor-pointer"
      style={{ ["--breathe-color" as string]: "rgba(47,158,111,0.30)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          Occupancy
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {k.occupancyPct}%
      </div>
      {/* Occupancy rate — the bar communicates how full the portfolio is */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>Occupancy Rate</span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: rateColor(k.occupancyPct) }}>
            {k.occupancyPct}%
          </span>
        </div>
        <div className="flex h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--surface-muted)" }}>
          <div style={{ width: `${k.occupancyPct}%`, background: rateColor(k.occupancyPct), transition: "width 300ms ease" }} />
        </div>
      </div>
      <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        {k.rentedUnits} of {k.totalUnits} units rented · {k.vacantUnits} vacant
      </p>
      <p className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>
        Tap to see which units are occupied →
      </p>
    </button>
  );
}

/* =========================== Occupancy drawer ============================ */

function UnitRowItem({ u, onClick }: { u: UnitDetail; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <li>
      <Tag
        type={onClick ? "button" : undefined}
        onClick={onClick}
        className={
          "w-full text-left flex items-center gap-3 rounded-xl px-3.5 py-3 transition " +
          (onClick ? "hover:border-[var(--accent)] cursor-pointer" : "")
        }
        style={{
          background: "var(--surface-muted)",
          border: "1px solid var(--border-soft)",
          borderLeft: `3px solid ${u.isRented ? "var(--success)" : "var(--warning)"}`,
        }}
      >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          background: u.isRented ? "rgba(47,158,111,0.12)" : "var(--surface-subtle)",
          color: u.isRented ? "var(--success)" : "var(--text-faint)",
        }}
      >
        {u.label?.slice(0, 3) || "—"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {u.property} · {u.unit}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
          {u.isRented ? u.tenant || "Rented" : "Vacant"}
          {u.rentalRate ? ` · RM ${u.rentalRate}/mo` : ""}
        </p>
      </div>
      <span className={"ui-chip shrink-0 " + (u.isRented ? "ui-chip-success" : "ui-chip-warning")}>
        {u.isRented ? "Occupied" : "Vacant"}
      </span>
      </Tag>
    </li>
  );
}

function OccupancyDrawer({
  units,
  occupancyPct,
  onClose,
  onOpenUnit,
}: {
  units: UnitDetail[];
  occupancyPct: number;
  onClose: () => void;
  onOpenUnit: (u: UnitDetail) => void;
}) {
  const [filter, setFilter] = useState<"all" | "occupied" | "vacant">("all");
  const filtered = units.filter((u) =>
    filter === "all" ? true : filter === "occupied" ? u.isRented : !u.isRented
  );
  const occupied = units.filter((u) => u.isRented).length;
  const vacant = units.length - occupied;

  return (
    <Drawer
      eyebrow="Occupancy"
      title={`${occupancyPct}% occupied`}
      onClose={onClose}
      footer={
        <Link href="/admin/properties" className="ui-btn ui-btn-primary">
          Bring me there
        </Link>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          <span className="ui-chip ui-chip-success">{occupied} occupied</span>
          <span className="ui-chip ui-chip-warning">{vacant} vacant</span>
        </div>
        <Segmented
          ariaLabel="Filter units"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "occupied", label: "Occupied" },
            { value: "vacant", label: "Vacant" },
          ]}
        />
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>
        Tap a unit to view details or update its occupancy.
      </p>
      {filtered.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
          No units to show.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filtered.map((u) => (
            <UnitRowItem key={u.id} u={u} onClick={() => onOpenUnit(u)} />
          ))}
        </ul>
      )}
    </Drawer>
  );
}

/* ============================== Rent drawer ============================== */

type RentFilter = "all" | "paid" | "pending" | "overdue";

function RentDrawer({
  roster,
  onClose,
  onOpenItem,
}: {
  roster: RentEntry[];
  onClose: () => void;
  onOpenItem: (r: RentEntry) => void;
}) {
  const [filter, setFilter] = useState<RentFilter>("all");
  const [view, setView] = useState<"grid" | "table">("grid");

  const counts = useMemo(() => {
    const c = { paid: 0, pending: 0, overdue: 0 };
    for (const r of roster) c[r.status] += 1;
    return c;
  }, [roster]);

  const filtered = filter === "all" ? roster : roster.filter((r) => r.status === filter);

  return (
    <Drawer
      eyebrow="Rent collection · This month"
      title="Tenant payment status"
      onClose={onClose}
      wide
      footer={
        <Link href="/admin/tenants" className="ui-btn ui-btn-primary">
          Bring me there
        </Link>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Segmented
          ariaLabel="Filter by payment status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All (${roster.length})` },
            { value: "paid", label: `Paid (${counts.paid})` },
            { value: "pending", label: `Pending (${counts.pending})` },
            { value: "overdue", label: `Overdue (${counts.overdue})` },
          ]}
        />
        <Segmented
          ariaLabel="Switch view"
          value={view}
          onChange={setView}
          options={[
            { value: "grid", label: "Grid" },
            { value: "table", label: "Table" },
          ]}
        />
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>
        Tap a tenant to see their contact details or update their payment.
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
          No tenants match this filter.
        </p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((r) => {
            const m = STATUS_META[r.status];
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => onOpenItem(r)}
                className={"ui-card p-4 flex flex-col gap-2 text-left transition hover:border-[var(--accent)] cursor-pointer " + m.glow}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {r.tenant}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {r.unit}
                    </p>
                    {r.phone ? (
                      <p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>{r.phone}</p>
                    ) : null}
                  </div>
                  <span className={"ui-chip shrink-0 " + m.chip}>{m.label}</span>
                </div>
                <div className="flex items-end justify-between gap-2 pt-2 border-t" style={{ borderColor: "var(--border-soft)" }}>
                  <div>
                    <p className="text-lg font-bold tabular-nums" style={{ color: m.color }}>
                      {fmtMYR(r.amount)}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {r.period}
                      {r.status === "overdue" && r.daysOverdue > 0 ? ` · ${r.daysOverdue}d overdue` : ""}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="ui-card overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead style={{ background: "var(--surface-muted)" }}>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Tenant</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Unit</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Period</th>
                <th className="text-right text-xs uppercase tracking-wider px-4 py-3">Amount</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const m = STATUS_META[r.status];
                return (
                  <tr
                    key={r.id}
                    onClick={() => onOpenItem(r)}
                    className="border-t cursor-pointer hover:bg-[var(--surface-muted)] transition-colors"
                    style={{ borderColor: "var(--border-soft)", borderLeft: `3px solid ${m.dot}` }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{r.tenant}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{r.unit}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{r.period}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: m.color }}>{fmtMYR(r.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={"ui-chip " + m.chip}>{m.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Drawer>
  );
}

/* ===================== Item view/edit drawers ========================== */

function RentItemDrawer({
  entry,
  onClose,
  onSaved,
}: {
  entry: RentEntry;
  onClose: () => void;
  onSaved: (patch: Partial<RentEntry>) => void;
}) {
  const { updateRevenueEntry } = useRental();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>(
    entry.status === "paid" ? "paid" : entry.status === "overdue" ? "overdue" : "pending"
  );
  const [amount, setAmount] = useState(String(entry.amount));
  const [payDate, setPayDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const m = STATUS_META[entry.status];

  // Unsaved edits = in edit mode with a changed field.
  const initStatus: PaymentStatus =
    entry.status === "paid" ? "paid" : entry.status === "overdue" ? "overdue" : "pending";
  const dirty =
    editing && (status !== initStatus || amount !== String(entry.amount) || payDate !== "");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const patch: Partial<RevenueEntry> = {
        payment_status: status,
        total_amount: Number(amount) || 0,
      };
      if (payDate) patch.payment_date = payDate;
      await updateRevenueEntry(entry.id, patch);
      onSaved({
        status: status === "paid" ? "paid" : status === "overdue" ? "overdue" : "pending",
        amount: Number(amount) || 0,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      eyebrow={`Rent · ${entry.period}`}
      title={entry.tenant}
      onClose={onClose}
      dirty={dirty}
      footer={
        editing ? (
          <>
            <button type="button" className="ui-btn" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            <button type="button" className="ui-btn ui-btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        ) : (
          <>
            <Link href="/admin/tenants" className="ui-btn mr-auto">Bring me there</Link>
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => setEditing(true)}>Edit</button>
          </>
        )
      }
    >
      {editing ? (
        <div className="flex flex-col gap-4">
          <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            Only the payment can be updated here. Tenant name, contact and lease are managed on the Tenants page.
          </p>
          <EditField label="Payment status">
            <Select
              value={status}
              onChange={(v) => setStatus(v as PaymentStatus)}
              options={(["paid", "partial", "pending", "overdue"] as PaymentStatus[]).map((s) => ({ value: s, label: PAYMENT_STATUS_LABEL[s] }))}
            />
          </EditField>
          <EditField label="Amount (RM)">
            <input type="number" inputMode="decimal" min={0} step="0.01" className={fieldInputCls} style={fieldInputStyle}
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </EditField>
          <EditField label="Payment date (optional)">
            <DatePickerField value={payDate} onChange={setPayDate} ariaLabel="Payment date" />
          </EditField>
          {error ? <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className={"ui-chip " + m.chip}>{m.label}</span>
            <div className="text-right">
              <span className="text-2xl font-bold tabular-nums block" style={{ color: m.color }}>{fmtMYR(entry.amount)}</span>
              <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                {entry.period}
                {entry.status === "overdue" && entry.daysOverdue > 0 ? ` · ${entry.daysOverdue} days overdue` : ""}
              </span>
            </div>
          </div>

          {/* Charge breakdown — explains how the total is made up */}
          <section>
            <SectionLabel>This payment</SectionLabel>
            <div className="flex flex-col">
              <DetailRow label="Rent" value={entry.rentalAmount ? fmtMYR(entry.rentalAmount) : "—"} />
              <DetailRow
                label="Electricity"
                value={
                  entry.electricityAmount
                    ? `${fmtMYR(entry.electricityAmount)}${entry.electricityUnits ? ` · ${entry.electricityUnits} units` : ""}`
                    : "—"
                }
              />
              <DetailRow label="Other charges" value={entry.otherCharges ? fmtMYR(entry.otherCharges) : "—"} />
              <DetailRow label="Total" value={fmtMYR(entry.amount)} />
              <DetailRow label="Payment method" value={methodLabel(entry.paymentMethod)} />
              <DetailRow label="Paid on" value={fmtDate(entry.paymentDate)} />
              <DetailRow label="Invoice" value={entry.invoiceNumber ? `${entry.invoiceNumber}${entry.invoiceSent ? " · sent" : ""}` : entry.invoiceSent ? "Sent" : "—"} />
            </div>
            {entry.notes ? (
              <p className="text-sm mt-3 leading-6" style={{ color: "var(--text-secondary)" }}>
                <span className="text-[11px] uppercase tracking-wider mr-2" style={{ color: "var(--text-faint)" }}>Note</span>
                {entry.notes}
              </p>
            ) : null}
          </section>

          {/* Tenant — read-only contact pulled from the Tenants directory */}
          <section>
            <SectionLabel>Tenant &amp; lease</SectionLabel>
            <div className="flex flex-col">
              <DetailRow label="Name" value={entry.tenant} />
              <DetailRow label="Unit" value={entry.unit} />
              <DetailRow label="Phone" value={entry.phone} />
              <DetailRow label="Email" value={entry.email} />
              <DetailRow label="Lease start" value={fmtDate(entry.leaseStart)} />
              <DetailRow label="Lease ends" value={fmtDate(entry.leaseEnd)} />
            </div>
            <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
              Name and contact details are read-only here. Change them on the{" "}
              <Link href="/admin/tenants" className="font-medium" style={{ color: "var(--accent)" }}>Tenants</Link> page.
            </p>
          </section>

          {/* Latest pending / overdue across all periods */}
          {(() => {
            const outstanding = entry.history.filter((h) => h.status === "pending" || h.status === "overdue" || h.status === "partial");
            return outstanding.length ? (
              <section>
                <SectionLabel>Other outstanding payments ({outstanding.length})</SectionLabel>
                <div className="flex flex-col gap-2">
                  {outstanding.slice(0, 4).map((h) => <HistoryRow key={h.id} h={h} />)}
                </div>
              </section>
            ) : null;
          })()}

          {/* Past payment history */}
          <section>
            <SectionLabel>Payment history</SectionLabel>
            {entry.history.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No earlier records for this tenant.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {entry.history.map((h) => <HistoryRow key={h.id} h={h} />)}
              </div>
            )}
          </section>

          {/* Open maintenance / issues the tenant is dealing with */}
          {entry.openIssues.length > 0 ? (
            <section>
              <SectionLabel>Open issues ({entry.openIssues.length})</SectionLabel>
              <div className="flex flex-col gap-2">
                {entry.openIssues.map((i) => <IssueRow key={i.id} i={i} />)}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}

function UnitItemDrawer({
  unit,
  onClose,
  onSaved,
}: {
  unit: UnitDetail;
  onClose: () => void;
  onSaved: (patch: Partial<UnitDetail>) => void;
}) {
  const { updateUnit, updateTenant, tenants } = useRental();
  const [editing, setEditing] = useState(false);
  const [occupied, setOccupied] = useState(unit.isRented);
  const [tenantId, setTenantId] = useState<string>(
    () => tenants.find((t) => t.name === unit.tenant)?.id ?? ""
  );
  const [rate, setRate] = useState(unit.rentalRate ? String(unit.rentalRate) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An occupied unit must name its tenant — can't save without one.
  const missingTenant = occupied && !tenantId;

  async function save() {
    if (missingTenant) {
      setError("Choose a tenant for an occupied unit, or set it back to Vacant.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const t = occupied ? tenants.find((x) => x.id === tenantId) : undefined;
      await updateUnit(unit.id, {
        is_rented: occupied,
        tenant_name: occupied ? t?.name ?? null : null,
        rental_rate: rate ? Number(rate) : null,
      });
      // Link the chosen tenant to this unit so the Tenants page stays in sync.
      if (t && t.unit_id !== unit.id) {
        await updateTenant(t.id, { unit_id: unit.id });
      }
      onSaved({ isRented: occupied, tenant: occupied ? t?.name ?? "" : "", rentalRate: Number(rate) || 0 });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the unit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      eyebrow={unit.property}
      title={unit.unit}
      onClose={onClose}
      footer={
        editing ? (
          <>
            <button type="button" className="ui-btn" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            <button type="button" className="ui-btn ui-btn-primary" onClick={save} disabled={saving || missingTenant}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        ) : (
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setEditing(true)}>Edit</button>
        )
      }
    >
      {editing ? (
        <div className="flex flex-col gap-4">
          <EditField label="Occupancy">
            <Select
              value={occupied ? "occupied" : "vacant"}
              onChange={(v) => setOccupied(v === "occupied")}
              options={[
                { value: "vacant", label: "Vacant" },
                { value: "occupied", label: "Occupied" },
              ]}
            />
          </EditField>
          {/* The tenant picker only appears once the unit is Occupied, and a
              tenant must be chosen from the directory before saving. */}
          {occupied ? (
            <EditField label="Tenant">
              <Select
                value={tenantId}
                placeholder="Select a tenant…"
                onChange={setTenantId}
                options={tenants.map((t) => ({ value: t.id, label: t.name }))}
              />
              <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                Choose from the{" "}
                <Link href="/admin/tenants" className="font-medium" style={{ color: "var(--accent)" }}>
                  Tenants directory
                </Link>
                .
              </span>
            </EditField>
          ) : null}
          <EditField label="Rental rate (RM / month)">
            <input type="number" inputMode="decimal" min={0} step="0.01" className={fieldInputCls} style={fieldInputStyle}
              value={rate} onChange={(e) => setRate(e.target.value)} />
          </EditField>
          {error ? <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <span className={"ui-chip w-fit " + (unit.isRented ? "ui-chip-success" : "ui-chip-warning")}>
              {unit.isRented ? "Occupied" : "Vacant"}
            </span>
            {unit.rentalRate ? (
              <span className="text-xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                RM {unit.rentalRate}
                <span className="text-xs font-medium" style={{ color: "var(--text-faint)" }}> /mo</span>
              </span>
            ) : null}
          </div>

          {/* Unit + tenant overview */}
          <section>
            <SectionLabel>Unit</SectionLabel>
            <div className="flex flex-col">
              <DetailRow label="Property" value={unit.property} />
              <DetailRow label="Unit" value={unit.unit} />
              <DetailRow label="Rental rate" value={unit.rentalRate ? `RM ${unit.rentalRate}/mo` : "—"} />
              <DetailRow label="Open issues" value={unit.openIssues > 0 ? String(unit.openIssues) : "None"} />
            </div>
          </section>

          {unit.isRented ? (
            <>
              {/* Who lives here — read-only, sourced from Tenants */}
              <section>
                <SectionLabel>Tenant</SectionLabel>
                <div className="flex flex-col">
                  <DetailRow label="Name" value={unit.tenant || "—"} />
                  <DetailRow label="Phone" value={unit.phone} />
                  <DetailRow label="Email" value={unit.email} />
                  <DetailRow label="Lease start" value={fmtDate(unit.leaseStart)} />
                  <DetailRow label="Lease ends" value={fmtDate(unit.leaseEnd)} />
                </div>
                <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
                  Tenant name and contact are read-only here. Edit them on the{" "}
                  <Link href="/admin/tenants" className="font-medium" style={{ color: "var(--accent)" }}>Tenants</Link> page.
                </p>
              </section>

              {/* Have they paid this month? */}
              <section>
                <SectionLabel>This month&apos;s rent</SectionLabel>
                {unit.currentStatus === "none" ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    No rent entry recorded for {unit.currentPeriod} yet.
                  </p>
                ) : (
                  <div
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{
                      background: "var(--surface-muted)",
                      border: "1px solid var(--border-soft)",
                      borderLeft: `3px solid ${FULL_STATUS_META[unit.currentStatus].color}`,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{unit.currentPeriod}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>Current billing period</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtMYR(unit.currentAmount)}</span>
                    <span className={"ui-chip " + FULL_STATUS_META[unit.currentStatus].chip}>
                      {FULL_STATUS_META[unit.currentStatus].label}
                    </span>
                  </div>
                )}
                <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
                  Update payment status from the{" "}
                  <Link href="/admin/tenants" className="font-medium" style={{ color: "var(--accent)" }}>Tenant payment status</Link> view.
                </p>
              </section>
            </>
          ) : (
            <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>
              This unit is vacant. Set it to occupied and assign a tenant using Edit.
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}

function MaintItemDrawer({
  item,
  onClose,
  onSaved,
}: {
  item: MaintItem;
  onClose: () => void;
  onSaved: (patch: Partial<MaintItem>) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<MaintStatusKey>(normStatus(item.status));
  const [priority, setPriority] = useState<MaintPriorityKey>(normPriority(item.priority));
  const [assignedTo, setAssignedTo] = useState(item.assignedTo);
  const [dueDate, setDueDate] = useState(item.dueDate);
  const [description, setDescription] = useState(item.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const color = prioColor(item.priority, item.reason);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (isPersistedId(item.id)) {
        await dbUpdate("maintenance", item.id, {
          status: STATUS_LABELS[status],
          priority: PRIORITY_LABELS[priority],
          assignedTo: assignedTo.trim(),
          dueDate: dueDate || undefined,
          description: description.trim(),
        });
      }
      onSaved({
        status: STATUS_LABELS[status],
        priority: PRIORITY_LABELS[priority],
        assignedTo: assignedTo.trim(),
        dueDate,
        description: description.trim(),
      });
      router.refresh();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the maintenance case.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      eyebrow="Maintenance request"
      title={item.issue}
      onClose={onClose}
      footer={
        editing ? (
          <>
            <button type="button" className="ui-btn" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            <button type="button" className="ui-btn ui-btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        ) : (
          <>
            <Link href="/admin/maintenance" className="ui-btn mr-auto">Bring me there</Link>
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => setEditing(true)}>Edit</button>
          </>
        )
      }
    >
      {editing ? (
        <div className="flex flex-col gap-4">
          {/* Tenant is shown for context only — it is not editable here. To
              reassign a tenant, change it on the Property or Tenants page. */}
          <EditField label="Tenant (view only)">
            <input
              className={fieldInputCls}
              style={{ ...fieldInputStyle, background: "var(--surface-muted)", color: "var(--text-muted)", cursor: "not-allowed" }}
              value={item.tenant || "—"}
              readOnly
              disabled
              tabIndex={-1}
            />
            <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              To change the tenant, update it on the{" "}
              <Link href="/admin/properties" className="font-medium" style={{ color: "var(--accent)" }}>Property</Link>
              {" "}or{" "}
              <Link href="/admin/tenants" className="font-medium" style={{ color: "var(--accent)" }}>Tenants</Link>
              {" "}page.
            </span>
          </EditField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EditField label="Status">
              <Select value={status} onChange={(v) => setStatus(v as MaintStatusKey)}
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "in_progress", label: "In Progress" },
                  { value: "completed", label: "Completed" },
                ]} />
            </EditField>
            <EditField label="Priority">
              <Select value={priority} onChange={(v) => setPriority(v as MaintPriorityKey)}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                  { value: "urgent", label: "Urgent" },
                ]} />
            </EditField>
            <EditField label="Assigned to">
              <input className={fieldInputCls} style={fieldInputStyle} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
            </EditField>
            <EditField label="Due date">
              <DatePickerField value={dueDate} onChange={setDueDate} ariaLabel="Due date" />
            </EditField>
          </div>
          <EditField label="Description">
            <textarea rows={4} className={fieldInputCls + " resize-y"} style={fieldInputStyle} value={description} onChange={(e) => setDescription(e.target.value)} />
          </EditField>
          {error ? <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {item.category ? <span className="ui-chip">{item.category}</span> : null}
            <span className="ui-chip" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
              {item.priority || (item.reason === "urgent" ? "Urgent" : "Overdue")}
            </span>
            {item.status ? <span className="ui-chip">{item.status}</span> : null}
          </div>
          <div className="flex flex-col">
            <DetailRow label="Property" value={item.property} />
            <DetailRow label="Unit" value={item.unit} />
            <DetailRow label="Tenant" value={item.tenant} />
            <DetailRow label="Reported" value={item.reportedDate} />
            <DetailRow label="Due" value={item.dueDate} />
            <DetailRow label="Assigned" value={item.assignedTo} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Description</p>
            <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{item.description || "No description added."}</p>
          </div>
        </div>
      )}
    </Drawer>
  );
}

/* ========================== Property section ============================ */

type PropView = "property" | "condition";
const PROP_VIEW_KEY = "dashboard:propertyView";

function PropertyDrawer({
  property,
  initialView,
  onClose,
  onOpenUnit,
}: {
  property: PropertyHealth;
  initialView: PropView;
  onClose: () => void;
  onOpenUnit: (u: UnitDetail) => void;
}) {
  const [view, setView] = useState<PropView>(initialView);
  const p = property;
  const occupied = p.units.filter((u) => u.isRented);
  const vacant = p.units.filter((u) => !u.isRented);

  return (
    <Drawer
      eyebrow={p.modelLabel}
      title={p.name}
      onClose={onClose}
      wide
      footer={
        <Link href={`/admin/properties/${p.id}`} className="ui-btn ui-btn-primary">
          Open full property page
        </Link>
      }
    >
      <div className="flex items-center justify-between gap-3 mb-5">
        <Segmented
          ariaLabel="Switch property view"
          value={view}
          onChange={setView}
          options={[
            { value: "property", label: "Property Detail" },
            { value: "condition", label: "Condition" },
          ]}
        />
        <StatusIndicator status={p.status} />
      </div>

      {view === "property" ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imageUrl}
                alt={p.name}
                className="w-full aspect-[4/3] object-cover rounded-xl"
                style={{ background: "var(--surface-subtle)" }}
              />
            ) : (
              <div className="w-full aspect-[4/3] rounded-xl flex items-center justify-center text-xs" style={{ background: "var(--surface-subtle)", color: "var(--text-faint)" }}>
                No image
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{p.address || "—"}</p>
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                {[p.city, p.state].filter(Boolean).join(", ") || "—"}
              </p>
              {p.propertyType ? <span className="ui-chip w-fit mt-1">{p.propertyType}</span> : null}
              {p.description ? (
                <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {p.description}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {p.isWhole ? (
              <StatBox
                label="Status"
                value={p.rentedUnits > 0 ? "Occupied" : "Vacant"}
                color={p.rentedUnits > 0 ? "var(--success)" : "var(--warning)"}
              />
            ) : (
              <StatBox label="Occupancy" value={`${p.occupancyPct}%`} sub={`${p.rentedUnits}/${p.totalUnits} ${p.unitWord}`} />
            )}
            <StatBox label="Revenue (mo)" value={compactMYR(p.monthlyRevenue)} />
            <StatBox label="Outstanding" value={p.outstanding > 0 ? compactMYR(p.outstanding) : "—"} color={p.outstanding > 0 ? "var(--danger)" : undefined} />
            <StatBox label="Open Issues" value={String(p.issues)} color={p.urgentIssues > 0 ? "var(--danger)" : p.issues > 0 ? "var(--warning)" : undefined} />
          </div>

          <section>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>
              {p.unitWord.charAt(0).toUpperCase() + p.unitWord.slice(1)} ({p.units.length})
            </p>
            {p.units.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No units recorded.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {[...occupied, ...vacant].map((u) => (
                  <UnitRowItem key={u.id} u={u} onClick={() => onOpenUnit(u)} />
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", borderLeft: `3px solid ${statusDot(p.status)}` }}
          >
            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: statusDot(p.status) }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.status} condition</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{p.reason}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {p.isWhole ? (
              <StatBox
                label="Status"
                value={p.rentedUnits > 0 ? "Occupied" : "Vacant"}
                color={p.rentedUnits > 0 ? "var(--success)" : "var(--warning)"}
              />
            ) : (
              <>
                <StatBox label="Occupancy" value={`${p.occupancyPct}%`} sub={`${p.rentedUnits}/${p.totalUnits} ${p.unitWord}`} />
                <StatBox label="Vacant" value={String(p.totalUnits - p.rentedUnits)} color={p.totalUnits - p.rentedUnits > 0 ? "var(--warning)" : undefined} />
              </>
            )}
            <StatBox label="Outstanding Rent" value={p.outstanding > 0 ? compactMYR(p.outstanding) : "—"} color={p.outstanding > 0 ? "var(--danger)" : undefined} />
            <StatBox label="Open Issues" value={String(p.issues)} color={p.issues > 0 ? "var(--warning)" : undefined} />
            <StatBox label="Urgent Issues" value={String(p.urgentIssues)} color={p.urgentIssues > 0 ? "var(--danger)" : undefined} />
            <StatBox label="Revenue (mo)" value={compactMYR(p.monthlyRevenue)} />
          </div>
        </div>
      )}
    </Drawer>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl px-3.5 py-3" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</p>
      <p className="text-base font-semibold mt-0.5 tabular-nums" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
      {sub ? <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p> : null}
    </div>
  );
}

function PropertySection({
  rows,
  onOpen,
}: {
  rows: PropertyHealth[];
  onOpen: (p: PropertyHealth, view: PropView) => void;
}) {
  const [view, setView] = useState<PropView>("property");

  useEffect(() => {
    const saved = window.localStorage.getItem(PROP_VIEW_KEY);
    if (saved === "property" || saved === "condition") setView(saved);
  }, []);
  useEffect(() => {
    window.localStorage.setItem(PROP_VIEW_KEY, view);
  }, [view]);

  return (
    <section className="ui-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Properties
        </h3>
        <Segmented
          ariaLabel="Switch property view"
          value={view}
          onChange={setView}
          options={[
            { value: "property", label: "Property" },
            { value: "condition", label: "Condition" },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm py-3" style={{ color: "var(--text-muted)" }}>
          No properties yet. Add one to start tracking.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {rows.map((p) => (
            <button
              key={p.id || p.name}
              type="button"
              onClick={() => onOpen(p, view)}
              className={"text-left rounded-xl flex flex-col overflow-hidden transition cursor-pointer " + STATUS_GLOW[p.status]}
              style={{
                background: "var(--surface-muted)",
                border: "1px solid var(--border-soft)",
                borderLeft: `3px solid ${statusDot(p.status)}`,
              }}
            >
              {/* Picture-forward header — the overview leads with the cover image. */}
              <div className="relative w-full aspect-[16/9] overflow-hidden" style={{ background: "var(--surface-subtle)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl || PROPERTY_FALLBACK_IMAGE}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    if (e.currentTarget.src !== PROPERTY_FALLBACK_IMAGE) {
                      e.currentTarget.src = PROPERTY_FALLBACK_IMAGE;
                    }
                  }}
                />
              </div>

              <div className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {p.name}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                    {view === "property"
                      ? [p.city, p.state].filter(Boolean).join(", ") || p.modelLabel
                      : p.isWhole
                        ? `${p.modelLabel} · ${p.rentedUnits > 0 ? "Occupied" : "Vacant"}`
                        : `${p.modelLabel} · ${p.rentedUnits}/${p.totalUnits} ${p.unitWord} rented`}
                  </p>
                </div>
                <StatusIndicator status={p.status} />
              </div>

              {view === "property" ? (
                <div
                  className={"grid gap-2 pt-3 " + (p.isWhole ? "grid-cols-2" : "grid-cols-3")}
                  style={{ borderTop: "1px solid var(--border-soft)" }}
                >
                  {p.isWhole ? (
                    <MiniStat
                      label="Status"
                      value={p.rentedUnits > 0 ? "Occupied" : "Vacant"}
                      color={p.rentedUnits > 0 ? "var(--success)" : "var(--warning)"}
                    />
                  ) : (
                    <>
                      <MiniStat label="Occupancy" value={`${p.occupancyPct}%`} />
                      <MiniStat label="Units" value={`${p.rentedUnits}/${p.totalUnits}`} />
                    </>
                  )}
                  <MiniStat label="Revenue" value={compactMYR(p.monthlyRevenue)} />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
                    <MiniStat label="Revenue" value={compactMYR(p.monthlyRevenue)} />
                    <MiniStat
                      label="Outstanding"
                      value={p.outstanding > 0 ? compactMYR(p.outstanding) : "—"}
                      color={p.outstanding > 0 ? "var(--danger)" : undefined}
                    />
                    <MiniStat
                      label="Issues"
                      value={String(p.issues)}
                      color={p.urgentIssues > 0 ? "var(--danger)" : p.issues > 0 ? "var(--warning)" : undefined}
                    />
                  </div>
                  <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusDot(p.status) }} />
                    {p.reason}
                  </p>
                </>
              )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</p>
      <p className="text-sm font-semibold mt-0.5 tabular-nums truncate" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

/* =========================== Today's Checkup ============================ */

function Disclosure({
  title,
  count,
  tone,
  href,
  children,
  defaultOpen,
}: {
  title: string;
  count: number;
  tone: "danger" | "warning";
  href: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const color = tone === "danger" ? "var(--danger)" : "var(--warning)";
  const chip = tone === "danger" ? "ui-chip-danger" : "ui-chip-warning";
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-soft)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-muted)]"
        style={{ background: "var(--surface)" }}
        aria-expanded={open}
      >
        <span
          className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-md text-xs font-bold tabular-nums shrink-0"
          style={{ background: count > 0 ? (tone === "danger" ? "rgba(211,84,84,0.12)" : "rgba(224,162,61,0.14)") : "var(--surface-muted)", color: count > 0 ? color : "var(--text-faint)" }}
        >
          {count}
        </span>
        <span className="text-sm font-medium flex-1" style={{ color: "var(--text-primary)" }}>{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "var(--text-faint)", transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? (
        <div className="px-4 pb-4 pt-1 flex flex-col gap-2.5" style={{ background: "var(--surface)" }}>
          {count === 0 ? (
            <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>Nothing here right now.</p>
          ) : (
            children
          )}
          <Link href={href} className="text-xs font-medium self-start mt-1" style={{ color: "var(--accent)" }}>
            Bring me there →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function MaintCard({ m, onClick }: { m: MaintItem; onClick: () => void }) {
  const color = prioColor(m.priority, m.reason);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg px-3.5 py-3 flex items-start gap-3 transition hover:border-[var(--accent)] cursor-pointer"
      style={{
        background: `color-mix(in srgb, ${color} 8%, var(--surface-muted))`,
        border: "1px solid var(--border-soft)",
        borderLeft: `3px solid ${color}`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{m.issue}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{m.unit}</p>
      </div>
      <span
        className="ui-chip shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
      >
        {m.priority ? m.priority : m.reason === "urgent" ? "Urgent" : "Overdue"}
      </span>
    </button>
  );
}

function TodaysCheckup({
  urgent,
  vacant,
  onOpenMaint,
  onOpenUnit,
}: {
  urgent: MaintItem[];
  vacant: UnitDetail[];
  onOpenMaint: (m: MaintItem) => void;
  onOpenUnit: (u: UnitDetail) => void;
}) {
  const needsAttention = urgent.length + vacant.length;

  return (
    <section className="ui-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: needsAttention ? "var(--danger)" : "var(--success)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Today&apos;s Checkup</h3>
        </div>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          {needsAttention ? `${needsAttention} need${needsAttention === 1 ? "s" : ""} attention` : "All clear"}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <Disclosure
          title="Urgent Maintenance Requests"
          count={urgent.length}
          tone="danger"
          href="/admin/maintenance"
          defaultOpen={urgent.length > 0}
        >
          {urgent.map((m) => (
            <MaintCard key={m.id} m={m} onClick={() => onOpenMaint(m)} />
          ))}
        </Disclosure>

        <Disclosure
          title="Vacant Units to Follow Up"
          count={vacant.length}
          tone="warning"
          href="/admin/properties"
          defaultOpen={urgent.length === 0 && vacant.length > 0}
        >
          {vacant.map((u) => (
            <UnitRowItem key={u.id} u={u} onClick={() => onOpenUnit(u)} />
          ))}
        </Disclosure>
      </div>
    </section>
  );
}

/* ============================== Main client ============================= */

type Modal =
  | { kind: "none" }
  | { kind: "rent" }
  | { kind: "occupancy" }
  | { kind: "property"; property: PropertyHealth; view: PropView }
  | { kind: "rentItem"; entry: RentEntry }
  | { kind: "unitItem"; unit: UnitDetail }
  | { kind: "maintItem"; item: MaintItem };

export function DashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const close = () => setModal({ kind: "none" });

  // Optimistic overrides so edits made here show immediately, even before the
  // server component re-fetches from Supabase (we also call router.refresh()).
  const [rentOv, setRentOv] = useState<Record<string, Partial<RentEntry>>>({});
  const [unitOv, setUnitOv] = useState<Record<string, Partial<UnitDetail>>>({});
  const [maintOv, setMaintOv] = useState<Record<string, Partial<MaintItem>>>({});

  const rentRoster = useMemo(
    () => data.rentRoster.map((r) => ({ ...r, ...rentOv[r.id] })),
    [data.rentRoster, rentOv]
  );
  const units = useMemo(
    () => data.units.map((u) => ({ ...u, ...unitOv[u.id] })),
    [data.units, unitOv]
  );
  const vacantUnitsList = useMemo(() => units.filter((u) => !u.isRented), [units]);
  const urgentList = useMemo(
    () =>
      data.urgentMaintenanceList
        .map((m) => ({ ...m, ...maintOv[m.id] }))
        .filter((m) => m.status.trim().toLowerCase() !== "completed"),
    [data.urgentMaintenanceList, maintOv]
  );

  const refresh = () => router.refresh();

  return (
    <>
      {/* Top: interactive KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <RentSummaryButton data={data} onOpen={() => setModal({ kind: "rent" })} />
        <OccupancyButton data={data} onOpen={() => setModal({ kind: "occupancy" })} />
      </section>

      {/* Property section with Property/Condition switch */}
      <PropertySection
        rows={data.propertyHealth}
        onOpen={(property, view) => setModal({ kind: "property", property, view })}
      />

      {/* Today's checkup with dropdowns */}
      <TodaysCheckup
        urgent={urgentList}
        vacant={vacantUnitsList}
        onOpenMaint={(item) => setModal({ kind: "maintItem", item })}
        onOpenUnit={(unit) => setModal({ kind: "unitItem", unit })}
      />

      {modal.kind === "rent" ? (
        <RentDrawer roster={rentRoster} onClose={close} onOpenItem={(entry) => setModal({ kind: "rentItem", entry })} />
      ) : null}
      {modal.kind === "occupancy" ? (
        <OccupancyDrawer
          units={units}
          occupancyPct={data.kpis.occupancyPct}
          onClose={close}
          onOpenUnit={(unit) => setModal({ kind: "unitItem", unit })}
        />
      ) : null}
      {modal.kind === "property" ? (
        <PropertyDrawer
          property={modal.property}
          initialView={modal.view}
          onClose={close}
          onOpenUnit={(unit) => setModal({ kind: "unitItem", unit })}
        />
      ) : null}

      {modal.kind === "rentItem" ? (
        <RentItemDrawer
          entry={modal.entry}
          onClose={close}
          onSaved={(patch) => {
            setRentOv((o) => ({ ...o, [modal.entry.id]: { ...o[modal.entry.id], ...patch } }));
            refresh();
          }}
        />
      ) : null}
      {modal.kind === "unitItem" ? (
        <UnitItemDrawer
          unit={modal.unit}
          onClose={close}
          onSaved={(patch) => {
            setUnitOv((o) => ({ ...o, [modal.unit.id]: { ...o[modal.unit.id], ...patch } }));
            refresh();
          }}
        />
      ) : null}
      {modal.kind === "maintItem" ? (
        <MaintItemDrawer
          item={modal.item}
          onClose={close}
          onSaved={(patch) => {
            setMaintOv((o) => ({ ...o, [modal.item.id]: { ...o[modal.item.id], ...patch } }));
          }}
        />
      ) : null}
    </>
  );
}
