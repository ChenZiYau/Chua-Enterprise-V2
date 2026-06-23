"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddPropertyForm, type PropertyFormValues } from "@/components/property/AddPropertyForm";
import { SharePreviewModal } from "@/components/share/SharePreviewModal";
import { useRental } from "@/context/RentalContext";
import { uploadPropertyCover } from "@/lib/dbClient";
import type { Property, RoomInput, Unit } from "@/types/rental";

export default function NewPropertyPage() {
  const router = useRouter();
  const { createProperty, setPropertyCoverLocal } = useRental();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 4: staged values shown in the confirmation preview before committing.
  const [pending, setPending] = useState<PropertyFormValues | null>(null);
  // Staged rooms (room-rental properties) to create alongside the property.
  const [pendingRooms, setPendingRooms] = useState<RoomInput[] | undefined>(undefined);
  // A cropped/uploaded cover Blob (null when no cover was chosen).
  const [coverFile, setCoverFile] = useState<File | null>(null);
  // Object URL for previewing the cropped cover (which isn't yet a remote URL).
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  function handleCoverFile(file: File | null) {
    setCoverFile(file);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  // Build a Property + representative units to render the real public preview.
  const previewProperty: Property | null = pending
    ? {
        ...pending,
        id: "preview",
        slug: "preview",
        image_url: coverPreview || pending.image_url || null,
      }
    : null;

  const previewUnits: Unit[] =
    pending && pending.rental_model === "room_rental"
      ? (pendingRooms ?? []).map((r, i) => ({
          id: `preview-${i}`,
          property_id: "preview",
          name: r.name || `Room ${i + 1}`,
          label: `R${i + 1}`,
          sort_order: i + 1,
          is_rented: (r.tenant_name ?? "").trim() !== "",
          tenant_name: r.tenant_name,
          rental_rate: r.rental_rate,
          electricity_free_units: 0,
        }))
      : [];

  async function handleConfirm() {
    if (!pending) return;
    setSaving(true);
    setError(null);
    try {
      // For an uploaded cover, the URL field is empty — the cover is attached to
      // the page after creation, so we don't persist an expiring URL as text.
      const created = await createProperty(pending, pendingRooms);
      if (coverFile) {
        const freshUrl = await uploadPropertyCover(created.id, coverFile);
        setPropertyCoverLocal(created.id, freshUrl);
      }
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      router.push(`/admin/properties/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save property to the database.");
      setSaving(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-7">
      <div>
        <Link
          href="/admin/properties"
          className="text-xs inline-flex items-center gap-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          <span aria-hidden>&#8592;</span>
          Back to Properties
        </Link>
        <div className="mt-4">
          <p
            className="text-[11px] uppercase tracking-[0.16em]"
            style={{ color: "var(--text-faint)" }}
          >
            New
          </p>
          <h2
            className="text-2xl font-semibold mt-1 tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Add a property
          </h2>
          <p className="text-sm mt-1.5 max-w-xl" style={{ color: "var(--text-muted)" }}>
            Choose how the property is rented, then fill in identity, location, and capacity.
          </p>
        </div>
      </div>

      <div className="ui-card p-5 sm:p-6 lg:p-8">
        {error && !pending && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: "rgba(211,84,84,0.08)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
            {error}
          </div>
        )}
        <AddPropertyForm
          submitLabel="Save Property"
          onCancel={() => router.push("/admin/properties")}
          onCoverFileChange={handleCoverFile}
          onSubmit={(values, rooms) => {
            // Don't commit yet — stage the values and open the confirmation preview.
            setError(null);
            setPending(values);
            setPendingRooms(rooms);
          }}
        />
      </div>

      {/* Phase 4: confirmation preview — renders exactly as the public/property view. */}
      {previewProperty && (
        <SharePreviewModal
          open={pending !== null}
          onClose={() => {
            if (saving) return;
            setPending(null);
          }}
          property={previewProperty}
          units={previewUnits}
          eyebrow="Confirm new listing"
          confirmLabel="Confirm & save"
          onConfirm={handleConfirm}
          confirming={saving}
          confirmError={error}
        />
      )}
    </div>
  );
}
