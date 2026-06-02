// Server-only Notion data layer. Reads NOTION_API_KEY + NOTION_DB_* from env.

const NOTION_API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

type NotionPage = {
  id: string;
  properties: Record<string, NotionProp>;
};

type NotionProp =
  | { type: "title"; title: Array<{ plain_text: string }> }
  | { type: "rich_text"; rich_text: Array<{ plain_text: string }> }
  | { type: "number"; number: number | null }
  | { type: "select"; select: { name: string } | null }
  | { type: "checkbox"; checkbox: boolean }
  | { type: "url"; url: string | null }
  | { type: "email"; email: string | null }
  | { type: "phone_number"; phone_number: string | null }
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
  notes: string;
};

export type ExpenseRow = {
  id: string;
  name: string;
  property: string;
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
    imageUrl: txt(r.properties["Image URL"]),
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
    notes: txt(r.properties["Notes"]),
  }));
}

export async function getExpenses(): Promise<ExpenseRow[]> {
  const rows = await queryAll(DB_IDS.expenses);
  return rows.map((r) => ({
    id: r.id,
    name: txt(r.properties["Name"]),
    property: txt(r.properties["Property"]),
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
