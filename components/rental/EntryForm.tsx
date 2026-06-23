"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRental } from "@/context/RentalContext";
import { Select } from "@/components/ui/Select";
import type { ExpenseCategory } from "@/types/rental";

type EntryKind = "revenue" | "expense";

const labelClass = "text-xs font-medium uppercase tracking-wider";
const labelStyle: React.CSSProperties = { color: "var(--text-muted)" };
const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border outline-none transition";
const inputStyle: React.CSSProperties = {
  borderColor: "var(--border-soft)",
  background: "var(--surface)",
  color: "var(--text-primary)",
};

const MONTHS = [
  { value: "january", label: "January" },
  { value: "february", label: "February" },
  { value: "march", label: "March" },
  { value: "april", label: "April" },
  { value: "may", label: "May" },
  { value: "june", label: "June" },
  { value: "july", label: "July" },
  { value: "august", label: "August" },
  { value: "september", label: "September" },
  { value: "october", label: "October" },
  { value: "november", label: "November" },
  { value: "december", label: "December" },
];

const MONTH_INDEX: Record<string, number> = Object.fromEntries(
  MONTHS.map((month, index) => [month.value, index + 1])
);

function titleFromParam(value: string | null, fallback: string) {
  if (!value) return fallback;
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateFromPeriod(month: string | null, year: string | null) {
  const monthIndex = MONTHS.findIndex((item) => item.value === month);
  if (monthIndex < 0 || !year) return new Date().toISOString().slice(0, 10);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

export function EntryForm({ kind }: { kind: EntryKind }) {
  const router = useRouter();
  const params = useSearchParams();
  const { visibleProperties, getUnitsForProperty, addRevenueEntry, addExpenseEntry } = useRental();
  const now = new Date();
  const initialPropertyId = params.get("property") ?? visibleProperties[0]?.id ?? "";
  const initialMonth = params.get("month") ?? MONTHS[now.getMonth()].value;
  const initialYear = params.get("year") ?? String(now.getFullYear());

  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [date, setDate] = useState(() => dateFromPeriod(params.get("month"), params.get("year")));
  const [amount, setAmount] = useState("");
  const [unitId, setUnitId] = useState("");
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [category, setCategory] = useState(() =>
    titleFromParam(params.get("category"), kind === "revenue" ? "Rent" : "Maintenance")
  );
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  const propertyUnits = propertyId ? getUnitsForProperty(propertyId) : [];

  const title = kind === "revenue" ? "Enter Revenue" : "Add Expense";
  const verb = kind === "revenue" ? "Save Revenue" : "Save Expense";
  const backHref = propertyId ? `/admin/properties/${propertyId}` : "/admin/properties";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(amount);
    const monthNum = MONTH_INDEX[month] ?? now.getMonth() + 1;
    const yearNum = Number(year) || now.getFullYear();
    if (!propertyId) {
      setError("Select a property.");
      return;
    }
    if (kind === "revenue" && !unitId) {
      setError("Select a unit or room.");
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (kind === "revenue") {
        await addRevenueEntry({
          property_id: propertyId,
          unit_id: unitId,
          year: yearNum,
          month: monthNum,
          rental_amount: amountNum,
          electricity_units: null,
          electricity_amount: null,
          other_charges_amount: null,
          total_amount: amountNum,
          payment_date: date,
          payment_method: "bank_transfer",
          custom_payment_method: null,
          payment_status: "paid",
          notes: note.trim() || null,
          invoice_generated: false,
        });
      } else {
        await addExpenseEntry({
          property_id: propertyId,
          year: yearNum,
          month: monthNum,
          expense_date: date,
          category: "other" as ExpenseCategory,
          custom_category: category.trim() || null,
          amount: amountNum,
          description: note.trim() || category.trim() || null,
          is_recurring: false,
          is_irregular: false,
        });
      }
      setSaved(true);
      setTimeout(() => router.push(backHref), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save ${kind} to the database.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">
      <Link href={backHref} className="text-sm" style={{ color: "var(--text-muted)" }}>
        &#8592; Back
      </Link>

      <form
        onSubmit={handleSubmit}
        className="ui-card p-6 lg:p-8 max-w-2xl flex flex-col gap-5"
      >
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Quickly record a {kind} entry for a property.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass} style={labelStyle}>Property</span>
          <Select
            value={propertyId}
            placeholder="Select property..."
            options={visibleProperties.map((p) => ({ value: p.id, label: p.name }))}
            onChange={setPropertyId}
          />
        </label>

        {kind === "revenue" ? (
          <label className="flex flex-col gap-1.5">
            <span className={labelClass} style={labelStyle}>Unit / Room</span>
            <Select
              value={unitId}
              placeholder={propertyId ? "Select unit..." : "Select a property first"}
              disabled={!propertyId}
              options={propertyUnits.map((unit) => ({ value: unit.id, label: unit.name }))}
              onChange={setUnitId}
            />
          </label>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass} style={labelStyle}>Date</span>
            <input
              type="date"
              required
              className={inputClass}
              style={inputStyle}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass} style={labelStyle}>Amount (MYR)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              required
              className={inputClass}
              style={inputStyle}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass} style={labelStyle}>Month</span>
            <Select
              value={month}
              options={MONTHS}
              onChange={setMonth}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass} style={labelStyle}>Year</span>
            <Select
              value={year}
              options={yearOptions.map((item) => ({ value: item, label: item }))}
              onChange={setYear}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass} style={labelStyle}>Category</span>
          <input
            className={inputClass}
            style={inputStyle}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass} style={labelStyle}>Note</span>
          <textarea
            rows={3}
            className={inputClass}
            style={inputStyle}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          {error && <p className="mr-auto self-center text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
          <Link href={backHref} className="ui-btn">Cancel</Link>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={saved || saving}>
            {saving ? "Saving..." : saved ? "Saved" : verb}
          </button>
        </div>
      </form>
    </div>
  );
}
