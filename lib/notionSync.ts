// Maps the app's snake_case domain entities to the camelCase field objects
// the /api/notion write route expects. Inter-db links are stored as names,
// so callers pass resolved property / unit names alongside the patch.

import { MONTHS } from "@/types/rental";
import type { ExpenseEntry, Property, RevenueEntry, Tenant, Unit } from "@/types/rental";

type Names = { property?: string; unit?: string };

function periodLabel(year?: number, month?: number) {
  const m = month && month >= 1 && month <= 12 ? MONTHS[month - 1] : "";
  return [m, year].filter(Boolean).join(" ");
}

export function propertyCreateFields(p: Property) {
  return {
    name: p.name,
    slug: p.slug,
    shortName: p.short_name,
    address: p.address,
    city: p.city,
    state: p.state,
    postcode: p.postcode,
    rentalModel: p.rental_model,
    propertyType: p.property_type,
    status: p.status,
    imageUrl: p.image_url ?? null,
    description: p.description ?? null,
    totalUnits: p.total_units,
    rentedUnits: p.rented_units,
    ytdRevenue: p.ytd_revenue ?? 0,
    ytdExpenses: p.ytd_expenses ?? 0,
  };
}

export function propertyPatchFields(patch: Partial<Property>) {
  const f: Record<string, unknown> = {};
  if ("name" in patch) f.name = patch.name;
  if ("slug" in patch) f.slug = patch.slug;
  if ("short_name" in patch) f.shortName = patch.short_name;
  if ("address" in patch) f.address = patch.address;
  if ("city" in patch) f.city = patch.city;
  if ("state" in patch) f.state = patch.state;
  if ("postcode" in patch) f.postcode = patch.postcode;
  if ("rental_model" in patch) f.rentalModel = patch.rental_model;
  if ("property_type" in patch) f.propertyType = patch.property_type;
  if ("status" in patch) f.status = patch.status;
  if ("image_url" in patch) f.imageUrl = patch.image_url ?? null;
  if ("description" in patch) f.description = patch.description ?? null;
  if ("total_units" in patch) f.totalUnits = patch.total_units;
  if ("rented_units" in patch) f.rentedUnits = patch.rented_units;
  if ("ytd_revenue" in patch) f.ytdRevenue = patch.ytd_revenue;
  if ("ytd_expenses" in patch) f.ytdExpenses = patch.ytd_expenses;
  return f;
}

export function unitCreateFields(u: Unit, names: Names) {
  return {
    name: u.name,
    property: names.property ?? "",
    label: u.label,
    sortOrder: u.sort_order,
    isRented: !!u.is_rented,
    tenantName: u.tenant_name ?? null,
    rentalRate: u.rental_rate ?? null,
    electricityFreeUnits: u.electricity_free_units,
  };
}

export function unitPatchFields(patch: Partial<Unit>, names: Names) {
  const f: Record<string, unknown> = {};
  if ("name" in patch) f.name = patch.name;
  if ("property_id" in patch) f.property = names.property ?? "";
  if ("label" in patch) f.label = patch.label;
  if ("sort_order" in patch) f.sortOrder = patch.sort_order;
  if ("is_rented" in patch) f.isRented = !!patch.is_rented;
  if ("tenant_name" in patch) f.tenantName = patch.tenant_name ?? null;
  if ("rental_rate" in patch) f.rentalRate = patch.rental_rate ?? null;
  if ("electricity_free_units" in patch) f.electricityFreeUnits = patch.electricity_free_units;
  return f;
}

export function revenueCreateFields(e: RevenueEntry, names: Names) {
  return {
    name: `${names.property ?? "Revenue"}${names.unit ? ` - ${names.unit}` : ""} - ${periodLabel(e.year, e.month)}`.trim(),
    property: names.property ?? "",
    unit: names.unit ?? "",
    year: e.year,
    month: e.month,
    rentalAmount: e.rental_amount,
    electricityUnits: e.electricity_units ?? null,
    electricityAmount: e.electricity_amount ?? null,
    otherCharges: e.other_charges_amount ?? null,
    totalAmount: e.total_amount,
    paymentDate: e.payment_date ?? null,
    paymentMethod: e.payment_method ?? null,
    paymentStatus: e.payment_status ?? null,
    invoiceGenerated: !!e.invoice_generated,
    invoiceNumber: e.invoice_number ?? null,
    invoiceSent: !!e.invoice_sent,
    invoiceSentAt: e.invoice_sent_at ?? null,
    notes: e.notes ?? null,
  };
}

export function revenuePatchFields(patch: Partial<RevenueEntry>, names: Names) {
  const f: Record<string, unknown> = {};
  if ("property_id" in patch) f.property = names.property ?? "";
  if ("unit_id" in patch) f.unit = names.unit ?? "";
  if ("year" in patch) f.year = patch.year;
  if ("month" in patch) f.month = patch.month;
  if ("rental_amount" in patch) f.rentalAmount = patch.rental_amount;
  if ("electricity_units" in patch) f.electricityUnits = patch.electricity_units ?? null;
  if ("electricity_amount" in patch) f.electricityAmount = patch.electricity_amount ?? null;
  if ("other_charges_amount" in patch) f.otherCharges = patch.other_charges_amount ?? null;
  if ("total_amount" in patch) f.totalAmount = patch.total_amount;
  if ("payment_date" in patch) f.paymentDate = patch.payment_date ?? null;
  if ("payment_method" in patch) f.paymentMethod = patch.payment_method ?? null;
  if ("payment_status" in patch) f.paymentStatus = patch.payment_status ?? null;
  if ("invoice_generated" in patch) f.invoiceGenerated = !!patch.invoice_generated;
  if ("invoice_number" in patch) f.invoiceNumber = patch.invoice_number ?? null;
  if ("invoice_sent" in patch) f.invoiceSent = !!patch.invoice_sent;
  if ("invoice_sent_at" in patch) f.invoiceSentAt = patch.invoice_sent_at ?? null;
  if ("notes" in patch) f.notes = patch.notes ?? null;
  return f;
}

export function expenseCreateFields(e: ExpenseEntry, names: Names) {
  return {
    name: `${names.property ?? "Expense"} - ${e.category}${e.custom_category ? ` (${e.custom_category})` : ""} - ${periodLabel(e.year, e.month)}`.trim(),
    property: names.property ?? "",
    unit: names.unit ?? "",
    year: e.year,
    month: e.month,
    expenseDate: e.expense_date ?? null,
    category: e.category,
    customCategory: e.custom_category ?? null,
    amount: e.amount,
    description: e.description ?? null,
    isRecurring: !!e.is_recurring,
    isIrregular: !!e.is_irregular,
  };
}

export function expensePatchFields(patch: Partial<ExpenseEntry>, names: Names) {
  const f: Record<string, unknown> = {};
  if ("property_id" in patch) f.property = names.property ?? "";
  if ("unit_id" in patch) f.unit = names.unit ?? "";
  if ("year" in patch) f.year = patch.year;
  if ("month" in patch) f.month = patch.month;
  if ("expense_date" in patch) f.expenseDate = patch.expense_date ?? null;
  if ("category" in patch) f.category = patch.category;
  if ("custom_category" in patch) f.customCategory = patch.custom_category ?? null;
  if ("amount" in patch) f.amount = patch.amount;
  if ("description" in patch) f.description = patch.description ?? null;
  if ("is_recurring" in patch) f.isRecurring = !!patch.is_recurring;
  if ("is_irregular" in patch) f.isIrregular = !!patch.is_irregular;
  return f;
}

export function tenantCreateFields(t: Tenant, names: Names) {
  return {
    name: t.name,
    icNumber: t.ic_number ?? null,
    email: t.email ?? null,
    phone: t.phone ?? null,
    previousAddress: t.previous_address ?? null,
    unit: names.unit ?? "",
    property: names.property ?? "",
    leaseStart: t.lease_start ?? null,
    leaseEnd: t.lease_end ?? null,
    notes: t.notes ?? null,
  };
}

export function tenantPatchFields(patch: Partial<Tenant>, names: Names) {
  const f: Record<string, unknown> = {};
  if ("name" in patch) f.name = patch.name;
  if ("ic_number" in patch) f.icNumber = patch.ic_number ?? null;
  if ("email" in patch) f.email = patch.email ?? null;
  if ("phone" in patch) f.phone = patch.phone ?? null;
  if ("previous_address" in patch) f.previousAddress = patch.previous_address ?? null;
  if ("unit_id" in patch) {
    f.unit = names.unit ?? "";
    f.property = names.property ?? "";
  }
  if ("lease_start" in patch) f.leaseStart = patch.lease_start ?? null;
  if ("lease_end" in patch) f.leaseEnd = patch.lease_end ?? null;
  if ("notes" in patch) f.notes = patch.notes ?? null;
  return f;
}
