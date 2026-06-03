// Client-side helpers for persisting changes back to Notion through the
// /api/notion/[entity] route. All calls are best-effort and surface errors
// to the caller so the UI can decide how to react.

export type WritableEntity = "properties" | "units" | "maintenance" | "revenue" | "expenses" | "tenants";

/** Notion page ids are uuids / 32-char hex. Locally generated ids use a
 *  prefix like "rev_" / "exp_" / "ten_". This tells them apart so we only
 *  PATCH/DELETE rows that actually exist in Notion. */
export function isNotionId(id: string): boolean {
  if (!id) return false;
  if (id.includes("_") || id.startsWith("local-") || id.startsWith("seed")) return false;
  const compact = id.replace(/-/g, "");
  return /^[0-9a-f]{32}$/i.test(compact);
}

export async function notionCreate(
  entity: WritableEntity,
  fields: Record<string, unknown>
): Promise<string> {
  const res = await fetch(`/api/notion/${entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const json = (await res.json()) as { id?: string; error?: string };
  if (!res.ok || !json.id) throw new Error(json.error || `Create failed (${res.status})`);
  return json.id;
}

export async function notionUpdate(
  entity: WritableEntity,
  id: string,
  fields: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`/api/notion/${entity}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, fields }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || `Update failed (${res.status})`);
  }
}

export async function notionDelete(entity: WritableEntity, id: string): Promise<void> {
  const res = await fetch(`/api/notion/${entity}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || `Delete failed (${res.status})`);
  }
}
