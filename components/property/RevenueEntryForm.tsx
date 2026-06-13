"use client";

import { useEffect, useRef, useState } from "react";
import { useRental } from "@/context/RentalContext";
import {
  MONTHS_FULL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  type PaymentMethod,
  type PaymentStatus,
} from "@/types/rental";
import { calculateElectricityCharge } from "@/lib/electricity";
import { computeProration, prorationNote, composeProratedNotes, daysInMonth, parseProrationNote, stripProrationNote } from "@/lib/proration";
import { Select } from "@/components/ui/Select";
import { DatePickerField } from "@/components/ui/DatePicker";

const inputCls = "w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition focus:border-[var(--accent)]";
const inputStyle: React.CSSProperties = { borderColor: "var(--border-soft)", background: "var(--surface)", color: "var(--text-primary)" };
const labelCls = "block text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5";
const labelStyle: React.CSSProperties = { color: "var(--text-faint)" };

function fmt(v: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2 }).format(v);
}

/**
 * Inline revenue form body — the same field logic/validation/save as
 * {@link RevenueEntryDrawer}, but without drawer chrome so it can sit
 * directly on the Quick Entry page. Property / room / period are controlled
 * by the parent so they can be shared across the Revenue/Expense toggle.
 */
export function RevenueEntryForm({
  propertyId,
  unitId,
  year,
  month,
  onSaved,
  onDirtyChange,
  datePanel,
  contextSlot,
}: {
  propertyId: string;
  unitId: string;
  year: number;
  month: number;
  onSaved?: () => void;
  /** Report whether the user has edited the form away from its loaded values. */
  onDirtyChange?: (dirty: boolean) => void;
  /** When provided, render the balanced two-column + sticky-footer layout:
   *  left = this date panel + Payment group, right = charges (scrolls). */
  datePanel?: React.ReactNode;
  /** Optional selectors (property / room) rendered atop the right column. */
  contextSlot?: React.ReactNode;
}) {
  const { getUnit, getRevenueEntry, addRevenueEntry, updateRevenueEntry } = useRental();

  const [saved, setSaved] = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [rental, setRental] = useState("");
  const [elecUnits, setElecUnits] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("bank_transfer");
  const [customPayMethod, setCustomPayMethod] = useState("");
  const [payStatus, setPayStatus] = useState<PaymentStatus>("paid");
  const [notes, setNotes] = useState("");
  const [prorate, setProrate] = useState(false);
  const [startDate, setStartDate] = useState("");
  // Snapshot of the loaded values, so we can tell user edits from initial load.
  const baselineRef = useRef<string>("");

  const unit = getUnit(unitId);
  const existingEntry = unitId ? getRevenueEntry(unitId, year, month) : undefined;

  // Load existing entry (or unit defaults) whenever the target changes.
  useEffect(() => {
    setSaved(false);
    setSaveError(null);
    setErrors({});
    const u = getUnit(unitId);
    const ex = unitId ? getRevenueEntry(unitId, year, month) : undefined;
    const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;

    let nextRental = "";
    let nextElec = "";
    let nextOther = "";
    let nextPayDate = firstOfMonth;
    let nextPayMethod: PaymentMethod = "bank_transfer";
    let nextCustom = "";
    let nextPayStatus: PaymentStatus = "paid";
    let nextNotes = "";
    let nextProrate = false;
    let nextStart = firstOfMonth;

    if (ex) {
      nextRental = String(ex.rental_amount);
      nextElec = ex.electricity_units != null ? String(ex.electricity_units) : "";
      nextOther = ex.other_charges_amount != null ? String(ex.other_charges_amount) : "";
      nextPayDate = ex.payment_date ?? firstOfMonth;
      nextPayMethod = ex.payment_method ?? "bank_transfer";
      nextCustom = ex.custom_payment_method ?? "";
      nextPayStatus = ex.payment_status ?? "paid";
      nextNotes = ex.notes ?? "";

      // If this entry was saved prorated, restore the editable full rent from
      // the note's ratio (approximate — prior rounding may drift by a cent).
      const parsed = ex.notes ? parseProrationNote(ex.notes) : null;
      if (parsed) {
        const fullRent = Math.round((ex.rental_amount * parsed.daysInMonth / parsed.chargeableDays) * 100) / 100;
        if (Number.isFinite(fullRent) && fullRent > 0) {
          nextRental = String(fullRent);
          nextNotes = stripProrationNote(ex.notes ?? "");
          nextProrate = true;
          nextStart = parsed.startISO;
        }
      }
    } else {
      nextRental = u?.rental_rate ? String(u.rental_rate) : "";
    }

    setRental(nextRental);
    setElecUnits(nextElec);
    setOtherCharges(nextOther);
    setPayDate(nextPayDate);
    setPayMethod(nextPayMethod);
    setCustomPayMethod(nextCustom);
    setPayStatus(nextPayStatus);
    setNotes(nextNotes);
    setProrate(nextProrate);
    setStartDate(nextStart);

    baselineRef.current = JSON.stringify([
      nextRental, nextElec, nextOther, nextPayDate, nextPayMethod,
      nextCustom, nextPayStatus, nextNotes, nextProrate, nextStart,
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, year, month]);

  // Report dirtiness (current values vs the loaded baseline) to the parent.
  useEffect(() => {
    if (!onDirtyChange) return;
    const current = JSON.stringify([
      rental, elecUnits, otherCharges, payDate, payMethod,
      customPayMethod, payStatus, notes, prorate, startDate,
    ]);
    onDirtyChange(current !== baselineRef.current);
  }, [rental, elecUnits, otherCharges, payDate, payMethod, customPayMethod, payStatus, notes, prorate, startDate, onDirtyChange]);

  const elecUnitsNum = parseFloat(elecUnits) || 0;
  const freeUnits = unit?.electricity_free_units ?? 0;
  const elecBill = elecUnitsNum > 0 ? calculateElectricityCharge(elecUnitsNum, freeUnits) : null;
  const elecAmount = elecBill?.chargeAmount ?? 0;
  const rentalNum = parseFloat(rental) || 0;
  const otherNum = parseFloat(otherCharges) || 0;

  // -- Proration --
  const monthStr = String(month).padStart(2, "0");
  const dim = daysInMonth(year, month);
  const startInMonth = startDate.startsWith(`${year}-${monthStr}-`);
  const startDay = startInMonth ? Number(startDate.slice(8, 10)) : 0;
  const proration = prorate && startInMonth ? computeProration(rentalNum, year, month, startDay) : null;
  const effectiveRental = proration ? proration.proratedAmount : rentalNum;
  const totalAmount = effectiveRental + elecAmount + otherNum;

  function validate() {
    const e: Record<string, string> = {};
    if (!propertyId) e.propertyId = "Select a property.";
    if (!unitId) e.unitId = "Select a room or unit.";
    if (!rental || rentalNum <= 0) e.rental = "Enter a rental amount greater than 0.";
    if (!payDate) e.payDate = "Enter a payment date.";
    if (payMethod === "other" && !customPayMethod.trim()) e.customPayMethod = "Describe the payment method.";
    if (prorate && !startInMonth) e.startDate = `Start date must be within ${MONTHS_FULL[month - 1]} ${year}.`;
    return e;
  }

  async function handleSave(generateInvoice: boolean) {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setSaveError(null);
    const input = {
      property_id: propertyId, unit_id: unitId, year, month,
      rental_amount: effectiveRental,
      electricity_units: elecUnitsNum || null,
      electricity_amount: elecAmount || null,
      other_charges_amount: otherNum || null,
      total_amount: totalAmount,
      payment_date: payDate,
      payment_method: payMethod,
      custom_payment_method: payMethod === "other" ? customPayMethod : null,
      payment_status: payStatus,
      notes: composeProratedNotes(
        notes,
        !!proration,
        proration ? prorationNote(startDate, proration.chargeableDays, proration.daysInMonth) : null
      ),
      invoice_generated: generateInvoice,
    };
    try {
      if (existingEntry) await updateRevenueEntry(existingEntry.id, input);
      else await addRevenueEntry(input);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save revenue to Notion.");
    } finally {
      setSaving(false);
    }
  }

  // onText() wraps a string setter, clearing any prior saved/error flags.
  function onText(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setter(e.target.value);
      if (saved) setSaved(false);
    };
  }

  // ── Field fragments (shared by both layouts; logic untouched) ──
  const unitStat = unit ? (
    <div className="grid grid-cols-3 gap-2 rounded-lg px-3 py-2.5" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
      <MiniStat label="Tenant" value={unit.tenant_name ?? "Vacant"} />
      <MiniStat label="Base rent" value={unit.rental_rate ? `RM ${unit.rental_rate}` : "-"} />
      <MiniStat label="Free kWh" value={`${unit.electricity_free_units}`} />
    </div>
  ) : null;

  const existingWarning = existingEntry ? (
    <div className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs" style={{ background: "rgba(224,162,61,0.10)", border: "1px solid var(--warning)", color: "var(--warning)" }}>
      <span className="mt-px">&#9888;</span>
      <span>An entry already exists for {MONTHS_FULL[month - 1]} {year}. Saving will update it.</span>
    </div>
  ) : null;

  const chargesSection = (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>Charges</p>
      <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[10px] font-semibold uppercase tracking-[0.14em]" style={labelStyle}>
              {prorate ? "Full monthly rent (RM)" : "Rental (RM)"}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Prorate for a mid-month move-in">
              <input type="checkbox" checked={prorate}
                onChange={(e) => { setProrate(e.target.checked); if (saved) setSaved(false); }}
                style={{ accentColor: "var(--accent)", width: 13, height: 13 }} />
              <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Prorate (mid-month start)</span>
            </label>
          </div>
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

      {prorate && (
        <div className="rounded-lg px-3 py-3 flex flex-col gap-2.5" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
          <div>
            <label className={labelCls} style={labelStyle}>Tenant start date</label>
            <DatePickerField
              value={startDate}
              onChange={(v) => { setStartDate(v); if (saved) setSaved(false); }}
              min={`${year}-${monthStr}-01`}
              max={`${year}-${monthStr}-${String(dim).padStart(2, "0")}`}
              invalid={!!errors.startDate}
              ariaLabel="Tenant start date"
            />
            {errors.startDate && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.startDate}</p>}
          </div>
          {proration && (
            <div className="text-xs flex flex-col gap-0.5" style={{ color: "var(--text-muted)" }}>
              <div className="flex justify-between"><span>Full rent</span><span className="tabular-nums">{fmt(proration.fullRent)}</span></div>
              <div className="flex justify-between"><span>Days used</span><span className="tabular-nums">{proration.chargeableDays} / {proration.daysInMonth} days</span></div>
              <div className="flex justify-between font-semibold" style={{ color: "var(--text-primary)" }}>
                <span>Prorated rent</span><span className="tabular-nums">{fmt(proration.proratedAmount)}</span>
              </div>
            </div>
          )}
        </div>
      )}
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
  );

  const paymentDateField = (
    <div>
      <label className={labelCls} style={labelStyle}>Payment date</label>
      <DatePickerField
        value={payDate}
        onChange={(v) => { setPayDate(v); if (saved) setSaved(false); }}
        invalid={!!errors.payDate}
        ariaLabel="Payment date"
      />
      {errors.payDate && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.payDate}</p>}
    </div>
  );
  const statusField = (
    <div>
      <label className={labelCls} style={labelStyle}>Status</label>
      <Select
        value={payStatus}
        onChange={(v) => { setPayStatus(v as PaymentStatus); if (saved) setSaved(false); }}
        options={(["paid", "partial", "pending", "overdue"] as PaymentStatus[]).map((s) => ({ value: s, label: PAYMENT_STATUS_LABEL[s] }))}
      />
    </div>
  );
  const methodField = (
    <div>
      <label className={labelCls} style={labelStyle}>Method</label>
      <Select
        value={payMethod}
        onChange={(v) => { setPayMethod(v as PaymentMethod); if (saved) setSaved(false); }}
        options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
      />
    </div>
  );
  const customMethodField = payMethod === "other" ? (
    <div>
      <label className={labelCls} style={labelStyle}>Custom method</label>
      <input type="text" placeholder="Describe..." className={inputCls}
        style={errors.customPayMethod ? { ...inputStyle, borderColor: "var(--danger)" } : inputStyle}
        value={customPayMethod} onChange={onText(setCustomPayMethod)} />
      {errors.customPayMethod && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.customPayMethod}</p>}
    </div>
  ) : null;
  const notesField = (
    <div>
      <label className={labelCls} style={labelStyle}>Notes (optional)</label>
      <textarea rows={notesFocused ? 4 : 2} placeholder="Any remarks..." className={`${inputCls} resize-none transition-[height]`} style={inputStyle}
        value={notes} onChange={onText(setNotes)}
        onFocus={() => setNotesFocused(true)} onBlur={() => setNotesFocused(false)} />
    </div>
  );

  const banners = (
    <>
      {saved && (
        <div className="rounded-lg px-4 py-2.5 flex items-center gap-2" style={{ background: "rgba(47,158,111,0.10)", border: "1px solid var(--success)" }}>
          <span style={{ color: "var(--success)" }}>&#10003;</span>
          <span className="text-xs font-medium" style={{ color: "var(--success)" }}>Saved - {MONTHS_FULL[month - 1]} {year}</span>
        </div>
      )}
      {saveError && (
        <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: "rgba(211,84,84,0.08)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
          {saveError}
        </div>
      )}
    </>
  );

  const totalDisplay = (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>Total</span>
      <span className="text-xl font-bold tabular-nums leading-tight" style={{ color: "var(--accent)" }}>{fmt(totalAmount)}</span>
    </div>
  );
  const actionButtons = (
    <>
      <button type="button" className="ui-btn justify-center" disabled={saving} onClick={() => handleSave(false)}>
        {saving ? "Saving..." : "Save only"}
      </button>
      <button type="button" className="ui-btn ui-btn-primary justify-center" disabled={saving} onClick={() => handleSave(true)}>
        {saving ? "Saving..." : existingEntry ? "Update & invoice" : "Save & invoice"}
      </button>
    </>
  );

  // ── Balanced split layout: left = date + payment, right scrolls, sticky footer ──
  if (datePanel) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] flex-1 min-h-0">
          {/* LEFT — date picker + payment (scrolls if it exceeds height) */}
          <div className="flex flex-col gap-3 px-5 py-4 lg:border-r overflow-y-auto min-h-0" style={{ borderColor: "var(--border-soft)" }}>
            {datePanel}
            {unitStat}
            <div className="flex flex-col gap-3">
              <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>Payment</p>
              {paymentDateField}
              {statusField}
              {methodField}
              {customMethodField}
            </div>
          </div>

          {/* RIGHT — charges (only this body scrolls) */}
          <div className="@container flex flex-col gap-3 px-5 py-4 overflow-y-auto min-h-0">
            {contextSlot}
            {existingWarning}
            {chargesSection}
            {notesField}
          </div>
        </div>

        {/* STICKY FOOTER — total + actions, always visible */}
        <div className="px-5 py-3 flex flex-col gap-2.5 shrink-0 sticky bottom-0 z-10" style={{ borderTop: "1px solid var(--border-soft)", background: "var(--surface)" }}>
          {banners}
          <div className="flex items-center justify-between gap-4">
            {totalDisplay}
            <div className="flex gap-2">{actionButtons}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Original stacked layout (unchanged behavior) ──
  return (
    <div className="flex flex-col gap-5 @container">
      {contextSlot}
      {unitStat}
      {existingWarning}
      {chargesSection}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>Payment</p>
        <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
          {paymentDateField}
          {statusField}
          {methodField}
          {customMethodField}
        </div>
        {notesField}
      </div>
      {banners}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>Total</span>
          <span className="text-xl font-bold tabular-nums" style={{ color: "var(--accent)" }}>{fmt(totalAmount)}</span>
        </div>
        <div className="grid grid-cols-1 @sm:grid-cols-2 gap-2">{actionButtons}</div>
      </div>
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
