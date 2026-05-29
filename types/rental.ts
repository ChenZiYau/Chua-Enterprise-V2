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
  total_amount: number;
  notes?: string | null;
  invoice_generated: boolean;
  created_at: string;
}

export interface ExpenseEntry {
  id: string;
  property_id: string;
  year: number;
  month: number;
  category: ExpenseCategory;
  amount: number;
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
