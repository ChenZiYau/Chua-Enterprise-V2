"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRental } from "@/context/RentalContext";
import {
  MONTHS,
  MONTHS_FULL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  type PaymentMethod,
  type PaymentStatus,
} from "@/types/rental";
import { calculateElectricityCharge } from "@/lib/electricity";

const labelCls = "block text-xs font-semibold uppercase tracking-wider mb-1.5";
const labelStyle: React.CSSProperties = { color: "var(--text-muted)" };
const inputCls =
  "w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition focus:border-[var(--accent)]";
const inputStyle: React.CSSProperties = {
  borderColor: "var(--border-soft)",
  background: "var(--surface)",
  color: "var(--text-primary)",
};

function fmt(v: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(v);
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-xs)" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function RevenueForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { visibleProperties, getUnitsForProperty, getUnit, getRevenueEntry, getRevenueForUnit, addRevenueEntry, updateRevenueEntry } = useRental();
  const now = new Date();

  const [propertyId, setPropertyId] = useState(params.get("property") ?? visibleProperties[0]?.id ?? "");
  const units = getUnitsForProperty(propertyId);
  const [unitId, setUnitId] = useState(params.get("unit") ?? units[0]?.id ?? "");
  const [year, setYear] = useState(Number(params.get("year") ?? now.getFullYear()));
  const [monthIdx, setMonthIdx] = useState(params.get("month") ? Number(params.get("month")) : now.getMonth());
  const month = monthIdx + 1;

  useEffect(() => {
    const newUnits = getUnitsForProperty(propertyId);
    setUnitId(newUnits[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const unit = getUnit(unitId);
  const existingEntry = getRevenueEntry(unitId, year, month);
  const yearEntries = getRevenueForUnit(unitId, year);

  const [rental, setRental] = useState("");
  const [elecUnits, setElecUnits] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  const [payDate, setPayDate] = useState(`${year}-${String(month).padStart(2, "0")}-01`);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("bank_transfer");
  const [customPayMethod, setCustomPayMethod] = useState("");
  const [payStatus, setPayStatus] = useState<PaymentStatus>("paid");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setSaved(false);
    setErrors({});
    if (existingEntry) {
      setRental(String(existingEntry.rental_amount));
      setElecUnits(existingEntry.electricity_units != null ? String(existingEntry.electricity_units) : "");
      setOtherCharges(existingEntry.other_charges_amount != null ? String(existingEntry.other_charges_amount) : "");
      setPayDate(existingEntry.payment_date ?? `${year}-${String(month).padStart(2, "0")}-01`);
      setPayMethod(existingEntry.payment_method ?? "bank_transfer");
      setCustomPayMethod(existingEntry.custom_payment_method ?? "");
      setPayStatus(existingEntry.payment_status ?? "paid");
      setNotes(existingEntry.notes ?? "");
    } else {
      setRental(unit?.rental_rate ? String(unit.rental_rate) : "");
      setElecUnits("");
      setOtherCharges("");
      setPayDate(`${year}-${String(month).padStart(2, "0")}-01`);
      setPayMethod("bank_transfer");
      setCustomPayMethod("");
      setPayStatus("paid");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, year, monthIdx]);

  const elecUnitsNum = parseFloat(elecUnits) || 0;
  const freeUnits = unit?.electricity_free_units ?? 0;
  const elecBill = elecUnitsNum > 0 ? calculateElectricityCharge(elecUnitsNum, freeUnits) : null;
  const elecAmount = elecBill?.chargeAmount ?? 0;
  const rentalNum = parseFloat(rental) || 0;
  const otherNum = parseFloat(otherCharges) || 0;
  const totalAmount = rentalNum + elecAmount + otherNum;

  function validate() {
    const e: Record<string, string> = {};
    if (!propertyId) e.propertyId = "Select a property.";
    if (!unitId) e.unitId = "Select a unit or room.";
    if (!rental || rentalNum <= 0) e.rental = "Enter a rental amount greater than 0.";
    if (!payDate) e.payDate = "Enter a payment date.";
    if (payMethod === "other" && !customPayMethod.trim()) e.customPayMethod = "Describe the payment method.";
    return e;
  }

  function handleSave(generateInvoice = false) {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const input = {
      property_id: propertyId, unit_id: unitId, year, month,
      rental_amount: rentalNum,
      electricity_units: elecUnitsNum || null,
      electricity_amount: elecAmount || null,
      other_charges_amount: otherNum || null,
      total_amount: totalAmount,
      payment_date: payDate,
      payment_method: payMethod,
      custom_payment_method: payMethod === "other" ? customPayMethod : null,
      payment_status: payStatus,
      notes: notes.trim() || null,
      invoice_generated: generateInvoice,
    };
    if (existingEntry) { updateRevenueEntry(existingEntry.id, input); } else { addRevenueEntry(input); }
    setSaved(true);
    setTimeout(() => router.push(propertyId ? `/admin/properties/${propertyId}` : "/admin/revenue"), 600);
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6 max-w-5xl">
      <Link href={propertyId ? `/admin/properties/${propertyId}` : "/admin/revenue"} className="text-xs inline-flex items-center gap-1.5 w-fit" style={{ color: "var(--text-muted)" }}>
        ← Back
      </Link>
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {existingEntry ? "Edit Revenue Entry" : "Enter Revenue"}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Record rent and charges for a room or unit.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        <div className="flex flex-col gap-5">
          <SectionCard title="Property & Period">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls} style={labelStyle}>Property</label>
                <select className="ui-select" style={errors.propertyId ? { borderColor: "var(--danger)" } : undefined} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                  <option value="" disabled>Select property…</option>
                  {visibleProperties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {errors.propertyId && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.propertyId}</p>}
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Room / Unit</label>
                <select className="ui-select" style={errors.unitId ? { borderColor: "var(--danger)" } : undefined} value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={units.length === 0}>
                  <option value="" disabled>Select room/unit…</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                {errors.unitId && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.unitId}</p>}
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Month</label>
                <select className="ui-select" value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))}>
                  {MONTHS_FULL.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Year</label>
                <select className="ui-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            {existingEntry && (
              <div className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm" style={{ background: "rgba(224,162,61,0.10)", border: "1px solid var(--warning)", color: "var(--warning)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span>Entry already exists for {MONTHS_FULL[monthIdx]} {year}. Saving will update the existing record.</span>
              </div>
            )}
            {unit && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 rounded-lg px-4 py-3" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
                {unit.tenant_name && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Tenant</p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>{unit.tenant_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Base Rent</p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>{unit.rental_rate ? `RM ${unit.rental_rate}/mo` : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Free kWh</p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>{unit.electricity_free_units} kWh</p>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Charges">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls} style={labelStyle}>Rental Amount (RM)</label>
                <input type="number" min={0} step="0.01" placeholder="0.00" className={inputCls} style={errors.rental ? { ...inputStyle, borderColor: "var(--danger)" } : inputStyle} value={rental} onChange={(e) => setRental(e.target.value)} />
                {errors.rental && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.rental}</p>}
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Other Charges (RM)</label>
                <input type="number" min={0} step="0.01" placeholder="0.00" className={inputCls} style={inputStyle} value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Electricity Usage (kWh)</label>
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <input type="number" min={0} step="1" placeholder="e.g. 120" className={inputCls} style={inputStyle} value={elecUnits} onChange={(e) => setElecUnits(e.target.value)} />
                </div>
                {elecBill && (
                  <div className="rounded-lg px-3 py-2 text-xs shrink-0 min-w-[160px]" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
                    <div style={{ color: "var(--text-faint)" }}>{elecBill.unitsUsed} kWh − {elecBill.freeUnits} kWh free</div>
                    <div className="font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{elecBill.chargeableUnits} kWh → {fmt(elecBill.chargeAmount)}</div>
                  </div>
                )}
              </div>
              {freeUnits > 0 && !elecBill && (
                <p className="text-xs mt-1.5" style={{ color: "var(--text-faint)" }}>{freeUnits} kWh free allowance applies. Enter kWh reading to auto-calculate TNB charge.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Payment Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls} style={labelStyle}>Payment Date</label>
                <input type="date" className={inputCls} style={errors.payDate ? { ...inputStyle, borderColor: "var(--danger)" } : inputStyle} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                {errors.payDate && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.payDate}</p>}
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Payment Status</label>
                <select className="ui-select" value={payStatus} onChange={(e) => setPayStatus(e.target.value as PaymentStatus)}>
                  {(["paid", "partial", "pending", "overdue"] as PaymentStatus[]).map((s) => (
                    <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Payment Method</label>
                <select className="ui-select" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
                </select>
              </div>
              {payMethod === "other" && (
                <div>
                  <label className={labelCls} style={labelStyle}>Custom Method</label>
                  <input type="text" placeholder="Describe payment method…" className={inputCls} style={errors.customPayMethod ? { ...inputStyle, borderColor: "var(--danger)" } : inputStyle} value={customPayMethod} onChange={(e) => setCustomPayMethod(e.target.value)} />
                  {errors.customPayMethod && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.customPayMethod}</p>}
                </div>
              )}
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Notes (optional)</label>
              <textarea rows={3} placeholder="Any remarks…" className={`${inputCls} resize-none`} style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-xs)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-3" style={{ color: "var(--text-faint)" }}>Amount Summary</p>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Rental</span>
                <span style={{ color: "var(--text-primary)" }}>{fmt(rentalNum)}</span>
              </div>
              {elecAmount > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>Electricity</span>
                  <span style={{ color: "var(--text-primary)" }}>{fmt(elecAmount)}</span>
                </div>
              )}
              {otherNum > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>Other</span>
                  <span style={{ color: "var(--text-primary)" }}>{fmt(otherNum)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 mt-1" style={{ borderTop: "1px solid var(--border-soft)" }}>
                <span style={{ color: "var(--text-primary)" }}>Total</span>
                <span style={{ color: "var(--accent)", fontSize: "1rem" }}>{fmt(totalAmount)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-5">
              <button type="button" disabled={saved} onClick={() => handleSave(true)} className="ui-btn ui-btn-primary w-full justify-center">
                {saved ? "Saved ✓" : "Save & Generate Invoice"}
              </button>
              <button type="button" disabled={saved} onClick={() => handleSave(false)} className="ui-btn w-full justify-center">
                Save Only
              </button>
              <Link href={propertyId ? `/admin/properties/${propertyId}` : "/admin/revenue"} className="ui-btn w-full justify-center text-center" style={{ color: "var(--text-muted)" }}>
                Cancel
              </Link>
            </div>
          </div>

          {unitId && (
            <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-xs)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-3" style={{ color: "var(--text-faint)" }}>{year} Monthly Status</p>
              <div className="grid grid-cols-4 gap-1.5">
                {MONTHS.map((m, i) => {
                  const entry = yearEntries.find((e) => e.month === i + 1);
                  const isCurrent = i === monthIdx;
                  const isFuture = year > now.getFullYear() || (year === now.getFullYear() && i > now.getMonth());
                  return (
                    <button key={m} type="button" onClick={() => setMonthIdx(i)} className="rounded-md py-1.5 text-center text-[11px] font-medium transition"
                      style={{
                        background: isCurrent ? "var(--accent)" : entry ? "rgba(47,158,111,0.12)" : isFuture ? "var(--surface-muted)" : "var(--surface-subtle)",
                        color: isCurrent ? "#fff" : entry ? "var(--success)" : isFuture ? "var(--text-faint)" : "var(--text-secondary)",
                        border: `1px solid ${isCurrent ? "var(--accent)" : entry ? "var(--success)" : "var(--border-soft)"}`,
                      }}
                    >{m}</button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-[10px]" style={{ color: "var(--text-faint)" }}>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "var(--success)" }} />Collected</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "var(--accent)" }} />Selected</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "var(--surface-subtle)" }} />No entry</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewRevenuePage() {
  return (
    <Suspense fallback={<div className="px-8 py-8 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>}>
      <RevenueForm />
    </Suspense>
  );
}
