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
import {
  RoomManager,
  blankRoom,
  draftsToRoomInputs,
  type RoomDraft,
} from "@/components/property/RoomManager";
import type { RoomInput } from "@/types/rental";

export type PropertyFormValues = Omit<Property, "id" | "slug">;

/** Strip the unstable React `key` so room drafts can be compared for dirtiness. */
function roomsFingerprint(rooms: RoomDraft[]) {
  return JSON.stringify(rooms.map(({ id, name, rental_rate, tenant_name }) => ({ id, name, rental_rate, tenant_name })));
}

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

// 16px (text-base) on every input prevents iOS Safari from zooming on focus —
// matches the Add property form so both look identical.
const inputClass =
  "w-full px-3 py-2.5 text-base rounded-lg border outline-none transition focus:ring-2";
const inputStyle: React.CSSProperties = {
  borderColor: "var(--border-soft)",
  background: "var(--surface)",
  color: "var(--text-primary)",
};

export function PropertyForm({
  initial,
  initialRooms,
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
  /** Existing rooms (units) to edit. When omitted, a single blank room is shown. */
  initialRooms?: RoomDraft[];
  submitLabel: string;
  /** 'create' lets the rental model be chosen; 'edit' locks it (changing it
   *  would orphan room / whole-unit revenue data). */
  mode?: "create" | "edit";
  onSubmit: (values: PropertyFormValues, rooms?: RoomInput[]) => void | Promise<void>;
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
  const [rooms, setRooms] = useState<RoomDraft[]>(() =>
    initialRooms && initialRooms.length > 0 ? initialRooms : [blankRoom()]
  );
  const [roomsError, setRoomsError] = useState<string | null>(null);

  // Snapshots of the initial values + rooms used to detect unsaved changes.
  const [initialSnapshot] = useState(() =>
    JSON.stringify({ ...defaultValues(), ...initial })
  );
  const [initialRoomsSnapshot] = useState(() => roomsFingerprint(rooms));

  useEffect(() => {
    if (!onDirtyChange) return;
    const valuesDirty = JSON.stringify(values) !== initialSnapshot;
    const roomsDirty = roomsFingerprint(rooms) !== initialRoomsSnapshot;
    onDirtyChange(valuesDirty || roomsDirty);
  }, [values, rooms, initialSnapshot, initialRoomsSnapshot, onDirtyChange]);

  function set<K extends keyof PropertyFormValues>(
    key: K,
    val: PropertyFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
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
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit(
        { ...values, short_name: values.name, total_units: total, rented_units: rented },
        isRoom ? roomInputs : undefined
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save property to the database.");
    } finally {
      setSaving(false);
    }
  }

  const isWhole = values.rental_model === "whole_unit";

  return (
    <form id={id} onSubmit={handleSubmit} className="@container w-full">
      <div className="grid grid-cols-1 gap-8 @3xl:grid-cols-[1.5fr_2.5fr] @3xl:gap-10">
        {/* ---- Left column: setup (rental model, cover, gallery, capacity) ---- */}
        <div className="flex flex-col gap-9">
          {/* Rental model — selectable on create, locked on edit (changing it
              would orphan room / whole-unit revenue). */}
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
            )}
          </Group>

          {/* Cover image */}
          <Group title="Cover image">
            <CoverImageInput
              value={values.image_url ?? ""}
              onUrlChange={(url) => set("image_url", url)}
              onFileChange={onCoverFileChange}
            />
          </Group>

          {/* Gallery photos */}
          <Group title="Gallery photos">
            <GalleryInput
              value={values.gallery_urls ?? ""}
              allowUpload={typeof onGalleryItemsChange === "function"}
              onItemsChange={onGalleryItemsChange}
              onUrlsChange={(s) => set("gallery_urls", s)}
            />
            <span className="mt-2 block text-[11px]" style={{ color: "var(--text-faint)" }}>
              Extra photos shown on the public share page, after the cover image. Reorder with the arrows.
            </span>
          </Group>

          {/* Capacity */}
          <Group
            title="Capacity"
            hint={
              isWhole
                ? "Whole-unit properties always have one rentable unit."
                : "Add each rentable room with its base rent and tenant. Leave the tenant blank for a vacant room."
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
                    style={{ ...inputStyle, opacity: 0.6 }}
                    value={1}
                    readOnly
                  />
                </Row>
                {/* A whole unit is either occupied by its tenant or vacant — a
                    "rented count" makes no sense, so offer Occupied/Vacant. */}
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

        {/* ---- Right column: property record ---- */}
        <div className="flex flex-col gap-9">
          {/* Property name */}
          <Group title="Property details">
            <Row label="Property Name" required>
              <input
                required
                className={inputClass}
                style={inputStyle}
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Row>
          </Group>

          {/* Location */}
          <Group title="Location">
            <div className="flex flex-col gap-4">
              <Row label="Address">
                <input
                  className={inputClass}
                  style={inputStyle}
                  value={values.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </Row>
              <Row label="City">
                <input
                  className={inputClass}
                  style={inputStyle}
                  value={values.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </Row>
              <Row label="State">
                <input
                  className={inputClass}
                  style={inputStyle}
                  value={values.state}
                  onChange={(e) => set("state", e.target.value)}
                />
              </Row>
              <Row label="Postcode">
                <input
                  className={inputClass}
                  style={inputStyle}
                  value={values.postcode}
                  onChange={(e) => set("postcode", e.target.value)}
                />
              </Row>
            </div>
          </Group>

          {/* Classification */}
          <Group title="Classification">
            <div className="flex flex-col gap-4">
              <Row label="Property Type">
                <Select
                  value={values.property_type}
                  options={PROPERTY_TYPES}
                  onChange={(value) => set("property_type", value as PropertyType)}
                />
              </Row>
              <Row label="Status">
                <Select
                  value={values.status}
                  options={STATUSES}
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
                style={inputStyle}
                value={values.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
              />
            </Row>
          </Group>
        </div>
      </div>

      {/* Footnote about financial truth */}
      <p
        className="text-[11px] leading-relaxed mt-9"
        style={{ color: "var(--text-faint)" }}
      >
        Revenue is recorded against rooms or whole units; expenses are recorded against the property.
        Year-to-date totals shown on the property page are calculated from saved entries.
      </p>

      {hideFooter && submitError ? (
        <p className="text-xs mt-3" style={{ color: "var(--danger)" }}>
          {submitError}
        </p>
      ) : null}

      {/* Actions */}
      {!hideFooter && (
        <div
          className="flex flex-wrap gap-2 justify-end pt-5 mt-9"
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

/** Inline "Label : [input]" row — stacks to a single column on mobile. Mirrors
 *  the Add property form so the edit modal looks identical. */
function Row({
  label,
  required,
  align = "center",
  children,
}: {
  label: string;
  required?: boolean;
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
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
