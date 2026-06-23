"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRental } from "@/context/RentalContext";
import { fmtMYR } from "@/lib/ledger";
import { RENTAL_MODEL_LABEL, type Property, type Unit } from "@/types/rental";

/** The deposit held for a room: an explicit amount when set, otherwise the
 *  computed rental_rate × deposit_months (mirrors the owner's spreadsheet). */
function effectiveDeposit(unit: Unit): number {
  if (unit.deposit_amount != null && unit.deposit_amount > 0) return unit.deposit_amount;
  const rate = unit.rental_rate ?? 0;
  const months = unit.deposit_months ?? 0;
  return rate * months;
}

export default function DepositsPage() {
  const { visibleProperties, getUnitsForProperty } = useRental();
  // "all" shows every property; otherwise a single selected property id.
  const [selected, setSelected] = useState<string>("all");

  // Every property that actually has rooms/units — these are the selectable tabs.
  const withUnits = useMemo(
    () =>
      visibleProperties
        .map((p) => ({ property: p, units: getUnitsForProperty(p.id) }))
        .filter((s) => s.units.length > 0),
    [visibleProperties, getUnitsForProperty]
  );

  const sections = useMemo(
    () => (selected === "all" ? withUnits : withUnits.filter((s) => s.property.id === selected)),
    [withUnits, selected]
  );

  const grandTotal = sections.reduce(
    (sum, s) => sum + s.units.reduce((u, unit) => u + effectiveDeposit(unit), 0),
    0
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
            Financials
          </p>
          <h2 className="text-2xl font-semibold mt-1 tracking-tight" style={{ color: "var(--text-primary)" }}>
            Deposits
          </h2>
          <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
            Security deposits held per room. The deposit defaults to rent &times; months and can be
            overridden. Damage deductions are taken from this balance and the remainder returned at lease end.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
            Total deposit held
          </p>
          <p className="text-2xl font-semibold mt-1 tabular-nums" style={{ color: "var(--accent)" }}>
            {fmtMYR(grandTotal)}
          </p>
        </div>
      </header>

      {/* Property selector — click a property to jump straight to it */}
      <div className="flex flex-wrap gap-2">
        <PropertyTab label="All Properties" active={selected === "all"} onClick={() => setSelected("all")} />
        {withUnits.map(({ property }) => (
          <PropertyTab
            key={property.id}
            label={property.short_name || property.name}
            active={selected === property.id}
            onClick={() => setSelected(property.id)}
          />
        ))}
      </div>

      {/* Per-property sections */}
      {sections.length === 0 ? (
        <div className="ui-card p-12 text-center" style={{ color: "var(--text-muted)" }}>
          <p className="text-sm">No rooms found for this property yet.</p>
        </div>
      ) : (
        sections.map(({ property, units }, i) => (
          <PropertyDepositSection
            key={property.id}
            property={property}
            units={units}
            divider={i > 0}
          />
        ))
      )}
    </div>
  );
}

/** A selectable property pill in the top nav strip. */
function PropertyTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="px-3.5 py-2 text-sm font-medium rounded-lg border transition"
      style={{
        background: active ? "var(--accent)" : "var(--surface)",
        color: active ? "#fff" : "var(--text-secondary)",
        borderColor: active ? "var(--accent)" : "var(--border-soft)",
      }}
    >
      {label}
    </button>
  );
}

function PropertyDepositSection({
  property,
  units,
  divider,
}: {
  property: Property;
  units: Unit[];
  divider?: boolean;
}) {
  const total = units.reduce((sum, u) => sum + effectiveDeposit(u), 0);
  const isWhole = property.rental_model === "whole_unit";

  return (
    <section
      className={"flex flex-col gap-3" + (divider ? " border-t pt-8" : "")}
      style={divider ? { borderColor: "var(--border-soft)" } : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin/properties/${property.id}`}
            className="text-lg font-semibold tracking-tight hover:underline"
            style={{ color: "var(--text-primary)" }}
          >
            {property.name}
          </Link>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
            {RENTAL_MODEL_LABEL[property.rental_model]}
            {property.city ? ` · ${property.city}` : ""} · {units.length} {isWhole ? "unit" : "rooms"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>
            Total deposit ({units.length} {isWhole ? "unit" : "rooms"})
          </p>
          <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
            {fmtMYR(total)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {units.map((unit) => (
          <DepositRoomCard key={unit.id} unit={unit} />
        ))}
      </div>
    </section>
  );
}

const fieldClass =
  "w-28 px-2.5 py-1.5 text-sm text-right rounded-md border outline-none transition focus:border-[var(--accent)] tabular-nums";
const fieldStyle: React.CSSProperties = {
  borderColor: "var(--border-soft)",
  background: "var(--surface)",
  color: "var(--text-primary)",
};

function parseField(v: string): number | null {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function DepositRoomCard({ unit }: { unit: Unit }) {
  const { updateUnit } = useRental();
  const rate = unit.rental_rate ?? 0;
  const depositLabel = unit.tenant_name ?? "Deposit";

  const initialMonths = unit.deposit_months != null ? String(unit.deposit_months) : "";
  const initialAmount =
    unit.deposit_amount != null && unit.deposit_amount > 0 ? String(unit.deposit_amount) : "";

  const [editing, setEditing] = useState(false);
  const [monthsStr, setMonthsStr] = useState(initialMonths);
  const [amountStr, setAmountStr] = useState(initialAmount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const months = parseFloat(monthsStr);
  const computed = Number.isFinite(months) ? rate * months : 0;
  const amountNum = parseFloat(amountStr);
  const effective = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : computed;

  function startEdit() {
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    // Discard the draft and restore the last-saved values.
    setMonthsStr(initialMonths);
    setAmountStr(initialAmount);
    setError(null);
    setEditing(false);
  }

  // Changing months auto-fills the amount with rent × months so the card mirrors
  // the spreadsheet's math; the owner can still override the amount afterwards.
  function handleMonthsChange(v: string) {
    setMonthsStr(v);
    const m = parseField(v);
    const auto = m != null ? rate * m : null;
    if (auto != null && auto > 0) setAmountStr(String(auto));
  }

  // Persist the draft to Supabase via the shared unit updater. Empty inputs clear
  // the stored value (null) so the figure reverts to the computed default.
  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateUnit(unit.id, {
        deposit_months: parseField(monthsStr),
        deposit_amount: parseField(amountStr),
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save deposit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}
    >
      {/* Header: centered room name with an edit affordance on the right */}
      <div className="relative flex items-center justify-center">
        <span className="text-sm font-semibold truncate px-7" style={{ color: "var(--text-primary)" }}>
          {unit.name || unit.label}
        </span>
        {editing ? (
          <div className="absolute right-0 flex items-center gap-1">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="text-[11px] font-medium px-2 py-1 rounded-md transition disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="text-[11px] font-medium px-2 py-1 rounded-md border transition disabled:opacity-50"
              style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Edit deposit for ${unit.name || unit.label}`}
            className="absolute right-0 text-[11px] font-medium px-2 py-1 rounded-md border transition hover:bg-[var(--surface)]"
            style={{ borderColor: "var(--border-soft)", color: "var(--accent)" }}
          >
            Edit
          </button>
        )}
      </div>

      {/* Rows — label on the left, value/input on the right (matches the sheet) */}
      <DepositRow label="Rental per Month">
        <span className="font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {fmtMYR(rate)}
        </span>
      </DepositRow>

      <DepositRow label="Deposit (month rental)">
        {editing ? (
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            className={fieldClass}
            style={fieldStyle}
            placeholder="0"
            value={monthsStr}
            onChange={(e) => handleMonthsChange(e.target.value)}
          />
        ) : (
          <span className="font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {monthsStr ? monthsStr : "—"}
          </span>
        )}
      </DepositRow>

      <DepositRow label={depositLabel} muted={!unit.tenant_name}>
        {editing ? (
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className={fieldClass}
            style={fieldStyle}
            placeholder={computed > 0 ? String(computed) : "0.00"}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
          />
        ) : (
          <span className="text-base font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {fmtMYR(effective)}
          </span>
        )}
      </DepositRow>

      {error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** One label-left / value-right row, the building block of a deposit card. */
function DepositRow({
  label,
  muted,
  children,
}: {
  label: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[34px]">
      <span
        className="text-sm truncate"
        style={{ color: muted ? "var(--text-faint)" : "var(--text-muted)" }}
        title={label}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
