"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRental } from "@/context/RentalContext";

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

export function EntryForm({ kind }: { kind: EntryKind }) {
  const router = useRouter();
  const params = useSearchParams();
  const { visibleProperties } = useRental();
  const initialPropertyId = params.get("property") ?? visibleProperties[0]?.id ?? "";

  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(kind === "revenue" ? "rent" : "maintenance");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const title = kind === "revenue" ? "Enter Revenue" : "Add Expense";
  const verb = kind === "revenue" ? "Save Revenue" : "Save Expense";
  const backHref = propertyId ? `/admin/properties/${propertyId}` : "/admin/properties";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Persistence for entries is not implemented yet — this is a placeholder
    // that confirms the inputs are wired correctly.
    setSaved(true);
    setTimeout(() => router.push(backHref), 700);
  }

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">
      <Link href={backHref} className="text-sm" style={{ color: "var(--text-muted)" }}>
        ← Back
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
          <select
            className="ui-select"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            required
          >
            <option value="" disabled>Select property…</option>
            {visibleProperties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

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
          <Link href={backHref} className="ui-btn">Cancel</Link>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={saved}>
            {saved ? "Saved" : verb}
          </button>
        </div>
      </form>
    </div>
  );
}
