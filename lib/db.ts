import "server-only";
import { supabaseAdmin, IMAGE_BUCKET } from "@/lib/supabaseServer";

// Server-only data layer backed by Supabase (Postgres). It exposes the same
// row shapes and read/write API the app previously used against Notion (now Supabase), so the
// rest of the codebase is unchanged: reads return camelCase rows with related
// records denormalised to their *names* (property / unit), and writes accept the
// camelCase field objects produced by lib/dbSync.ts (relations passed as names,
// resolved to foreign-key ids here).

export type Entity =
  | "properties"
  | "units"
  | "tenants"
  | "revenue"
  | "expenses"
  | "maintenance";

// ---- typed rows (identical shape to the previous data layer) ----
export type PropertyRow = {
  id: string;
  name: string;
  slug: string;
  shortName: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  rentalModel: string;
  propertyType: string;
  status: string;
  imageUrl: string;
  galleryUrls: string;
  shareUrl: string;
  description: string;
  totalUnits: number;
  rentedUnits: number;
  ytdRevenue: number;
  ytdExpenses: number;
};

export type UnitRow = {
  id: string;
  name: string;
  property: string;
  label: string;
  sortOrder: number;
  isRented: boolean;
  tenantName: string;
  rentalRate: number;
  electricityFreeUnits: number;
  depositMonths: number;
  depositAmount: number;
  galleryUrls: string;
  shareUrl: string;
};

export type TenantRow = {
  id: string;
  name: string;
  icNumber: string;
  email: string;
  phone: string;
  previousAddress: string;
  unit: string;
  property: string;
  leaseStart: string;
  leaseEnd: string;
  notes: string;
};

export type RevenueRow = {
  id: string;
  name: string;
  property: string;
  unit: string;
  year: number;
  month: number;
  rentalAmount: number;
  electricityUnits: number;
  electricityAmount: number;
  otherCharges: number;
  totalAmount: number;
  paymentDate: string;
  paymentMethod: string;
  paymentStatus: string;
  invoiceGenerated: boolean;
  invoiceNumber: string;
  invoiceSent: boolean;
  invoiceSentAt: string;
  notes: string;
};

export type ExpenseRow = {
  id: string;
  name: string;
  property: string;
  unit: string;
  year: number;
  month: number;
  expenseDate: string;
  category: string;
  customCategory: string;
  amount: number;
  description: string;
  isRecurring: boolean;
  isIrregular: boolean;
  isFixed: boolean;
};

export type MaintenanceRow = {
  id: string;
  name: string;
  property: string;
  unit: string;
  tenant: string;
  category: string;
  priority: string;
  status: string;
  reportedDate: string;
  dueDate: string;
  assignedTo: string;
  description: string;
};

// ---- small coercion helpers ----
const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
const b = (v: unknown): boolean => !!v;

type Rel = { name?: string | null } | null;
type UnitRel = { name?: string | null; properties?: Rel } | null;

// ------------------------- READ LAYER -------------------------

export async function getProperties(): Promise<PropertyRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("properties")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Supabase properties read failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: s(r.id),
    name: s(r.name),
    slug: s(r.slug),
    shortName: s(r.short_name),
    address: s(r.address),
    city: s(r.city),
    state: s(r.state),
    postcode: s(r.postcode),
    rentalModel: s(r.rental_model),
    propertyType: s(r.property_type),
    status: s(r.status),
    imageUrl: s(r.image_url),
    galleryUrls: s(r.gallery_urls),
    shareUrl: s(r.share_url),
    description: s(r.description),
    totalUnits: n(r.total_units),
    rentedUnits: n(r.rented_units),
    ytdRevenue: n(r.ytd_revenue),
    ytdExpenses: n(r.ytd_expenses),
  }));
}

export async function getUnits(): Promise<UnitRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("units")
    .select("*, properties(name)")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Supabase units read failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: s(r.id),
    name: s(r.name),
    property: s((r.properties as Rel)?.name),
    label: s(r.label),
    sortOrder: n(r.sort_order),
    isRented: b(r.is_rented),
    tenantName: s(r.tenant_name),
    rentalRate: n(r.rental_rate),
    electricityFreeUnits: n(r.electricity_free_units),
    depositMonths: n(r.deposit_months),
    depositAmount: n(r.deposit_amount),
    galleryUrls: s(r.gallery_urls),
    shareUrl: s(r.share_url),
  }));
}

export async function getTenants(): Promise<TenantRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("tenants")
    .select("*, units(name, properties(name))")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Supabase tenants read failed: ${error.message}`);
  return (data ?? []).map((r) => {
    const unit = r.units as UnitRel;
    return {
      id: s(r.id),
      name: s(r.name),
      icNumber: s(r.ic_number),
      email: s(r.email),
      phone: s(r.phone),
      previousAddress: s(r.previous_address),
      unit: s(unit?.name),
      property: s(unit?.properties?.name),
      leaseStart: s(r.lease_start),
      leaseEnd: s(r.lease_end),
      notes: s(r.notes),
    };
  });
}

export async function getRevenue(): Promise<RevenueRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("revenue")
    .select("*, properties(name), units(name)")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Supabase revenue read failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: s(r.id),
    name: "",
    property: s((r.properties as Rel)?.name),
    unit: s((r.units as Rel)?.name),
    year: n(r.year),
    month: n(r.month),
    rentalAmount: n(r.rental_amount),
    electricityUnits: n(r.electricity_units),
    electricityAmount: n(r.electricity_amount),
    otherCharges: n(r.other_charges_amount),
    totalAmount: n(r.total_amount),
    paymentDate: s(r.payment_date),
    paymentMethod: s(r.payment_method),
    paymentStatus: s(r.payment_status),
    invoiceGenerated: b(r.invoice_generated),
    invoiceNumber: s(r.invoice_number),
    invoiceSent: b(r.invoice_sent),
    invoiceSentAt: s(r.invoice_sent_at),
    notes: s(r.notes),
  }));
}

export async function getExpenses(): Promise<ExpenseRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("expenses")
    .select("*, properties(name), units(name)")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Supabase expenses read failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: s(r.id),
    name: "",
    property: s((r.properties as Rel)?.name),
    unit: s((r.units as Rel)?.name),
    year: n(r.year),
    month: n(r.month),
    expenseDate: s(r.expense_date),
    category: s(r.category),
    customCategory: s(r.custom_category),
    amount: n(r.amount),
    description: s(r.description),
    isRecurring: b(r.is_recurring),
    isIrregular: b(r.is_irregular),
    isFixed: b(r.is_fixed),
  }));
}

export async function getMaintenance(): Promise<MaintenanceRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("maintenance")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Supabase maintenance read failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: s(r.id),
    name: s(r.name),
    property: s(r.property),
    unit: s(r.unit),
    tenant: s(r.tenant),
    category: s(r.category),
    priority: s(r.priority),
    status: s(r.status),
    reportedDate: s(r.reported_date),
    dueDate: s(r.due_date),
    assignedTo: s(r.assigned_to),
    description: s(r.description),
  }));
}

// ------------------------- WRITE LAYER -------------------------
// Field objects arrive camelCase (see lib/dbSync.ts) with relations expressed as
// names. We map them to snake_case columns and resolve names to foreign keys.

type AnyFields = Record<string, unknown>;
const has = (f: AnyFields, k: string) => Object.prototype.hasOwnProperty.call(f, k);

// Columns whose empty string must become NULL (non-text column types).
const NULLABLE_NONTEXT = new Set([
  "rental_rate", "deposit_months", "deposit_amount", "electricity_free_units",
  "electricity_units", "electricity_amount", "other_charges_amount",
  "payment_date", "expense_date", "invoice_sent_at", "lease_start", "lease_end",
  "reported_date", "due_date", "year", "month",
]);

function put(out: Record<string, unknown>, col: string, value: unknown) {
  if ((value === "" || value === undefined) && NULLABLE_NONTEXT.has(col)) {
    out[col] = null;
    return;
  }
  out[col] = value;
}

// Map camelCase field -> column for direct (non-relation) fields.
function mapDirect(
  fields: AnyFields,
  map: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(map)) {
    if (has(fields, key)) put(out, col, fields[key]);
  }
  return out;
}

const PROPERTY_MAP: Record<string, string> = {
  name: "name", slug: "slug", shortName: "short_name", address: "address",
  city: "city", state: "state", postcode: "postcode", rentalModel: "rental_model",
  propertyType: "property_type", status: "status", imageUrl: "image_url",
  galleryUrls: "gallery_urls", shareUrl: "share_url", description: "description",
  totalUnits: "total_units", rentedUnits: "rented_units",
  ytdRevenue: "ytd_revenue", ytdExpenses: "ytd_expenses",
};

const UNIT_MAP: Record<string, string> = {
  name: "name", label: "label", sortOrder: "sort_order", isRented: "is_rented",
  tenantName: "tenant_name", rentalRate: "rental_rate",
  electricityFreeUnits: "electricity_free_units", depositMonths: "deposit_months",
  depositAmount: "deposit_amount", galleryUrls: "gallery_urls", shareUrl: "share_url",
};

const REVENUE_MAP: Record<string, string> = {
  year: "year", month: "month", rentalAmount: "rental_amount",
  electricityUnits: "electricity_units", electricityAmount: "electricity_amount",
  otherCharges: "other_charges_amount", totalAmount: "total_amount",
  paymentDate: "payment_date", paymentMethod: "payment_method",
  paymentStatus: "payment_status", invoiceGenerated: "invoice_generated",
  invoiceNumber: "invoice_number", invoiceSent: "invoice_sent",
  invoiceSentAt: "invoice_sent_at", notes: "notes",
};

const EXPENSE_MAP: Record<string, string> = {
  year: "year", month: "month", expenseDate: "expense_date", category: "category",
  customCategory: "custom_category", amount: "amount", description: "description",
  isRecurring: "is_recurring", isIrregular: "is_irregular", isFixed: "is_fixed",
};

const TENANT_MAP: Record<string, string> = {
  name: "name", icNumber: "ic_number", email: "email", phone: "phone",
  previousAddress: "previous_address", leaseStart: "lease_start",
  leaseEnd: "lease_end", notes: "notes",
};

const MAINTENANCE_MAP: Record<string, string> = {
  name: "name", property: "property", unit: "unit", tenant: "tenant",
  category: "category", priority: "priority", status: "status",
  reportedDate: "reported_date", dueDate: "due_date",
  assignedTo: "assigned_to", description: "description",
};

// ---- name -> id resolution ----
async function resolvePropertyId(name?: unknown): Promise<string | null> {
  const nm = s(name).trim();
  if (!nm) return null;
  const { data } = await supabaseAdmin()
    .from("properties").select("id").eq("name", nm).limit(1).maybeSingle();
  return data?.id ?? null;
}

async function resolveUnitId(
  propertyId: string | null,
  unitName?: unknown
): Promise<string | null> {
  const nm = s(unitName).trim();
  if (!nm) return null;
  let q = supabaseAdmin().from("units").select("id, name, label");
  if (propertyId) q = q.eq("property_id", propertyId);
  const { data } = await q;
  if (!data?.length) return null;
  const byName = data.find((u) => s(u.name) === nm);
  if (byName) return byName.id;
  const byLabel = data.find((u) => s(u.label) === nm);
  return byLabel?.id ?? null;
}

// Build the column payload for an entity, resolving relation names to ids.
async function buildColumns(entity: Entity, fields: AnyFields): Promise<Record<string, unknown>> {
  switch (entity) {
    case "properties":
      return mapDirect(fields, PROPERTY_MAP);
    case "units": {
      const out = mapDirect(fields, UNIT_MAP);
      if (has(fields, "property")) out.property_id = await resolvePropertyId(fields.property);
      return out;
    }
    case "revenue": {
      const out = mapDirect(fields, REVENUE_MAP);
      if (has(fields, "property") || has(fields, "unit")) {
        const propertyId = await resolvePropertyId(fields.property);
        out.property_id = propertyId;
        out.unit_id = await resolveUnitId(propertyId, fields.unit);
      }
      return out;
    }
    case "expenses": {
      const out = mapDirect(fields, EXPENSE_MAP);
      if (has(fields, "property") || has(fields, "unit")) {
        const propertyId = await resolvePropertyId(fields.property);
        out.property_id = propertyId;
        out.unit_id = await resolveUnitId(propertyId, fields.unit);
      }
      return out;
    }
    case "tenants": {
      const out = mapDirect(fields, TENANT_MAP);
      if (has(fields, "unit") || has(fields, "property")) {
        const propertyId = await resolvePropertyId(fields.property);
        out.unit_id = await resolveUnitId(propertyId, fields.unit);
      }
      return out;
    }
    case "maintenance":
      return mapDirect(fields, MAINTENANCE_MAP);
    default:
      throw new Error(`Unknown entity "${entity}"`);
  }
}

export async function createEntity(entity: Entity, fields: AnyFields): Promise<string> {
  const columns = await buildColumns(entity, fields);
  const { data, error } = await supabaseAdmin()
    .from(entity).insert(columns).select("id").single();
  if (error) throw new Error(`Supabase ${entity} create failed: ${error.message}`);
  return data.id as string;
}

export async function updateEntity(entity: Entity, id: string, fields: AnyFields): Promise<void> {
  const columns = await buildColumns(entity, fields);
  if (Object.keys(columns).length === 0) return;
  const { error } = await supabaseAdmin().from(entity).update(columns).eq("id", id);
  if (error) throw new Error(`Supabase ${entity} update failed: ${error.message}`);
}

export async function deleteEntity(entity: Entity, id: string): Promise<void> {
  const { error } = await supabaseAdmin().from(entity).delete().eq("id", id);
  if (error) throw new Error(`Supabase ${entity} delete failed: ${error.message}`);
}

// ------------------------- IMAGE STORAGE -------------------------
// Cover + gallery images live in the public `property-images` bucket. Unlike the
// previous Notion-hosted files (now Supabase Storage), the returned public URLs are stable, so they are
// persisted directly into the properties.image_url / gallery_urls columns.

function extOf(filename: string, contentType: string): string {
  const fromName = filename.includes(".") ? filename.split(".").pop()! : "";
  if (fromName) return fromName.toLowerCase();
  const fromType = contentType.split("/")[1] || "jpg";
  return fromType.toLowerCase();
}

async function uploadToBucket(
  path: string,
  bytes: ArrayBuffer | Uint8Array,
  contentType: string
): Promise<string> {
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const { error } = await supabaseAdmin()
    .storage.from(IMAGE_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Supabase image upload failed: ${error.message}`);
  const { data } = supabaseAdmin().storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload a cover image for a property, persist it to image_url, return the URL. */
export async function uploadPropertyCover(
  propertyId: string,
  bytes: ArrayBuffer | Uint8Array,
  filename: string,
  contentType: string
): Promise<string> {
  const path = `${propertyId}/cover-${Date.now()}.${extOf(filename, contentType)}`;
  const url = await uploadToBucket(path, bytes, contentType);
  const { error } = await supabaseAdmin()
    .from("properties").update({ image_url: url }).eq("id", propertyId);
  if (error) throw new Error(`Supabase cover persist failed: ${error.message}`);
  return url;
}

// An ordered gallery entry: a pasted external URL or an uploaded image.
export type GalleryItemSpec =
  | { type: "external"; url: string }
  | { type: "upload"; bytes: ArrayBuffer; filename: string; contentType: string };

/** Persist an ordered gallery (uploads + URLs) to a property's gallery_urls
 *  column (newline separated). Returns the resolved URLs in order. */
export async function setPropertyGallery(
  propertyId: string,
  items: GalleryItemSpec[]
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    if (it.type === "external") {
      if (it.url) urls.push(it.url);
      continue;
    }
    const path = `${propertyId}/gallery-${Date.now()}-${i}.${extOf(it.filename, it.contentType)}`;
    urls.push(await uploadToBucket(path, it.bytes, it.contentType));
  }
  const { error } = await supabaseAdmin()
    .from("properties").update({ gallery_urls: urls.join("\n") }).eq("id", propertyId);
  if (error) throw new Error(`Supabase gallery persist failed: ${error.message}`);
  return urls;
}
