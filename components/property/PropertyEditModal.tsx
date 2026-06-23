"use client";

import { useEffect, useMemo, useState } from "react";
import { EditModalShell } from "@/components/ui/EditModalShell";
import { PropertyForm, type PropertyFormValues } from "@/components/property/PropertyForm";
import { roomsFromUnits } from "@/components/property/RoomManager";
import type { GalleryOutItem } from "@/components/property/GalleryInput";
import { SharePreviewModal } from "@/components/share/SharePreviewModal";
import { useRental } from "@/context/RentalContext";
import { uploadPropertyCover, uploadPropertyGallery } from "@/lib/dbClient";
import type { Property, RoomInput } from "@/types/rental";

const FORM_ID = "property-edit-form";

/**
 * Edit a property in place. Renders the SAME reusable PropertyForm as the Add
 * flow (with upload+crop cover + multi-image gallery), locks the rental model,
 * and reuses the Add flow's save→preview→confirm before writing to the database.
 */
export function PropertyEditModal({
  open,
  onClose,
  property,
}: {
  open: boolean;
  onClose: () => void;
  property: Property | null;
}) {
  const { updateProperty, setPropertyCoverLocal, setPropertyGalleryLocal, getUnitsForProperty } = useRental();

  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<PropertyFormValues | null>(null);
  const [pendingRooms, setPendingRooms] = useState<RoomInput[] | undefined>(undefined);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryOutItem[]>([]);
  // The gallery manager only emits after a user edit (it skips its initial emit),
  // so this flag flips true on any add/remove/reorder — even when nothing about
  // the text fields changed (e.g. only an uploaded photo was added).
  const [galleryTouched, setGalleryTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state whenever the modal (re)opens for a property.
  useEffect(() => {
    if (open) {
      setDirty(false);
      setPending(null);
      setCoverFile(null);
      setCoverPreview(null);
      setGalleryItems([]);
      setGalleryTouched(false);
      setSaving(false);
      setError(null);
      setPendingRooms(undefined);
    }
  }, [open, property?.id]);

  function handleCoverFile(file: File | null) {
    setCoverFile(file);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  // Existing rooms (units) seeded into the form so they can be edited.
  const initialRooms = useMemo(
    () => (property ? roomsFromUnits(getUnitsForProperty(property.id)) : []),
    [property, getUnitsForProperty]
  );

  if (!open || !property) return null;

  // Cover/gallery uploads don't always change a form text field, so fold them in.
  const effectiveDirty = dirty || !!coverFile || galleryTouched;

  const previewProperty: Property | null = pending
    ? {
        ...property,
        ...pending,
        image_url: coverPreview || pending.image_url || null,
        gallery_urls: galleryItems.length
          ? galleryItems.map((it) => it.previewUrl).join("\n")
          : pending.gallery_urls || null,
      }
    : null;

  const previewUnits =
    pending && pendingRooms
      ? pendingRooms.map((r, i) => ({
          id: `preview-${i}`,
          property_id: property.id,
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
    if (!pending || !property) return;
    setSaving(true);
    setError(null);
    try {
      // Never change the rental model on update (it's locked in edit mode).
      const { rental_model: _ignored, ...patch } = pending;
      void _ignored;
      await updateProperty(property.id, patch, pendingRooms);
      if (coverFile) {
        const freshUrl = await uploadPropertyCover(property.id, coverFile);
        setPropertyCoverLocal(property.id, freshUrl);
      }
      if (galleryItems.some((it) => !!it.file)) {
        const urls = await uploadPropertyGallery(
          property.id,
          galleryItems.map((it) => (it.file ? { file: it.file } : { url: it.url! }))
        );
        setPropertyGalleryLocal(property.id, urls.join("\n"));
      }
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save property to the database.");
      setSaving(false);
    }
  }

  return (
    <>
      <EditModalShell
        open={open}
        onClose={onClose}
        placement="center"
        widthClass="max-w-5xl"
        panelAspect="16 / 10"
        eyebrow="Edit property"
        title={property.name}
        subtitle="Editing identity, location, photos, or capacity is safe — history is linked by ID."
        dirty={effectiveDirty}
        saving={saving}
        suspendClose={pending !== null}
        primaryLabel="Save Changes"
        primaryFormId={FORM_ID}
        primaryDisabled={!effectiveDirty}
      >
        <PropertyForm
          id={FORM_ID}
          mode="edit"
          initial={property}
          initialRooms={initialRooms}
          submitLabel="Save Changes"
          hideFooter
          onDirtyChange={setDirty}
          onCoverFileChange={handleCoverFile}
          onGalleryItemsChange={(items) => {
            setGalleryItems(items);
            setGalleryTouched(true);
          }}
          onSubmit={(values, rooms) => {
            // Stage and open the confirmation preview (consistent with Add).
            setError(null);
            setPending(values);
            setPendingRooms(rooms);
          }}
        />
      </EditModalShell>

      {previewProperty && (
        <SharePreviewModal
          open={pending !== null}
          onClose={() => {
            if (saving) return;
            setPending(null);
          }}
          property={previewProperty}
          units={previewUnits}
          eyebrow="Confirm changes"
          confirmLabel="Confirm & save"
          onConfirm={handleConfirm}
          confirming={saving}
          confirmError={error}
        />
      )}
    </>
  );
}
