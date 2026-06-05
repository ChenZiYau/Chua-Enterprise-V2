"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Select } from "@/components/ui/Select";

type View = "normal" | "expanded" | "minimized";

const inputCls = "w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition focus:border-[var(--accent)]";
const inputStyle: React.CSSProperties = { borderColor: "var(--border-soft)", background: "var(--surface)", color: "var(--text-primary)" };
const labelCls = "block text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5";
const labelStyle: React.CSSProperties = { color: "var(--text-faint)" };

function fmt(v: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2 }).format(v);
}

export function RevenueEntryDrawer({
  open,
  onClose,
  propertyId,
  unitId: unitIdProp,
  preselectedMonth,
  preselectedYear,
  lockProperty = false,
}: {
  open: boolean;
  onClose: () => void;
  propertyId?: string;
  unitId?: string;
  preselectedMonth?: number;
  preselectedYear?: number;
  /** Keep the property fixed (e.g. opened from a property page). */
  lockProperty?: boolean;
}) {
  const {
    visibleProperties, getUnitsForProperty, getUnit,
    getRevenueEntry, getRevenueForUnit, addRevenueEntry, updateRevenueEntry,
  } = useRental();
  const now = new Date();

  const [view, setView] = useState<View>("normal");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [selectedProperty, setSelectedProperty] = useState(propertyId ?? visibleProperties[0]?.id ?? "");
  const [unitId, setUnitId] = useState(unitIdProp ?? "");
  const [year, setYear] = useState(preselectedYear ?? now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(preselectedMonth ?? now.getMonth());
  const month = monthIdx + 1;

  const [rental, setRental] = useState("");
  const [elecUnits, setElecUnits] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("bank_transfer");
  const [customPayMethod, setCustomPayMethod] = useState("");
  const [payStatus, setPayStatus] = useState<PaymentStatus>("paid");
  const [notes, setNotes] = useState("");

  const units = getUnitsForProperty(selectedProperty);
  const unit = getUnit(unitId);
  const existingEntry = unitId ? getRevenueEntry(unitId, year, month) : undefined;
  const yearEntries = unitId ? getRevenueForUnit(unitId, year) : [];

  // -- Reset on open --
  useEffect(() => {
    if (!open) return;
    setView("normal");
    setConfirmOpen(false);
    setSaved(false);
    setSaving(false);
    setSaveError(null);
    setDirty(false);
    setErrors({});
    const initialProp = propertyId ?? visibleProperties[0]?.id ?? "";
    setSelectedProperty(initialProp);
    const firstUnit = unitIdProp ?? getUnitsForProperty(initialProp)[0]?.id ?? "";
    setUnitId(firstUnit);
    setYear(preselectedYear ?? now.getFullYear());
    setMonthIdx(preselectedMonth ?? now.getMonth());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, propertyId, unitIdProp, preselectedMonth, preselectedYear]);

  // When the property changes (user-driven), default to its first unit.
  useEffect(() => {
    if (!open) return;
    const us = getUnitsForProperty(selectedProperty);
    if (!us.find((u) => u.id === unitId)) setUnitId(us[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty]);

  // Load existing entry (or unit defaults) whenever the target changes.
  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setErrors({});
    setDirty(false);
    const u = getUnit(unitId);
    const ex = unitId ? getRevenueEntry(unitId, year, month) : undefined;
    if (ex) {
      setRental(String(ex.rental_amount));
      setElecUnits(ex.electricity_units != null ? String(ex.electricity_units) : "");
      setOtherCharges(ex.other_charges_amount != null ? String(ex.other_charges_amount) : "");
      setPayDate(ex.payment_date ?? `${year}-${String(month).padStart(2, "0")}-01`);
      setPayMethod(ex.payment_method ?? "bank_transfer");
      setCustomPayMethod(ex.custom_payment_method ?? "");
      setPayStatus(ex.payment_status ?? "paid");
      setNotes(ex.notes ?? "");
    } else {
      setRental(u?.rental_rate ? String(u.rental_rate) : "");
      setElecUnits("");
      setOtherCharges("");
      setPayDate(`${year}-${String(month).padStart(2, "0")}-01`);
      setPayMethod("bank_transfer");
      setCustomPayMethod("");
      setPayStatus("paid");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, year, monthIdx, open]);

  // onText() wraps a string setter into a change handler that also flags the form dirty.
  function onText(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setter(e.target.value);
      setDirty(true);
    };
  }

  const elecUnitsNum = parseFloat(elecUnits) || 0;
  const freeUnits = unit?.electricity_free_units ?? 0;
  const elecBill = elecUnitsNum > 0 ? calculateElectricityCharge(elecUnitsNum, freeUnits) : null;
  const elecAmount = elecBill?.chargeAmount ?? 0;
  const rentalNum = parseFloat(rental) || 0;
  const otherNum = parseFloat(otherCharges) || 0;
  const totalAmount = rentalNum + elecAmount + otherNum;

  const attemptClose = useCallback(() => {
    if (dirty && !saved) setConfirmOpen(true);
    else onClose();
  }, [dirty, saved, onClose]);

  useEffect(() => {
    if (!open || view === "minimized") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, view]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmOpen) setConfirmOpen(false);
      else if (view !== "minimized") attemptClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirmOpen, view, attemptClose]);

  const activePropertyName = useMemo(
    () => visibleProperties.find((p) => p.id === selectedProperty)?.name ?? "Enter revenue",
    [visibleProperties, selectedProperty]
  );

  function validate() {
    const e: Record<string, string> = {};
    if (!selectedProperty) e.propertyId = "Select a property.";
    if (!unitId) e.unitId = "Select a room or unit.";
    if (!rental || rentalNum <= 0) e.rental = "Enter a rental amount greater than 0.";
    if (!payDate) e.payDate = "Enter a payment date.";
    if (payMethod === "other" && !customPayMethod.trim()) e.customPayMethod = "Describe the payment method.";
    return e;
  }

  async function handleSave(generateInvoice: boolean) {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setSaveError(null);
    const input = {
      property_id: selectedProperty, unit_id: unitId, year, month,
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
    try {
      if (existingEntry) await updateRevenueEntry(existingEntry.id, input);
      else await addRevenueEntry(input);
      setSaved(true);
      setDirty(false);
      setTimeout(() => onClose(), 700);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save revenue to Notion.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  // -- Minimized bar --
  if (view === "minimized") {
    return (
      <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", boxShadow: "0 8px 32px rgba(15,17,22,0.16)", animation: "rvSlideUp 200ms cubic-bezier(.2,.7,.2,1)", maxWidth: "min(92vw, 340px)" }}>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
            Revenue{dirty ? " - unsaved" : ""}
          </p>
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {activePropertyName}{unit ? ` - ${unit.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => setView("normal")} className="ui-btn" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>Restore</button>
        </div>
        {confirmOpen && <ConfirmDialog onSave={() => handleSave(false)} onDiscard={() => { setConfirmOpen(false); onClose(); }} onCancel={() => setConfirmOpen(false)} />}
        <Keyframes />
      </div>
    );
  }

  const widthClass = view === "expanded" ? "max-w-2xl" : "max-w-md";

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" aria-label="Close" onClick={attemptClose} className="absolute inset-0"
        style={{ background: "rgba(15,17,22,0.40)", animation: "rvFadeIn 140ms ease" }} />

      <aside role="dialog" aria-modal="true" aria-labelledby="revenue-drawer-title"
        className={`relative ml-auto h-full w-full ${widthClass} flex flex-col @container`}
        style={{ background: "var(--surface)", borderLeft: "1px solid var(--border-soft)", boxShadow: "-8px 0 32px rgba(15,17,22,0.10)", animation: "rvSlideIn 220ms cubic-bezier(.2,.7,.2,1)" }}>

        {/* Header */}
        <header className="px-6 py-5 flex items-start justify-between gap-4" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
              {existingEntry ? "Edit revenue" : "Enter revenue"}{dirty ? " - unsaved" : ""}
            </p>
            <h2 id="revenue-drawer-title" className="text-lg font-semibold mt-1 truncate" style={{ color: "var(--text-primary)" }}>
              {activePropertyName}{unit ? ` - ${unit.name}` : ""}
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Record rent and charges for a room or unit.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <IconBtn label="Minimize" onClick={() => setView("minimized")}><MinimizeIcon /></IconBtn>
            <IconBtn label={view === "expanded" ? "Collapse" : "Expand"} onClick={() => setView(view === "expanded" ? "normal" : "expanded")}>
              {view === "expanded" ? <CollapseIcon /> : <ExpandIcon />}
            </IconBtn>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
          {/* Property & unit */}
          <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Property</label>
              <Select
                value={selectedProperty}
                disabled={lockProperty}
                invalid={!!errors.propertyId}
                placeholder="Select property..."
                onChange={(v) => { setSelectedProperty(v); setDirty(true); }}
                options={visibleProperties.map((p) => ({ value: p.id, label: p.name }))}
              />
              {errors.propertyId && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.propertyId}</p>}
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Room / Unit</label>
              <Select
                value={unitId}
                disabled={units.length === 0}
                invalid={!!errors.unitId}
                placeholder="Select room/unit..."
                onChange={(v) => { setUnitId(v); setDirty(true); }}
                options={units.map((u) => ({ value: u.id, label: u.name }))}
              />
            </div>
          </div>

          {unit && (
            <div className="grid grid-cols-3 gap-2 rounded-lg px-3 py-2.5" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
              <MiniStat label="Tenant" value={unit.tenant_name ?? "-"} />
              <MiniStat label="Base rent" value={unit.rental_rate ? `RM ${unit.rental_rate}` : "-"} />
              <MiniStat label="Free kWh" value={`${unit.electricity_free_units}`} />
            </div>
          )}

          {/* Year status grid - the billing month is chosen here (replaces the
              old year/month selector). The header keeps year navigation. */}
          {unitId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>{year} status</p>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setYear((y) => y - 1)} className="ui-btn" style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}>&lt;</button>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)", minWidth: 34, textAlign: "center" }}>{year}</span>
                  <button type="button" onClick={() => setYear((y) => y + 1)} className="ui-btn" style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}>&gt;</button>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {MONTHS.map((m, i) => {
                  const entry = yearEntries.find((e) => e.month === i + 1);
                  const isCurrent = i === monthIdx;
                  return (
                    <button key={m} type="button" onClick={() => setMonthIdx(i)} className="rounded-md py-1.5 text-center text-[11px] font-medium transition"
                      style={{
                        background: isCurrent ? "var(--accent)" : entry ? "rgba(47,158,111,0.12)" : "var(--surface-subtle)",
                        color: isCurrent ? "#fff" : entry ? "var(--success)" : "var(--text-secondary)",
                        border: `1px solid ${isCurrent ? "var(--accent)" : entry ? "var(--success)" : "var(--border-soft)"}`,
                      }}>{m}</button>
                  );
                })}
              </div>
            </div>
          )}

          {existingEntry && (
            <div className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs" style={{ background: "rgba(224,162,61,0.10)", border: "1px solid var(--warning)", color: "var(--warning)" }}>
              <span className="mt-px">&#9888;</span>
              <span>An entry already exists for {MONTHS_FULL[monthIdx]} {year}. Saving will update it.</span>
            </div>
          )}

          {/* Charges */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>Charges</p>
            <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Rental (RM)</label>
                <input type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00" className={inputCls}
                  style={errors.rental ? { ...inputStyle, borderColor: "var(--danger)" } : inputStyle}
                  value={rental} onChange={onText(setRental)} />
                {errors.rental && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.rental}</p>}
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Other charges (RM)</label>
                <input type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00" className={inputCls} style={inputStyle}
                  value={otherCharges} onChange={onText(setOtherCharges)} />
              </div>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Electricity usage (kWh)</label>
              <input type="number" inputMode="decimal" min={0} step="1" placeholder="e.g. 120" className={inputCls} style={inputStyle}
                value={elecUnits} onChange={onText(setElecUnits)} />
              {elecBill ? (
                <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                  {elecBill.unitsUsed} - {elecBill.freeUnits} free = {elecBill.chargeableUnits} kWh &#8594; <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(elecBill.chargeAmount)}</span>
                </p>
              ) : freeUnits > 0 ? (
                <p className="text-xs mt-1.5" style={{ color: "var(--text-faint)" }}>{freeUnits} kWh free. Enter a reading to auto-calculate the charge.</p>
              ) : null}
            </div>
          </div>

          {/* Payment */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>Payment</p>
            <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Payment date</label>
                <input type="date" className={inputCls} style={errors.payDate ? { ...inputStyle, borderColor: "var(--danger)" } : inputStyle}
                  value={payDate} onChange={onText(setPayDate)} />
                {errors.payDate && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.payDate}</p>}
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Status</label>
                <Select
                  value={payStatus}
                  onChange={(v) => { setPayStatus(v as PaymentStatus); setDirty(true); }}
                  options={(["paid", "partial", "pending", "overdue"] as PaymentStatus[]).map((s) => ({ value: s, label: PAYMENT_STATUS_LABEL[s] }))}
                />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Method</label>
                <Select
                  value={payMethod}
                  onChange={(v) => { setPayMethod(v as PaymentMethod); setDirty(true); }}
                  options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
                />
              </div>
              {payMethod === "other" && (
                <div>
                  <label className={labelCls} style={labelStyle}>Custom method</label>
                  <input type="text" placeholder="Describe..." className={inputCls}
                    style={errors.customPayMethod ? { ...inputStyle, borderColor: "var(--danger)" } : inputStyle}
                    value={customPayMethod} onChange={onText(setCustomPayMethod)} />
                  {errors.customPayMethod && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.customPayMethod}</p>}
                </div>
              )}
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Notes (optional)</label>
              <textarea rows={2} placeholder="Any remarks..." className={`${inputCls} resize-none`} style={inputStyle}
                value={notes} onChange={onText(setNotes)} />
            </div>
          </div>

          {saved && (
            <div className="rounded-lg px-4 py-2.5 flex items-center gap-2" style={{ background: "rgba(47,158,111,0.10)", border: "1px solid var(--success)" }}>
              <span style={{ color: "var(--success)" }}>&#10003;</span>
              <span className="text-xs font-medium" style={{ color: "var(--success)" }}>Saved - {MONTHS_FULL[monthIdx]} {year}</span>
            </div>
          )}
          {saveError && (
            <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: "rgba(211,84,84,0.08)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
              {saveError}
            </div>
          )}
        </div>

        {/* Footer with total + actions */}
        <footer className="px-6 py-4 flex flex-col gap-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>Total</span>
            <span className="text-xl font-bold tabular-nums" style={{ color: "var(--accent)" }}>{fmt(totalAmount)}</span>
          </div>
          <div className="grid grid-cols-1 @sm:grid-cols-2 gap-2">
            <button type="button" className="ui-btn justify-center" disabled={saved || saving} onClick={() => handleSave(false)}>
              {saving ? "Saving..." : saved ? "Saved" : "Save only"}
            </button>
            <button type="button" className="ui-btn ui-btn-primary justify-center" disabled={saved || saving} onClick={() => handleSave(true)}>
              {saving ? "Saving..." : existingEntry ? "Update & invoice" : "Save & invoice"}
            </button>
          </div>
        </footer>
      </aside>

      {confirmOpen && <ConfirmDialog onSave={() => handleSave(false)} onDiscard={() => { setConfirmOpen(false); onClose(); }} onCancel={() => setConfirmOpen(false)} />}
      <Keyframes />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wider truncate" style={{ color: "var(--text-faint)" }}>{label}</p>
      <p className="text-xs font-medium truncate mt-0.5" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function ConfirmDialog({ onSave, onDiscard, onCancel }: { onSave: () => void; onDiscard: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" aria-label="Keep editing" onClick={onCancel} className="absolute inset-0"
        style={{ background: "rgba(15,17,22,0.48)", animation: "rvFadeIn 120ms ease" }} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="rev-discard-title" className="relative w-full max-w-sm rounded-2xl p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", boxShadow: "0 24px 64px rgba(15,17,22,0.24)", animation: "rvPop 160ms cubic-bezier(.2,.7,.2,1)" }}>
        <h3 id="rev-discard-title" className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Unsaved changes</h3>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>You have unsaved revenue details. Save them or discard and close?</p>
        <div className="flex items-center justify-end gap-2 mt-6">
          <button type="button" className="ui-btn" onClick={onCancel}>Keep editing</button>
          <button type="button" className="ui-btn" onClick={onDiscard} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>Discard</button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="w-8 h-8 rounded-md flex items-center justify-center"
      style={{ color: "var(--text-muted)", border: "1px solid var(--border-soft)", background: "var(--surface)" }}>{children}</button>
  );
}
function CloseIcon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function MinimizeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>;
}
function ExpandIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>;
}
function CollapseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg>;
}
function Keyframes() {
  return (
    <style jsx global>{`
      @keyframes rvSlideIn { from { transform: translateX(16px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes rvSlideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes rvFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes rvPop { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `}</style>
  );
}
