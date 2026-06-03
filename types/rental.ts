export type RentalModel = "room_rental" | "whole_unit";

export type PropertyStatus = "active" | "inactive" | "under_service";

export type PropertyType =
  | "house"
  | "condo"
  | "apartment"
  | "townhouse"
  | "commercial"
  | "other";

export type ExpenseCategory =
  | "electricity"
  | "water"
  | "indah_water"
  | "assessment"
  | "quit_rent"
  | "insurance"
  | "internet"
  | "maintenance"
  | "sinking_fund"
  | "other";

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  electricity: "Electricity",
  water: "Water",
  indah_water: "Indah Water",
  assessment: "Assessment (Cukai Taksiran)",
  quit_rent: "Quit Rent (Cukai Tanah)",
  insurance: "Insurance",
  internet: "Internet",
  maintenance: "Maintenance / Repairs",
  sinking_fund: "Sinking Fund",
  other: "Other",
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "electricity",
  "water",
  "indah_water",
  "assessment",
  "quit_rent",
  "insurance",
  "internet",
  "maintenance",
  "sinking_fund",
  "other",
];

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "cheque"
  | "online"
  | "other";

export type PaymentStatus = "paid" | "partial" | "pending" | "overdue";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  online: "Online / e-Wallet",
  other: "Other",
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "bank_transfer",
  "cheque",
  "online",
  "other",
];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  pending: "Pending",
  overdue: "Overdue",
};

export interface Property {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  rental_model: RentalModel;
  property_type: PropertyType;
  status: PropertyStatus;
  image_url?: string | null;
  description?: string | null;
  total_units: number;
  rented_units: number;
  ytd_revenue?: number;
  ytd_expenses?: number;
  deleted_at?: string | null;
  delete_expires_at?: string | null;
}

export interface Unit {
  id: string;
  property_id: string;
  name: string;
  label: string;
  sort_order: number;
  is_rented: boolean;
  tenant_name?: string | null;
  rental_rate?: number | null;
  electricity_free_units: number;
}

export interface RevenueEntry {
  id: string;
  property_id: string;
  unit_id: string;
  year: number;
  month: number;
  rental_amount: number;
  electricity_units?: number | null;
  electricity_amount?: number | null;
  other_charges_amount?: number | null;
  total_amount: number;
  payment_date?: string | null;
  payment_method?: PaymentMethod | null;
  custom_payment_method?: string | null;
  payment_status: PaymentStatus;
  notes?: string | null;
  invoice_generated: boolean;
  invoice_number?: string | null;
  invoice_sent?: boolean;
  invoice_sent_at?: string | null;
  created_at: string;
}

export interface ExpenseEntry {
  id: string;
  property_id: string;
  year: number;
  month: number;
  expense_date?: string | null;
  category: ExpenseCategory;
  custom_category?: string | null;
  amount: number;
  description?: string | null;
  is_recurring?: boolean;
  is_irregular?: boolean;
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  ic_number?: string | null;
  email?: string | null;
  phone?: string | null;
  previous_address?: string | null;
  unit_id?: string | null;
  lease_start?: string | null;
  lease_end?: string | null;
  notes?: string | null;
  created_at: string;
}

export type MaintenanceStatus = "pending" | "in_progress" | "completed";
export type MaintenancePriority = "low" | "medium" | "high" | "urgent";

export interface MaintenanceEntry {
  id: string;
  property: string;
  unit: string;
  tenant: string;
  issue: string;
  category: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reported_date: string;
  due_date: string;
  assigned_to?: string | null;
  description?: string | null;
  created_at: string;
}

export interface PropertyFilters {
  search: string;
  rental_model: RentalModel | "all";
  status: PropertyStatus | "all";
}

export const RENTAL_MODEL_LABEL: Record<RentalModel, string> = {
  room_rental: "Room Rental",
  whole_unit: "Whole Unit",
};

export const STATUS_LABEL: Record<PropertyStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  under_service: "Under Service",
};

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
