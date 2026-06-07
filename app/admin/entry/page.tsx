"use client";

import { useEffect, useMemo, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { RevenueEntryForm } from "@/components/property/RevenueEntryForm";
import { ExpenseEntryForm } from "@/components/property/ExpenseEntryForm";
import { Select } from "@/components/ui/Select";
import { MONTHS_FULL } from "@/types/rental";

type Tab = "revenue" | "expense";

const labelCls = "block text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5";
const labelStyle: React.CSSProperties = { color: "var(--text-faint)" };

export default function QuickEntryPage() {
  const { visibleProperties, getUnitsForProperty, getProperty } = useRental();
  const now = new Date();

  const [tab, setTab] = useState<Tab>("revenue");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());

  // Default to the first property once properties hydrate from Notion.
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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        {/* Title */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>Quick Entry</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1" style={{ color: "var(--text-primary)" }}>
            Record {tab === "revenue" ? "revenue" : "an expense"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Pick a property, switch between revenue and expense, and save - all on one page.
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

        {/* Shared selectors */}
        <div className="ui-card p-4 sm:p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Property</label>
              <Select
                value={propertyId}
                placeholder="Select property..."
                onChange={setPropertyId}
                options={visibleProperties.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <div>
                <label className={labelCls} style={labelStyle}>Month</label>
                <Select
                  value={String(monthIdx)}
                  onChange={(v) => setMonthIdx(Number(v))}
                  options={MONTHS_FULL.map((m, i) => ({ value: String(i), label: m }))}
                />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Year</label>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setYear((y) => y - 1)} className="ui-btn" style={{ padding: "0.45rem 0.55rem" }}>&lt;</button>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)", minWidth: 40, textAlign: "center" }}>{year}</span>
                  <button type="button" onClick={() => setYear((y) => y + 1)} className="ui-btn" style={{ padding: "0.45rem 0.55rem" }}>&gt;</button>
                </div>
              </div>
            </div>
          </div>

          {/* Room selector - revenue, room-based properties with multiple rooms */}
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

        {/* Form */}
        <div className="ui-card p-4 sm:p-6">
          {visibleProperties.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
              No properties yet. Add a property first to record entries.
            </p>
          ) : tab === "revenue" ? (
            <RevenueEntryForm
              key={`${propertyId}:${unitId}`}
              propertyId={propertyId}
              unitId={unitId}
              year={year}
              month={monthIdx + 1}
            />
          ) : (
            <ExpenseEntryForm
              key={propertyId}
              propertyId={propertyId}
              year={year}
              month={monthIdx + 1}
            />
          )}
        </div>
      </div>
    </div>
  );
}
