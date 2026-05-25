"use client";

import { useState } from "react";
import type {
  Property,
  PropertyStatus,
  PropertyType,
  RentalModel,
} from "@/types/rental";

export type PropertyFormValues = Omit<Property, "id" | "slug">;

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "house", label: "House" },
  { value: "condo", label: "Condo" },
  { value: "apartment", label: "Apartment" },
  { value: "townhouse", label: "Townhouse" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
];

const RENTAL_MODELS: { value: RentalModel; label: string; hint: string }[] = [
  {
    value: "room_rental",
    label: "Room rental",
    hint: "Multiple rooms; revenue is collected per room.",
  },
  {
    value: "whole_unit",
    label: "Whole unit",
    hint: "One tenancy for the entire unit.",
  },
];

const STATUSES: { value: PropertyStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "under_service", label: "Under Service" },
];

function defaultValues(): PropertyFormValues {
  return {
    name: "",
    short_name: "",
    address: "",
    city: "",
    state: "",
    postcode: "",
    rental_model: "room_rental",
    property_type: "house",
    status: "active",
    image_url: "",
    description: "",
    total_units: 1,
    rented_units: 0,
    ytd_revenue: 0,
    ytd_expenses: 0,
    deleted_at: null,
    delete_expires_at: null,
  };
}

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border outline-none transition focus:ring-2";
const inputStyle: React.CSSProperties = {
  borderColor: "var(--border-soft)",
  background: "var(--surface)",
  color: "var(--text-primary)",
};

export function PropertyForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<PropertyFormValues>;
  submitLabel: string;
  onSubmit: (values: PropertyFormValues) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<PropertyFormValues>({
    ...defaultValues(),
    ...initial,
  });

  function set<K extends keyof PropertyFormValues>(
    key: K,
    val: PropertyFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Clamp rented_units to total_units to prevent invalid states.
    const total = Math.max(0, values.total_units || 0);
    const rented = Math.min(total, Math.max(0, values.rented_units || 0));
    onSubmit({ ...values, total_units: total, rented_units: rented });
  }

  const isWhole = values.rental_model === "whole_unit";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      {/* Rental model — pick visually, this is the most important choice */}
      <Group eyebrow="Rental model" title="How is this property rented?">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {RENTAL_MODELS.map((m) => {
            const active = values.rental_model === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  set("rental_model", m.value);
                  if (m.value === "whole_unit") {
                    set("total_units", 1);
                    if ((values.rented_units || 0) > 1) set("rented_units", 1);
                  }
                }}
                className="text-left p-4 rounded-xl transition"
                style={{
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: active ? "var(--accent)" : "var(--border-soft)",
                  background: active ? "var(--accent-soft)" : "var(--surface)",
                  boxShadow: active ? "0 0 0 3px var(--accent-ring)" : "none",
                }}
              >
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {m.label}
                </p>
                <p
                  className="text-xs mt-1 leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {m.hint}
                </p>
              </button>
            );
          })}
        </div>
      </Group>

      {/* Identity */}
      <Group eyebrow="Identity" title="Name and description">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Property name" required>
            <input
              required
              className={inputClass}
              style={inputStyle}
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Short name">
            <input
              className={inputClass}
              style={inputStyle}
              placeholder="Display alias, e.g. ‘Menjalara’"
              value={values.short_name}
              onChange={(e) => set("short_name", e.target.value)}
            />
          </Field>
          <Field label="Description" full>
            <textarea
              rows={3}
              className={inputClass}
              style={inputStyle}
              value={values.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
        </div>
      </Group>

      {/* Location */}
      <Group eyebrow="Location" title="Where is it?">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Address" full>
            <input
              className={inputClass}
              style={inputStyle}
              value={values.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
          <Field label="City">
            <input
              className={inputClass}
              style={inputStyle}
              value={values.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </Field>
          <Field label="State">
            <input
              className={inputClass}
              style={inputStyle}
              value={values.state}
              onChange={(e) => set("state", e.target.value)}
            />
          </Field>
          <Field label="Postcode">
            <input
              className={inputClass}
              style={inputStyle}
              value={values.postcode}
              onChange={(e) => set("postcode", e.target.value)}
            />
          </Field>
          <Field label="Image URL" full>
            <input
              className={inputClass}
              style={inputStyle}
              placeholder="https://…"
              value={values.image_url ?? ""}
              onChange={(e) => set("image_url", e.target.value)}
            />
          </Field>
        </div>
      </Group>

      {/* Classification */}
      <Group eyebrow="Classification" title="Type and status">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Property type">
            <select
              className="ui-select"
              value={values.property_type}
              onChange={(e) => set("property_type", e.target.value as PropertyType)}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className="ui-select"
              value={values.status}
              onChange={(e) => set("status", e.target.value as PropertyStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </Group>

      {/* Capacity */}
      <Group
        eyebrow="Capacity"
        title={isWhole ? "Whole-unit tenancy" : "Rooms and occupancy"}
        hint={
          isWhole
            ? "Whole-unit properties always have one rentable unit."
            : "Total rooms is the number of rentable rooms in this property."
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label={isWhole ? "Total units" : "Total rooms"}>
            <input
              type="number"
              min={1}
              disabled={isWhole}
              className={inputClass}
              style={{
                ...inputStyle,
                opacity: isWhole ? 0.6 : 1,
              }}
              value={values.total_units}
              onChange={(e) => set("total_units", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label={isWhole ? "Rented" : "Rented rooms"}>
            <input
              type="number"
              min={0}
              max={values.total_units}
              className={inputClass}
              style={inputStyle}
              value={values.rented_units}
              onChange={(e) => set("rented_units", Number(e.target.value) || 0)}
            />
          </Field>
        </div>
      </Group>

      {/* Footnote about financial truth */}
      <p
        className="text-[11px] leading-relaxed -mt-4"
        style={{ color: "var(--text-faint)" }}
      >
        Revenue is recorded against rooms or whole units; expenses are recorded against the property.
        Year-to-date totals shown on the property page are calculated from saved entries.
      </p>

      {/* Actions — sticky-feeling footer */}
      <div
        className="flex gap-2 justify-end pt-5"
        style={{ borderTop: "1px solid var(--border-soft)" }}
      >
        {onCancel ? (
          <button type="button" className="ui-btn" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="ui-btn ui-btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Group({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-x-8 gap-y-4">
      <div>
        <p
          className="text-[11px] uppercase tracking-[0.16em]"
          style={{ color: "var(--text-faint)" }}
        >
          {eyebrow}
        </p>
        <h3
          className="text-sm font-semibold mt-1"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h3>
        {hint ? (
          <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {hint}
          </p>
        ) : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={"flex flex-col gap-1.5 " + (full ? "md:col-span-2" : "")}>
      <span
        className="text-[11px] font-medium uppercase tracking-[0.12em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
        {required ? <span style={{ color: "var(--accent)" }}> *</span> : null}
      </span>
      {children}
    </label>
  );
}
