// Server-only Notion data layer. Reads NOTION_API_KEY + NOTION_DB_* from env.

const NOTION_API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

type NotionFile =
  | { type: "file"; file: { url: string; expiry_time?: string } }
  | { type: "external"; external: { url: string } }
  | { type: "file_upload"; file_upload: { id: string } };

type NotionPage = {
  id: string;
  properties: Record<string, NotionProp>;
  /** Page cover. For uploaded images this is a Notion-hosted file whose `url`
   *  is a short-lived signed URL — always read fresh, never cache. */
  cover?: NotionFile | null;
};

/** Resolve a displayable URL from a page cover, or "" when there is none. */
function coverUrl(page: NotionPage): string {
  const c = page.cover;
  if (!c) return "";
  if (c.type === "file") return c.file.url ?? "";
  if (c.type === "external") return c.external.url ?? "";
  return "";
}

type NotionProp =
  | { type: "title"; title: Array<{ plain_text: string }> }
  | { type: "rich_text"; rich_text: Array<{ plain_text: string }> }
  | { type: "number"; number: number | null }
  | { type: "select"; select: { name: string } | null }
  | { type: "checkbox"; checkbox: boolean }
  | { type: "url"; url: string | null }
  | { type: "email"; email: string | null }
  | { type: "phone_number"; phone_number: string | null }
  | {
      type: "files";
      files: Array<{
        name?: string;
        type?: string;
        file?: { url: string; expiry_time?: string };
        external?: { url: string };
      }>;
    }
  | { type: "date"; date: { start: string | null; end: string | null } | null };

function headers() {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error("NOTION_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Notion-Version": VERSION,
    "Content-Type": "application/json",
  };
}

export const DB_IDS = {
  properties: process.env.NOTION_DB_PROPERTIES!,
  units: process.env.NOTION_DB_UNITS!,
  tenants: process.env.NOTION_DB_TENANTS!,
  revenue: process.env.NOTION_DB_REVENUE!,
  expenses: process.env.NOTION_DB_EXPENSES!,
  maintenance: process.env.NOTION_DB_MAINTENANCE!,
};

export type Entity = keyof typeof DB_IDS;

async function queryAll(databaseId: string): Promise<NotionPage[]> {
  const results: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const r = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      // Revalidate every 30s so dashboard doesn't hammer Notion
      next: { revalidate: 30 },
    });
    if (!r.ok) {
      throw new Error(`Notion query failed: ${r.status} ${await r.text()}`);
    }
    const data = (await r.json()) as {
      results: NotionPage[];
      has_more: boolean;
      next_cursor: string | null;
    };
    results.push(...data.results);
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

// ---- property accessors ----
function txt(p?: NotionProp): string {
  if (!p) return "";
  if (p.type === "title") return p.title.map((t) => t.plain_text).join("");
  if (p.type === "rich_text") return p.rich_text.map((t) => t.plain_text).join("");
  if (p.type === "url") return p.url ?? "";
  if (p.type === "email") return p.email ?? "";
  if (p.type === "phone_number") return p.phone_number ?? "";
  if (p.type === "select") return p.select?.name ?? "";
  return "";
}
function num(p?: NotionProp): number {
  if (!p || p.type !== "number") return 0;
  return p.number ?? 0;
}
function bool(p?: NotionProp): boolean {
  return p?.type === "checkbox" ? p.checkbox : false;
}
function dateStr(p?: NotionProp): string {
  if (!p || p.type !== "date" || !p.date) return "";
  return p.date.start ?? "";
}
/** Resolve every URL held by a Notion `files` property, in order. Uploaded
 *  files carry a short-lived signed URL (read fresh each load); external items
 *  carry the pasted URL. */
function filesUrls(p?: NotionProp): string[] {
  if (!p || p.type !== "files") return [];
  return p.files
    .map((f) => f.file?.url ?? f.external?.url ?? "")
    .filter((u) => !!u);
}

// ---- typed rows ----
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
  /** Optional newline/comma-separated extra photo URLs. Reads a "Gallery URLs"
   *  rich-text property if present; empty until that schema field is added. */
  galleryUrls: string;
  /** Owner-pasted external share link. Reads a "Share URL" property if present;
   *  empty until that schema field is added. */
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
  /** Optional per-room photo URLs (newline/comma separated). Reads a "Gallery
   *  URLs" rich-text property if present; empty until that field is added. */
  galleryUrls: string;
  /** Owner-pasted external share link for this room. Reads a "Share URL"
   *  property if present; empty until that schema field is added. */
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
};

export async function getProperties(): Promise<PropertyRow[]> {
  const rows = await queryAll(DB_IDS.properties);
  return rows.map((r) => ({
    id: r.id,
    name: txt(r.properties["Name"]),
    slug: txt(r.properties["Slug"]),
    shortName: txt(r.properties["Short Name"]),
    address: txt(r.properties["Address"]),
    city: txt(r.properties["City"]),
    state: txt(r.properties["State"]),
    postcode: txt(r.properties["Postcode"]),
    rentalModel: txt(r.properties["Rental Model"]),
    propertyType: txt(r.properties["Property Type"]),
    status: txt(r.properties["Status"]),
    // An uploaded cover lives as the page cover (fresh signed URL each load) and
    // takes precedence; pasted-URL covers fall back to the "Image URL" property.
    imageUrl: coverUrl(r) || txt(r.properties["Image URL"]),
    // Gallery is the ordered "Gallery" files property (uploads + URL items, with
    // fresh signed URLs); falls back to the legacy "Gallery URLs" text field.
    galleryUrls: (() => {
      const fromFiles = filesUrls(r.properties["Gallery"]);
      return fromFiles.length ? fromFiles.join("\n") : txt(r.properties["Gallery URLs"]);
    })(),
    shareUrl: txt(r.properties["Share URL"]),
    description: txt(r.properties["Description"]),
    totalUnits: num(r.properties["Total Units"]),
    rentedUnits: num(r.properties["Rented Units"]),
    ytdRevenue: num(r.properties["YTD Revenue"]),
    ytdExpenses: num(r.properties["YTD Expenses"]),
  }));
}

export async function getUnits(): Promise<UnitRow[]> {
  const rows = await queryAll(DB_IDS.units);
  return rows.map((r) => ({
    id: r.id,
    name: txt(r.properties["Name"]),
    property: txt(r.properties["Property"]),
    label: txt(r.properties["Label"]),
    sortOrder: num(r.properties["Sort Order"]),
    isRented: bool(r.properties["Is Rented"]),
    tenantName: txt(r.properties["Tenant Name"]),
    rentalRate: num(r.properties["Rental Rate"]),
    electricityFreeUnits: num(r.properties["Electricity Free Units"]),
    galleryUrls: txt(r.properties["Gallery URLs"]),
    shareUrl: txt(r.properties["Share URL"]),
  }));
}

export async function getTenants(): Promise<TenantRow[]> {
  const rows = await queryAll(DB_IDS.tenants);
  return rows.map((r) => ({
    id: r.id,
    name: txt(r.properties["Name"]),
    icNumber: txt(r.properties["IC Number"]),
    email: txt(r.properties["Email"]),
    phone: txt(r.properties["Phone"]),
    previousAddress: txt(r.properties["Previous Address"]),
    unit: txt(r.properties["Unit"]),
    property: txt(r.properties["Property"]),
    leaseStart: dateStr(r.properties["Lease Start"]),
    leaseEnd: dateStr(r.properties["Lease End"]),
    notes: txt(r.properties["Notes"]),
  }));
}

export async function getRevenue(): Promise<RevenueRow[]> {
  const rows = await queryAll(DB_IDS.revenue);
  return rows.map((r) => ({
    id: r.id,
    name: txt(r.properties["Name"]),
    property: txt(r.properties["Property"]),
    unit: txt(r.properties["Unit"]),
    year: num(r.properties["Year"]),
    month: num(r.properties["Month"]),
    rentalAmount: num(r.properties["Rental Amount"]),
    electricityUnits: num(r.properties["Electricity Units"]),
    electricityAmount: num(r.properties["Electricity Amount"]),
    otherCharges: num(r.properties["Other Charges"]),
    totalAmount: num(r.properties["Total Amount"]),
    paymentDate: dateStr(r.properties["Payment Date"]),
    paymentMethod: txt(r.properties["Payment Method"]),
    paymentStatus: txt(r.properties["Payment Status"]),
    invoiceGenerated: bool(r.properties["Invoice Generated"]),
    invoiceNumber: txt(r.properties["Invoice Number"]),
    invoiceSent: bool(r.properties["Invoice Sent"]),
    invoiceSentAt: dateStr(r.properties["Invoice Sent At"]),
    notes: txt(r.properties["Notes"]),
  }));
}

export async function getExpenses(): Promise<ExpenseRow[]> {
  const rows = await queryAll(DB_IDS.expenses);
  return rows.map((r) => ({
    id: r.id,
    name: txt(r.properties["Name"]),
    property: txt(r.properties["Property"]),
    unit: txt(r.properties["Unit"]),
    year: num(r.properties["Year"]),
    month: num(r.properties["Month"]),
    expenseDate: dateStr(r.properties["Expense Date"]),
    category: txt(r.properties["Category"]),
    customCategory: txt(r.properties["Custom Category"]),
    amount: num(r.properties["Amount"]),
    description: txt(r.properties["Description"]),
    isRecurring: bool(r.properties["Is Recurring"]),
    isIrregular: bool(r.properties["Is Irregular"]),
  }));
}

export async function getMaintenance(): Promise<MaintenanceRow[]> {
  const rows = await queryAll(DB_IDS.maintenance);
  return rows.map(mapMaintenanceRow);
}

function mapMaintenanceRow(r: NotionPage): MaintenanceRow {
  return {
    id: r.id,
    name: txt(r.properties["Name"]),
    property: txt(r.properties["Property"]),
    unit: txt(r.properties["Unit"]),
    tenant: txt(r.properties["Tenant"]),
    category: txt(r.properties["Category"]),
    priority: txt(r.properties["Priority"]),
    status: txt(r.properties["Status"]),
    reportedDate: dateStr(r.properties["Reported Date"]),
    dueDate: dateStr(r.properties["Due Date"]),
    assignedTo: txt(r.properties["Assigned To"]),
    description: txt(r.properties["Description"]),
  };
}

// ------------------------- WRITE LAYER -------------------------
// All inter-database links in this workspace are stored as plain
// rich_text names (not Notion relations), so writes only build text /
// number / select / date / checkbox property payloads.

type PropValue =
  | { title: Array<{ text: { content: string } }> }
  | { rich_text: Array<{ text: { content: string } }> }
  | { number: number | null }
  | { select: { name: string } | null }
  | { checkbox: boolean }
  | { url: string | null }
  | { email: string | null }
  | { phone_number: string | null }
  | { date: { start: string } | null };

function pTitle(v: string): PropValue {
  return { title: [{ text: { content: v || "Untitled" } }] };
}
function pText(v: string | null | undefined): PropValue {
  return { rich_text: v ? [{ text: { content: v } }] : [] };
}
function pNum(v: number | null | undefined): PropValue {
  return { number: v == null || Number.isNaN(v) ? null : v };
}
function pSelect(v: string | null | undefined): PropValue {
  return { select: v ? { name: v } : null };
}
function pCheck(v: boolean): PropValue {
  return { checkbox: !!v };
}
function pDate(v: string | null | undefined): PropValue {
  return { date: v ? { start: v } : null };
}
function pUrl(v: string | null | undefined): PropValue {
  return { url: v || null };
}

const schemaCache = new Map<string, Promise<Set<string>>>();

async function getDbPropertyNames(databaseId: string): Promise<Set<string>> {
  let p = schemaCache.get(databaseId);
  if (!p) {
    p = (async () => {
      const r = await fetch(`${NOTION_API}/databases/${databaseId}`, {
        method: "GET",
        headers: headers(),
      });
      if (!r.ok) throw new Error(`Notion db retrieve failed: ${r.status} ${await r.text()}`);
      const data = (await r.json()) as { properties: Record<string, unknown> };
      return new Set(Object.keys(data.properties || {}));
    })();
    schemaCache.set(databaseId, p);
    p.catch(() => schemaCache.delete(databaseId));
  }
  return p;
}

function filterByPageProps(
  properties: Record<string, PropValue>,
  existing: Set<string>
): Record<string, PropValue> {
  const out: Record<string, PropValue> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (existing.has(k)) out[k] = v;
  }
  return out;
}

async function getPageDatabaseId(pageId: string): Promise<string | null> {
  const r = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "GET",
    headers: headers(),
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { parent?: { database_id?: string } };
  return data.parent?.database_id ?? null;
}

async function createPage(
  databaseId: string,
  properties: Record<string, PropValue>
): Promise<string> {
  const existing = await getDbPropertyNames(databaseId);
  const filtered = filterByPageProps(properties, existing);
  const r = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ parent: { database_id: databaseId }, properties: filtered }),
  });
  if (!r.ok) throw new Error(`Notion create failed: ${r.status} ${await r.text()}`);
  const data = (await r.json()) as { id: string };
  return data.id;
}

async function updatePage(
  pageId: string,
  properties: Record<string, PropValue>,
  databaseId?: string
): Promise<void> {
  const dbId = databaseId ?? (await getPageDatabaseId(pageId));
  const payload = dbId
    ? filterByPageProps(properties, await getDbPropertyNames(dbId))
    : properties;
  const r = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ properties: payload }),
  });
  if (!r.ok) throw new Error(`Notion update failed: ${r.status} ${await r.text()}`);
}

async function archivePage(pageId: string): Promise<void> {
  const r = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ archived: true }),
  });
  if (!r.ok) throw new Error(`Notion archive failed: ${r.status} ${await r.text()}`);
}

// ---- per-entity property builders (partial-aware) ----
type AnyFields = Record<string, unknown>;

function has(f: AnyFields, k: string) {
  return Object.prototype.hasOwnProperty.call(f, k);
}

function buildMaintenanceProps(f: AnyFields): Record<string, PropValue> {
  const p: Record<string, PropValue> = {};
  if (has(f, "name")) p["Name"] = pTitle(String(f.name ?? ""));
  if (has(f, "property")) p["Property"] = pText(f.property as string);
  if (has(f, "unit")) p["Unit"] = pText(f.unit as string);
  if (has(f, "tenant")) p["Tenant"] = pText(f.tenant as string);
  if (has(f, "category")) p["Category"] = pSelect(f.category as string);
  if (has(f, "priority")) p["Priority"] = pSelect(f.priority as string);
  if (has(f, "status")) p["Status"] = pSelect(f.status as string);
  if (has(f, "reportedDate")) p["Reported Date"] = pDate(f.reportedDate as string);
  if (has(f, "dueDate")) p["Due Date"] = pDate(f.dueDate as string);
  if (has(f, "assignedTo")) p["Assigned To"] = pText(f.assignedTo as string);
  if (has(f, "description")) p["Description"] = pText(f.description as string);
  return p;
}

function buildRevenueProps(f: AnyFields): Record<string, PropValue> {
  const p: Record<string, PropValue> = {};
  if (has(f, "name")) p["Name"] = pTitle(String(f.name ?? ""));
  if (has(f, "property")) p["Property"] = pText(f.property as string);
  if (has(f, "unit")) p["Unit"] = pText(f.unit as string);
  if (has(f, "year")) p["Year"] = pNum(f.year as number);
  if (has(f, "month")) p["Month"] = pNum(f.month as number);
  if (has(f, "rentalAmount")) p["Rental Amount"] = pNum(f.rentalAmount as number);
  if (has(f, "electricityUnits")) p["Electricity Units"] = pNum(f.electricityUnits as number);
  if (has(f, "electricityAmount")) p["Electricity Amount"] = pNum(f.electricityAmount as number);
  if (has(f, "otherCharges")) p["Other Charges"] = pNum(f.otherCharges as number);
  if (has(f, "totalAmount")) p["Total Amount"] = pNum(f.totalAmount as number);
  if (has(f, "paymentDate")) p["Payment Date"] = pDate(f.paymentDate as string);
  if (has(f, "paymentMethod")) p["Payment Method"] = pSelect(f.paymentMethod as string);
  if (has(f, "paymentStatus")) p["Payment Status"] = pSelect(f.paymentStatus as string);
  if (has(f, "invoiceGenerated")) p["Invoice Generated"] = pCheck(!!f.invoiceGenerated);
  if (has(f, "invoiceNumber")) p["Invoice Number"] = pText(f.invoiceNumber as string);
  if (has(f, "invoiceSent")) p["Invoice Sent"] = pCheck(!!f.invoiceSent);
  if (has(f, "invoiceSentAt")) p["Invoice Sent At"] = pDate(f.invoiceSentAt as string);
  if (has(f, "notes")) p["Notes"] = pText(f.notes as string);
  return p;
}

function buildPropertyProps(f: AnyFields): Record<string, PropValue> {
  const p: Record<string, PropValue> = {};
  if (has(f, "name")) p["Name"] = pTitle(String(f.name ?? ""));
  if (has(f, "slug")) p["Slug"] = pText(f.slug as string);
  if (has(f, "shortName")) p["Short Name"] = pText(f.shortName as string);
  if (has(f, "address")) p["Address"] = pText(f.address as string);
  if (has(f, "city")) p["City"] = pText(f.city as string);
  if (has(f, "state")) p["State"] = pText(f.state as string);
  if (has(f, "postcode")) p["Postcode"] = pText(f.postcode as string);
  if (has(f, "rentalModel")) p["Rental Model"] = pSelect(f.rentalModel as string);
  if (has(f, "propertyType")) p["Property Type"] = pSelect(f.propertyType as string);
  if (has(f, "status")) p["Status"] = pSelect(f.status as string);
  if (has(f, "imageUrl")) p["Image URL"] = pUrl(f.imageUrl as string);
  if (has(f, "galleryUrls")) p["Gallery URLs"] = pText(f.galleryUrls as string);
  if (has(f, "shareUrl")) p["Share URL"] = pUrl(f.shareUrl as string);
  if (has(f, "description")) p["Description"] = pText(f.description as string);
  if (has(f, "totalUnits")) p["Total Units"] = pNum(f.totalUnits as number);
  if (has(f, "rentedUnits")) p["Rented Units"] = pNum(f.rentedUnits as number);
  if (has(f, "ytdRevenue")) p["YTD Revenue"] = pNum(f.ytdRevenue as number);
  if (has(f, "ytdExpenses")) p["YTD Expenses"] = pNum(f.ytdExpenses as number);
  return p;
}

function buildUnitProps(f: AnyFields): Record<string, PropValue> {
  const p: Record<string, PropValue> = {};
  if (has(f, "name")) p["Name"] = pTitle(String(f.name ?? ""));
  if (has(f, "property")) p["Property"] = pText(f.property as string);
  if (has(f, "label")) p["Label"] = pText(f.label as string);
  if (has(f, "sortOrder")) p["Sort Order"] = pNum(f.sortOrder as number);
  if (has(f, "isRented")) p["Is Rented"] = pCheck(!!f.isRented);
  if (has(f, "tenantName")) p["Tenant Name"] = pText(f.tenantName as string);
  if (has(f, "rentalRate")) p["Rental Rate"] = pNum(f.rentalRate as number);
  if (has(f, "electricityFreeUnits")) p["Electricity Free Units"] = pNum(f.electricityFreeUnits as number);
  if (has(f, "galleryUrls")) p["Gallery URLs"] = pText(f.galleryUrls as string);
  if (has(f, "shareUrl")) p["Share URL"] = pUrl(f.shareUrl as string);
  return p;
}

function buildExpenseProps(f: AnyFields): Record<string, PropValue> {
  const p: Record<string, PropValue> = {};
  if (has(f, "name")) p["Name"] = pTitle(String(f.name ?? ""));
  if (has(f, "property")) p["Property"] = pText(f.property as string);
  if (has(f, "unit")) p["Unit"] = pText(f.unit as string);
  if (has(f, "year")) p["Year"] = pNum(f.year as number);
  if (has(f, "month")) p["Month"] = pNum(f.month as number);
  if (has(f, "expenseDate")) p["Expense Date"] = pDate(f.expenseDate as string);
  if (has(f, "category")) p["Category"] = pSelect(f.category as string);
  if (has(f, "customCategory")) p["Custom Category"] = pText(f.customCategory as string);
  if (has(f, "amount")) p["Amount"] = pNum(f.amount as number);
  if (has(f, "description")) p["Description"] = pText(f.description as string);
  if (has(f, "isRecurring")) p["Is Recurring"] = pCheck(!!f.isRecurring);
  if (has(f, "isIrregular")) p["Is Irregular"] = pCheck(!!f.isIrregular);
  return p;
}

function buildTenantProps(f: AnyFields): Record<string, PropValue> {
  const p: Record<string, PropValue> = {};
  if (has(f, "name")) p["Name"] = pTitle(String(f.name ?? ""));
  if (has(f, "icNumber")) p["IC Number"] = pText(f.icNumber as string);
  if (has(f, "email")) p["Email"] = emailProp(f.email as string);
  if (has(f, "phone")) p["Phone"] = phoneProp(f.phone as string);
  if (has(f, "previousAddress")) p["Previous Address"] = pText(f.previousAddress as string);
  if (has(f, "unit")) p["Unit"] = pText(f.unit as string);
  if (has(f, "property")) p["Property"] = pText(f.property as string);
  if (has(f, "leaseStart")) p["Lease Start"] = pDate(f.leaseStart as string);
  if (has(f, "leaseEnd")) p["Lease End"] = pDate(f.leaseEnd as string);
  if (has(f, "notes")) p["Notes"] = pText(f.notes as string);
  return p;
}

function emailProp(v: string | null | undefined): PropValue {
  return { email: v || null } as unknown as PropValue;
}
function phoneProp(v: string | null | undefined): PropValue {
  return { phone_number: v || null } as unknown as PropValue;
}

const BUILDERS: Record<string, (f: AnyFields) => Record<string, PropValue>> = {
  properties: buildPropertyProps,
  units: buildUnitProps,
  maintenance: buildMaintenanceProps,
  revenue: buildRevenueProps,
  expenses: buildExpenseProps,
  tenants: buildTenantProps,
};

export async function createEntity(entity: Entity, fields: AnyFields): Promise<string> {
  const builder = BUILDERS[entity];
  if (!builder) throw new Error(`No write builder for entity "${entity}"`);
  return createPage(DB_IDS[entity], builder(fields));
}

export async function updateEntity(entity: Entity, id: string, fields: AnyFields): Promise<void> {
  const builder = BUILDERS[entity];
  if (!builder) throw new Error(`No write builder for entity "${entity}"`);
  await updatePage(id, builder(fields), DB_IDS[entity]);
}

export async function deleteEntity(id: string): Promise<void> {
  await archivePage(id);
}

// ------------------------- IMAGE UPLOAD (page cover) -------------------------
// Uploaded cover images are stored via Notion's File Upload API and attached as
// the property page's *cover* (a page attribute, not a DB property — so no
// schema change). Notion returns a fresh, short-lived signed URL each time the
// page is read; getProperties() reads it via coverUrl() on every load.

/** Auth headers WITHOUT a JSON content-type, for the multipart upload step. */
function authHeaders(): Record<string, string> {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error("NOTION_API_KEY is not set");
  return { Authorization: `Bearer ${key}`, "Notion-Version": VERSION };
}

/** Step 1: create a single-part file upload, returns its id + upload URL. */
async function createFileUpload(
  filename: string,
  contentType: string
): Promise<{ id: string; uploadUrl: string }> {
  const r = await fetch(`${NOTION_API}/file_uploads`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ mode: "single_part", filename, content_type: contentType }),
  });
  if (!r.ok) throw new Error(`Notion file upload create failed: ${r.status} ${await r.text()}`);
  const data = (await r.json()) as { id: string; upload_url: string };
  return { id: data.id, uploadUrl: data.upload_url };
}

/** Step 2: send the binary to the upload URL as multipart/form-data. */
async function sendFileUpload(
  uploadUrl: string,
  bytes: ArrayBuffer | Uint8Array,
  filename: string,
  contentType: string
): Promise<void> {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: contentType }), filename);
  // No Content-Type header — fetch sets the multipart boundary itself.
  const r = await fetch(uploadUrl, { method: "POST", headers: authHeaders(), body: form });
  if (!r.ok) throw new Error(`Notion file upload send failed: ${r.status} ${await r.text()}`);
}

/** Step 3: attach the uploaded file as the page cover; returns the fresh URL. */
async function attachPageCover(pageId: string, fileUploadId: string): Promise<string> {
  const r = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ cover: { type: "file_upload", file_upload: { id: fileUploadId } } }),
  });
  if (!r.ok) throw new Error(`Notion set cover failed: ${r.status} ${await r.text()}`);
  const data = (await r.json()) as NotionPage;
  return coverUrl(data);
}

/**
 * Upload an image and set it as `pageId`'s cover. Returns a display-ready
 * (short-lived) URL for immediate use this session; subsequent dashboard loads
 * re-read a fresh URL from the page cover.
 */
export async function uploadPageCover(
  pageId: string,
  bytes: ArrayBuffer | Uint8Array,
  filename: string,
  contentType: string
): Promise<string> {
  const { id, uploadUrl } = await createFileUpload(filename, contentType);
  await sendFileUpload(uploadUrl, bytes, filename, contentType);
  return attachPageCover(pageId, id);
}

/** Upload a binary to Notion and return its file_upload id (not yet attached). */
export async function uploadFile(
  bytes: ArrayBuffer | Uint8Array,
  filename: string,
  contentType: string
): Promise<string> {
  const { id, uploadUrl } = await createFileUpload(filename, contentType);
  await sendFileUpload(uploadUrl, bytes, filename, contentType);
  return id;
}

// An ordered gallery entry: either a pasted URL or an already-uploaded file.
export type GalleryItemSpec =
  | { type: "external"; url: string }
  | { type: "file_upload"; id: string };

/**
 * Write the ordered gallery into the page's "Gallery" files property (uploads +
 * URL items in one ordered list). Returns the resolved URLs in order.
 */
export async function setPageGallery(
  pageId: string,
  items: GalleryItemSpec[]
): Promise<string[]> {
  const files = items.map((it, i) =>
    it.type === "external"
      ? { type: "external", name: `Photo ${i + 1}`, external: { url: it.url } }
      : { type: "file_upload", file_upload: { id: it.id } }
  );
  const r = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ properties: { Gallery: { files } } }),
  });
  if (!r.ok) throw new Error(`Notion set gallery failed: ${r.status} ${await r.text()}`);
  const data = (await r.json()) as NotionPage;
  return filesUrls(data.properties["Gallery"]);
}
