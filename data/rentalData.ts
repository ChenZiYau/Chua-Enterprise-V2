import type { Property } from "@/types/rental";

export const PROPERTY_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?auto=format&fit=crop&w=1200&q=70";

export const seedProperties: Property[] = [
  {
    id: "prop_menjalara",
    slug: "27-menjalara",
    name: "27 Menjalara",
    short_name: "Menjalara",
    address: "27 Jalan Menjalara 9/12",
    city: "Kuala Lumpur",
    state: "Wilayah Persekutuan",
    postcode: "52200",
    rental_model: "room_rental",
    property_type: "house",
    status: "active",
    image_url:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=70",
    description: "Six-room rental house in the Menjalara neighbourhood.",
    total_units: 6,
    rented_units: 4,
    ytd_revenue: 48200,
    ytd_expenses: 12450,
    deleted_at: null,
    delete_expires_at: null,
  },
  {
    id: "prop_kayangan",
    slug: "kayangan",
    name: "Kayangan",
    short_name: "Kayangan",
    address: "Persiaran Kayangan 3",
    city: "Shah Alam",
    state: "Selangor",
    postcode: "40150",
    rental_model: "room_rental",
    property_type: "townhouse",
    status: "active",
    image_url:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=70",
    description: "Townhouse with shared common area, ideal for student tenants.",
    total_units: 5,
    rented_units: 5,
    ytd_revenue: 39800,
    ytd_expenses: 9300,
    deleted_at: null,
    delete_expires_at: null,
  },
  {
    id: "prop_paramount",
    slug: "paramount",
    name: "Paramount",
    short_name: "Paramount",
    address: "Jalan 20/16, Paramount Garden",
    city: "Petaling Jaya",
    state: "Selangor",
    postcode: "46300",
    rental_model: "whole_unit",
    property_type: "condo",
    status: "under_service",
    image_url:
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=70",
    description: "Two-bedroom condo currently undergoing scheduled servicing.",
    total_units: 1,
    rented_units: 0,
    ytd_revenue: 22000,
    ytd_expenses: 8600,
    deleted_at: null,
    delete_expires_at: null,
  },
  {
    id: "prop_nova",
    slug: "nova",
    name: "Nova",
    short_name: "Nova",
    address: "Nova Residence, Tower B",
    city: "Cyberjaya",
    state: "Selangor",
    postcode: "63000",
    rental_model: "whole_unit",
    property_type: "apartment",
    status: "active",
    image_url:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=70",
    description: "Studio apartment leased as a whole unit.",
    total_units: 1,
    rented_units: 1,
    ytd_revenue: 18600,
    ytd_expenses: 4200,
    deleted_at: null,
    delete_expires_at: null,
  },
];

export function getVisibleProperties(): Property[] {
  return seedProperties.filter((p) => !p.deleted_at);
}
