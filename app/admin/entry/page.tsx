"use client";

import { useEffect, useMemo, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { RevenueEntryForm } from "@/components/property/RevenueEntryForm";
import { ExpenseEntryForm } from "@/components/property/ExpenseEntryForm";
import { Select } from "@/components/ui/Select";
import { StepDatePicker } from "@/components/ui/DatePicker";
import { MONTHS_FULL } from "@/types/rental";
import { todayIso } from "@/lib/date";

type Tab = "revenue" | "expense";

const labelCls = "block text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5";
const labelStyle: React.CSSProperties = { color: "var(--text-faint)" };

export default function QuickEntryPage() {
  const { visibleProperties, getUnitsForProperty, getProperty } = useRental();

  const [tab, setTab] = useState<Tab>("revenue");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  // The entry date drives the billing period (year + month) for the form.
  const [entryDate, setEntryDate] = useState(todayIso());
  const [y, m] = entryDate.split("-").map(Number);
  const year = y;
  const monthIdx = m - 1;

  // Default to the first property once properties hydrate from the database.
  useEffect(() => {
    if (!propertyId && visibleProperties.length) setPropertyId(visibleProperties[0].id);
  }, [visibleProperties, propertyId]);

  const property = propertyId ? getProperty(propertyId) : undefined;
  const units = useMemo(() => (propertyId ? getUnitsForProperty(propertyId) : []), [propertyId, getUnitsForProperty]);
  const isRoomBased = property?.rental_model === "room_rental";

  // Keep the selected room valid for the chosen property (default = first room).
  useEffect(() => {
    if (!units.find((u) => u.id === unitId)) setUnitId(units[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units]);

  const showRoomSelector = tab === "revenue" && isRoomBased && units.length > 1;

  // Left-panel date picker.
  const datePanel = (
    <div className="flex flex-col gap-2">
      <label className={labelCls} style={labelStyle}>Entry date</label>
      <StepDatePicker value={entryDate} onChange={setEntryDate} granularity="day" />
      <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>
        Billing period: <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{MONTHS_FULL[monthIdx]} {year}</span>
      </p>
    </div>
  );

  // Property (+ room) selectors rendered atop the right column.
  const contextSlot = (
    <div className={"grid grid-cols-1 gap-3 " + (showRoomSelector ? "sm:grid-cols-2" : "")}>
      <div>
        <label className={labelCls} style={labelStyle}>Property</label>
        <Select
          value={propertyId}
          placeholder="Select property..."
          onChange={setPropertyId}
          options={visibleProperties.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>
      {showRoomSelector && (
        <div>
          <label className={labelCls} style={labelStyle}>Room</label>
          <Select
            value={unitId}
            placeholder="Select room..."
            onChange={setUnitId}
            options={units.map((u) => ({
              value: u.id,
              label: `${u.name} - ${u.tenant_name || "Vacant"}`,
            }))}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-5">
        {/* Title */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>Quick Entry</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1" style={{ color: "var(--text-primary)" }}>
            Record {tab === "revenue" ? "revenue" : "an expense"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Pick a date on the left, fill in the entry on the right, and save.
          </p>
        </div>

        {/* Segmented toggle */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-xl" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
          {(["revenue", "expense"] as Tab[]).map((t) => {
            const active = tab === t;
            const accent = t === "revenue" ? "var(--accent)" : "var(--danger)";
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-pressed={active}
                className="py-2.5 rounded-lg text-sm font-semibold capitalize transition"
                style={{
                  background: active ? accent : "transparent",
                  color: active ? "#fff" : "var(--text-secondary)",
                  boxShadow: active ? "0 1px 3px rgba(15,17,22,0.18)" : "none",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* Balanced two-panel entry — the form owns left/right columns + footer */}
        <div className="ui-card overflow-hidden flex">
          {visibleProperties.length === 0 ? (
            <p className="text-sm text-center w-full py-8" style={{ color: "var(--text-muted)" }}>
              No properties yet. Add a property first to record entries.
            </p>
          ) : tab === "revenue" ? (
            <RevenueEntryForm
              key={`${propertyId}:${unitId}`}
              propertyId={propertyId}
              unitId={unitId}
              year={year}
              month={monthIdx + 1}
              datePanel={datePanel}
              contextSlot={contextSlot}
            />
          ) : (
            <ExpenseEntryForm
              key={propertyId}
              propertyId={propertyId}
              year={year}
              month={monthIdx + 1}
              datePanel={datePanel}
              contextSlot={contextSlot}
            />
          )}
        </div>
      </div>
    </div>
  );
}
