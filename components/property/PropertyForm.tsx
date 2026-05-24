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

const RENTAL_MODELS: { value: RentalModel; label: string }[] = [
  { value: "room_rental", label: "Room Rental" },
  { value: "whole_unit", label: "Whole Unit" },
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

const labelClass = "text-xs font-medium uppercase tracking-wider";
const labelStyle: React.CSSProperties = { color: "var(--text-muted)" };
const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border outline-none transition";
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
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Property name" htmlFor="name">
          <input
            id="name"
            required
            className={inputClass}
            style={inputStyle}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="Short name" htmlFor="short_name">
          <input
            id="short_name"
            className={inputClass}
            style={inputStyle}
            value={values.short_name}
            onChange={(e) => set("short_name", e.target.value)}
          />
        </Field>
        <Field label="Address" htmlFor="address" full>
          <input
            id="address"
            className={inputClass}
            style={inputStyle}
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </Field>
        <Field label="City" htmlFor="city">
          <input
            id="city"
            className={inputClass}
            style={inputStyle}
            value={values.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </Field>
        <Field label="State" htmlFor="state">
          <input
            id="state"
            className={inputClass}
            style={inputStyle}
            value={values.state}
            onChange={(e) => set("state", e.target.value)}
          />
        </Field>
        <Field label="Postcode" htmlFor="postcode">
          <input
            id="postcode"
            className={inputClass}
            style={inputStyle}
            value={values.postcode}
            onChange={(e) => set("postcode", e.target.value)}
          />
        </Field>
        <Field label="Image URL" htmlFor="image_url">
          <input
            id="image_url"
            className={inputClass}
            style={inputStyle}
            placeholder="https://…"
            value={values.image_url ?? ""}
            onChange={(e) => set("image_url", e.target.value)}
          />
        </Field>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Rental model" htmlFor="rental_model">
          <select
            id="rental_model"
            className="ui-select"
            value={values.rental_model}
            onChange={(e) => set("rental_model", e.target.value as RentalModel)}
          >
            {RENTAL_MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Property type" htmlFor="property_type">
          <select
            id="property_type"
            className="ui-select"
            value={values.property_type}
            onChange={(e) => set("property_type", e.target.value as PropertyType)}
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="status">
          <select
            id="status"
            className="ui-select"
            value={values.status}
            onChange={(e) => set("status", e.target.value as PropertyStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Total units" htmlFor="total_units">
          <input
            id="total_units"
            type="number"
            min={1}
            className={inputClass}
            style={inputStyle}
            value={values.total_units}
            onChange={(e) => set("total_units", Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Rented units" htmlFor="rented_units">
          <input
            id="rented_units"
            type="number"
            min={0}
            className={inputClass}
            style={inputStyle}
            value={values.rented_units}
            onChange={(e) => set("rented_units", Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="YTD revenue" htmlFor="ytd_revenue">
          <input
            id="ytd_revenue"
            type="number"
            min={0}
            className={inputClass}
            style={inputStyle}
            value={values.ytd_revenue ?? 0}
            onChange={(e) => set("ytd_revenue", Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="YTD expenses" htmlFor="ytd_expenses">
          <input
            id="ytd_expenses"
            type="number"
            min={0}
            className={inputClass}
            style={inputStyle}
            value={values.ytd_expenses ?? 0}
            onChange={(e) => set("ytd_expenses", Number(e.target.value) || 0)}
          />
        </Field>
      </section>

      <Field label="Description" htmlFor="description" full>
        <textarea
          id="description"
          rows={3}
          className={inputClass}
          style={inputStyle}
          value={values.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <div className="flex gap-2 justify-end pt-2">
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

function Field({
  label,
  htmlFor,
  full,
  children,
}: {
  label: string;
  htmlFor?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className={"flex flex-col gap-1.5 " + (full ? "md:col-span-2" : "")}>
      <span className={labelClass} style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}
