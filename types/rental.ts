export type RentalModel = "room_rental" | "whole_unit";

export type PropertyStatus = "active" | "inactive" | "under_service";

export type PropertyType =
  | "house"
  | "condo"
  | "apartment"
  | "townhouse"
  | "commercial"
  | "other";

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

  /** Total rentable units (rooms for room_rental, 1 for whole_unit). */
  total_units: number;
  /** Currently rented units. */
  rented_units: number;

  /** Convenience aggregates — could be derived in the future. */
  ytd_revenue?: number;
  ytd_expenses?: number;

  deleted_at?: string | null;
  delete_expires_at?: string | null;
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
