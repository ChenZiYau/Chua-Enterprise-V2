"use client";

import { useEffect, useState } from "react";
import type {
  Property,
  PropertyStatus,
  PropertyType,
  RentalModel,
} from "@/types/rental";
import { Select } from "@/components/ui/Select";
import { CoverImageInput } from "@/components/property/CoverImageInput";
import { GalleryInput, type GalleryOutItem } from "@/components/property/GalleryInput";

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
    gallery_urls: "",
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
  id,
  hideFooter,
  onDirtyChange,
  onCoverFileChange,
  onGalleryItemsChange,
  mode = "create",
}: {
  initial?: Partial<PropertyFormValues>;
  submitLabel: string;
  /** 'create' lets the rental model be chosen; 'edit' locks it (changing it
   *  would orphan room / whole-unit revenue data). */
  mode?: "create" | "edit";
  onSubmit: (values: PropertyFormValues) => void | Promise<void>;
  onCancel?: () => void;
  /** Give the underlying <form> an id so external buttons can submit it via `form={id}`. */
  id?: string;
  /** Hide the built-in Cancel/Submit footer (when a parent provides its own actions). */
  hideFooter?: boolean;
  /** Report whether the form has unsaved changes relative to its initial values. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Receive a cropped/uploaded cover image Blob to store on save (or null).
   *  When omitted, the cover control offers paste-a-URL only behaviour. */
  onCoverFileChange?: (file: File | null) => void;
  /** Receive the ordered gallery list (URL items + image Blobs) to store on save.
   *  When omitted, the gallery manager offers paste-a-URL only behaviour. */
  onGalleryItemsChange?: (items: GalleryOutItem[]) => void;
}) {
  const [values, setValues] = useState<PropertyFormValues>({
    ...defaultValues(),
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Snapshot of the initial values used to detect unsaved changes.
  const [initialSnapshot] = useState(() =>
    JSON.stringify({ ...defaultValues(), ...initial })
  );

  useEffect(() => {
    if (!onDirtyChange) return;
    onDirtyChange(JSON.stringify(values) !== initialSnapshot);
  }, [values, initialSnapshot, onDirtyChange]);

  function set<K extends keyof PropertyFormValues>(
    key: K,
    val: PropertyFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Clamp rented_units to total_units to prevent invalid states.
    const total = Math.max(0, values.total_units || 0);
    const rented = Math.min(total, Math.max(0, values.rented_units || 0));
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit({ ...values, short_name: values.name, total_units: total, rented_units: rented });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save property to Notion.");
    } finally {
      setSaving(false);
    }
  }

  const isWhole = values.rental_model === "whole_unit";

  return (
    <form id={id} onSubmit={handleSubmit} className="@container flex flex-col gap-10 @lg:gap-12">
      {/* Rental model - pick visually, this is the most important choice.
          Locked in edit mode: changing it would orphan room / whole-unit data. */}
      <Group title="Rental model">
        {mode === "edit" ? (
          <div className="flex flex-col gap-2">
            {RENTAL_MODELS.filter((m) => m.value === values.rental_model).map((m) => (
              <div
                key={m.value}
                aria-disabled
                className="text-left p-4 rounded-xl flex items-start justify-between gap-3"
                style={{
                  border: "1px solid var(--border-soft)",
                  background: "var(--surface-muted)",
                }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{m.label}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{m.hint}</p>
                </div>
                <span
                  className="text-[10px] uppercase tracking-[0.12em] inline-flex items-center gap-1 shrink-0 px-2 py-1 rounded-md"
                  style={{ color: "var(--text-faint)", border: "1px solid var(--border-soft)" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  Locked
                </span>
              </div>
            ))}
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
              The rental model can&apos;t be changed after a property is created — it would orphan the
              room or whole-unit revenue already recorded against it.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
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
        )}
      </Group>

      {/* Identity */}
      <Group title="Property details">
        <div className="grid grid-cols-1 gap-4">
          <Field label="Property name" required>
            <input
              required
              className={inputClass}
              style={inputStyle}
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
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
      <Group title="Location">
        <div className="grid grid-cols-1 gap-4">
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
          {/* Not a <label>: the control nests buttons + a file input, which a
              wrapping label would hijack clicks for. */}
          <div className="flex flex-col gap-1.5 @lg:col-span-2">
            <span
              className="text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "var(--text-muted)" }}
            >
              Cover image
            </span>
            <CoverImageInput
              value={values.image_url ?? ""}
              onUrlChange={(url) => set("image_url", url)}
              onFileChange={onCoverFileChange}
            />
          </div>
          {/* Not a <label>: the manager nests buttons + a file input. */}
          <div className="flex flex-col gap-1.5 @lg:col-span-2">
            <span
              className="text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "var(--text-muted)" }}
            >
              Gallery photos
            </span>
            <GalleryInput
              value={values.gallery_urls ?? ""}
              allowUpload={typeof onGalleryItemsChange === "function"}
              onItemsChange={onGalleryItemsChange}
              onUrlsChange={(s) => set("gallery_urls", s)}
            />
            <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              Extra photos shown on the public share page, after the cover image. Reorder with the arrows.
            </span>
          </div>
        </div>
      </Group>

      {/* Classification */}
      <Group title="Classification">
        <div className="grid grid-cols-1 gap-4">
          <Field label="Property type">
            <Select
              value={values.property_type}
              options={PROPERTY_TYPES}
              onChange={(value) => set("property_type", value as PropertyType)}
            />
          </Field>
          <Field label="Status">
            <Select
              value={values.status}
              options={STATUSES}
              onChange={(value) => set("status", value as PropertyStatus)}
            />
          </Field>
        </div>
      </Group>

      {/* Capacity */}
      <Group
        title="Capacity"
        hint={
          isWhole
            ? "Whole-unit properties always have one rentable unit."
            : "Total rooms is the number of rentable rooms in this property."
        }
      >
        <div className="grid grid-cols-1 gap-4">
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
          {isWhole ? (
            /* A whole unit is either occupied by its tenant or vacant — a "rented
               count" makes no sense, so offer a plain Occupied/Vacant choice. */
            <Field label="Occupancy">
              <Select
                value={values.rented_units > 0 ? "occupied" : "vacant"}
                options={[
                  { value: "vacant", label: "Vacant" },
                  { value: "occupied", label: "Occupied" },
                ]}
                onChange={(value) => set("rented_units", value === "occupied" ? 1 : 0)}
              />
            </Field>
          ) : (
            <Field label="Rented rooms">
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
          )}
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

      {hideFooter && submitError ? (
        <p className="text-xs -mt-4" style={{ color: "var(--danger)" }}>
          {submitError}
        </p>
      ) : null}

      {/* Actions - sticky-feeling footer */}
      {!hideFooter && (
        <div
          className="flex flex-wrap gap-2 justify-end pt-5"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          {submitError ? (
            <p className="mr-auto self-center text-xs" style={{ color: "var(--danger)" }}>
              {submitError}
            </p>
          ) : null}
          {onCancel ? (
            <button type="button" className="ui-btn" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          <button type="submit" className="ui-btn ui-btn-primary" disabled={saving}>
            {saving ? "Saving..." : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h3>
        {hint ? (
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
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
    <label className={"flex flex-col gap-1.5 " + (full ? "@lg:col-span-2" : "")}>
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
