"use client";

import { useState } from "react";
import type {
  Property,
  PropertyStatus,
  PropertyType,
  RentalModel,
} from "@/types/rental";
import { Select } from "@/components/ui/Select";
import { CoverImageInput } from "@/components/property/CoverImageInput";
import {
  RoomManager,
  blankRoom,
  draftsToRoomInputs,
  type RoomDraft,
} from "@/components/property/RoomManager";
import type { RoomInput } from "@/types/rental";

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

// 16px (text-base) on every input prevents iOS Safari from zooming on focus.
const inputClass =
  "w-full px-3 py-2.5 text-base rounded-lg border outline-none transition focus:ring-2";
const inputBaseStyle: React.CSSProperties = {
  background: "var(--surface)",
  color: "var(--text-primary)",
};
function fieldStyle(invalid?: boolean): React.CSSProperties {
  return {
    ...inputBaseStyle,
    borderColor: invalid ? "var(--danger)" : "var(--border-soft)",
  };
}

/** Fields that must be filled before the property can be saved. */
const REQUIRED_FIELDS: (keyof PropertyFormValues)[] = [
  "name",
  "address",
  "city",
  "state",
  "postcode",
  "property_type",
  "status",
  "total_units",
];

const FIELD_LABELS: Partial<Record<keyof PropertyFormValues, string>> = {
  name: "Property Name",
  address: "Address",
  city: "City",
  state: "State",
  postcode: "Postcode",
  property_type: "Property Type",
  status: "Status",
  total_units: "Total Rooms",
};

type Errors = Partial<Record<keyof PropertyFormValues, string>>;

/**
 * Add-property form: a wide, two-column layout. The left column holds the
 * "setup" choices (rental model, cover image, capacity); the right column holds
 * the property record fields, top to bottom: name, location, classification,
 * description. Collapses to a single column on mobile.
 */
export function AddPropertyForm({
  submitLabel,
  onSubmit,
  onCancel,
  onCoverFileChange,
  saving,
}: {
  submitLabel: string;
  onSubmit: (values: PropertyFormValues, rooms?: RoomInput[]) => void | Promise<void>;
  onCancel?: () => void;
  /** Receive the cropped/uploaded cover image Blob to store on save (or null). */
  onCoverFileChange?: (file: File | null) => void;
  saving?: boolean;
}) {
  const [values, setValues] = useState<PropertyFormValues>(defaultValues);
  const [errors, setErrors] = useState<Errors>({});
  const [rooms, setRooms] = useState<RoomDraft[]>(() => [blankRoom()]);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  function set<K extends keyof PropertyFormValues>(key: K, val: PropertyFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
    // Clear a field's error as soon as the user edits it.
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function validate(v: PropertyFormValues): Errors {
    const next: Errors = {};
    for (const field of REQUIRED_FIELDS) {
      const value = v[field];
      const empty =
        field === "total_units"
          ? !(Number(value) > 0)
          : typeof value === "string"
          ? value.trim() === ""
          : value == null;
      if (empty) next[field] = `${FIELD_LABELS[field]} is required.`;
    }
    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isRoom = values.rental_model === "room_rental";
    const roomInputs = draftsToRoomInputs(rooms);

    let total: number;
    let rented: number;
    if (isRoom) {
      if (roomInputs.length === 0) {
        setRoomsError("Add at least one room.");
        return;
      }
      if (roomInputs.some((r) => !r.name)) {
        setRoomsError("Every room needs a name.");
        return;
      }
      total = roomInputs.length;
      rented = roomInputs.filter((r) => (r.tenant_name ?? "") !== "").length;
    } else {
      total = Math.max(0, values.total_units || 0);
      rented = Math.min(total, Math.max(0, values.rented_units || 0));
    }
    const cleaned = { ...values, total_units: total, rented_units: rented };

    const found = validate(cleaned);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    // short_name is no longer captured separately — default it to the name.
    onSubmit({ ...cleaned, short_name: cleaned.name }, isRoom ? roomInputs : undefined);
  }

  const isWhole = values.rental_model === "whole_unit";

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_2.5fr] lg:gap-10">
        {/* ---- Left column: setup (rental model, cover image, capacity) ---- */}
        <div className="flex flex-col gap-9">
          {/* Rental model */}
          <Group title="Rental model">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {m.label}
                    </p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {m.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </Group>

          {/* Cover image (upload only) */}
          <Group title="Cover image">
            <CoverImageInput
              value={values.image_url ?? ""}
              hideLinkOption
              onUrlChange={(url) => set("image_url", url)}
              onFileChange={onCoverFileChange}
            />
          </Group>

          {/* Capacity */}
          <Group
            title="Capacity"
            hint={
              isWhole
                ? "Whole-unit properties always have one rentable unit."
                : "Add each rentable room with its base rent and tenant. The tenant can be left blank for a vacant room."
            }
          >
            {isWhole ? (
              <div className="flex flex-col gap-4">
                <Row label="Total Units">
                  <input
                    type="number"
                    min={1}
                    disabled
                    className={inputClass}
                    style={{ ...fieldStyle(), opacity: 0.6 }}
                    value={1}
                    readOnly
                  />
                </Row>
                <Row label="Occupancy">
                  <Select
                    value={values.rented_units > 0 ? "occupied" : "vacant"}
                    options={[
                      { value: "vacant", label: "Vacant" },
                      { value: "occupied", label: "Occupied" },
                    ]}
                    onChange={(value) => set("rented_units", value === "occupied" ? 1 : 0)}
                  />
                </Row>
              </div>
            ) : (
              <RoomManager
                rooms={rooms}
                onChange={(r) => {
                  setRooms(r);
                  setRoomsError(null);
                }}
                error={roomsError ?? undefined}
              />
            )}
          </Group>
        </div>

        {/* ---- Right column: property record — name, location, classification, description ---- */}
        <div className="flex flex-col gap-9">
          {/* Property name */}
          <Group title="Property details">
            <Row label="Property Name" required error={errors.name}>
              <input
                className={inputClass}
                style={fieldStyle(!!errors.name)}
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Row>
          </Group>

          {/* Location */}
          <Group title="Location">
            <div className="flex flex-col gap-4">
              <Row label="Address" required error={errors.address}>
                <input
                  className={inputClass}
                  style={fieldStyle(!!errors.address)}
                  value={values.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </Row>
              <Row label="City" required error={errors.city}>
                <input
                  className={inputClass}
                  style={fieldStyle(!!errors.city)}
                  value={values.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </Row>
              <Row label="State" required error={errors.state}>
                <input
                  className={inputClass}
                  style={fieldStyle(!!errors.state)}
                  value={values.state}
                  onChange={(e) => set("state", e.target.value)}
                />
              </Row>
              <Row label="Postcode" required error={errors.postcode}>
                <input
                  className={inputClass}
                  style={fieldStyle(!!errors.postcode)}
                  value={values.postcode}
                  onChange={(e) => set("postcode", e.target.value)}
                />
              </Row>
            </div>
          </Group>

          {/* Classification */}
          <Group title="Classification">
            <div className="flex flex-col gap-4">
              <Row label="Property Type" required error={errors.property_type}>
                <Select
                  value={values.property_type}
                  options={PROPERTY_TYPES}
                  invalid={!!errors.property_type}
                  onChange={(value) => set("property_type", value as PropertyType)}
                />
              </Row>
              <Row label="Status" required error={errors.status}>
                <Select
                  value={values.status}
                  options={STATUSES}
                  invalid={!!errors.status}
                  onChange={(value) => set("status", value as PropertyStatus)}
                />
              </Row>
            </div>
          </Group>

          {/* Description */}
          <Group title="Description">
            <Row label="Description" align="start">
              <textarea
                rows={4}
                className={inputClass}
                style={fieldStyle()}
                value={values.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
              />
            </Row>
          </Group>
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex flex-wrap gap-2 justify-end pt-5 mt-9"
        style={{ borderTop: "1px solid var(--border-soft)" }}
      >
        {onCancel ? (
          <button type="button" className="ui-btn" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="ui-btn ui-btn-primary" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>
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
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
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

/** Inline "Label : [input]" row — stacks to a single column on mobile. */
function Row({
  label,
  required,
  error,
  align = "center",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "flex flex-col gap-1 sm:flex-row sm:gap-3 " +
        (align === "start" ? "sm:items-start" : "sm:items-center")
      }
    >
      <label
        className={
          "shrink-0 sm:w-40 flex items-center gap-1 text-sm font-medium " +
          (align === "start" ? "sm:pt-2.5" : "")
        }
        style={{ color: "var(--text-secondary)" }}
      >
        <span>{label}</span>
        {required ? <span style={{ color: "var(--accent)" }}>*</span> : null}
        <span aria-hidden>:</span>
      </label>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {children}
        {error ? (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
