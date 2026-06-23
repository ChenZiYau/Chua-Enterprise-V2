// Client-side helpers for persisting changes through the /api/db/[entity]
// route. All calls are best-effort and surface errors to the caller so the UI
// can decide how to react.

export type WritableEntity = "properties" | "units" | "maintenance" | "revenue" | "expenses" | "tenants";

/** Rows that exist in Supabase have a uuid id. Locally generated drafts use a
 *  prefixed id like "rev_" / "exp_" / "ten_". This tells them apart so we only
 *  PATCH/DELETE rows that have actually been persisted. */
export function isPersistedId(id: string): boolean {
  if (!id) return false;
  if (id.includes("_") || id.startsWith("local-") || id.startsWith("seed")) return false;
  const compact = id.replace(/-/g, "");
  return /^[0-9a-f]{32}$/i.test(compact);
}

export async function dbCreate(
  entity: WritableEntity,
  fields: Record<string, unknown>
): Promise<string> {
  const res = await fetch(`/api/db/${entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const json = (await res.json()) as { id?: string; error?: string };
  if (!res.ok || !json.id) throw new Error(json.error || `Create failed (${res.status})`);
  return json.id;
}

export async function dbUpdate(
  entity: WritableEntity,
  id: string,
  fields: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`/api/db/${entity}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, fields }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || `Update failed (${res.status})`);
  }
}

/** Upload a cover image for a property and get back a stable public URL. The
 *  image is stored in Supabase Storage and persisted to image_url. */
export async function uploadPropertyCover(propertyId: string, file: Blob): Promise<string> {
  const form = new FormData();
  form.append("propertyId", propertyId);
  form.append("file", file, (file as File).name || "cover.jpg");
  const res = await fetch(`/api/db/properties/cover`, { method: "POST", body: form });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error || `Cover upload failed (${res.status})`);
  return json.url;
}

/** An ordered gallery item from the form: a pasted URL or an image Blob. */
export type GalleryUpload = { url: string } | { file: Blob };

/** Persist an ordered gallery (uploads + URLs) to a property's gallery_urls.
 *  Returns the resolved display URLs in order. */
export async function uploadPropertyGallery(
  propertyId: string,
  items: GalleryUpload[]
): Promise<string[]> {
  const form = new FormData();
  form.append("propertyId", propertyId);
  const spec = items.map((it, i) => {
    if ("url" in it) return { kind: "url", url: it.url };
    const key = `file_${i}`;
    form.append(key, it.file, (it.file as File).name || `photo_${i}.jpg`);
    return { kind: "file", key };
  });
  form.append("spec", JSON.stringify(spec));
  const res = await fetch(`/api/db/properties/gallery`, { method: "POST", body: form });
  const json = (await res.json().catch(() => ({}))) as { urls?: string[]; error?: string };
  if (!res.ok || !json.urls) throw new Error(json.error || `Gallery upload failed (${res.status})`);
  return json.urls;
}

export async function dbDelete(entity: WritableEntity, id: string): Promise<void> {
  const res = await fetch(`/api/db/${entity}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || `Delete failed (${res.status})`);
  }
}
