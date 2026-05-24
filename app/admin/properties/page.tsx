"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PropertyCard } from "@/components/property/PropertyCard";
import { useRental } from "@/context/RentalContext";
import { IconSearch } from "@/components/admin/icons";
import type { PropertyFilters } from "@/types/rental";

const initialFilters: PropertyFilters = {
  search: "",
  rental_model: "all",
  status: "all",
};

export default function PropertiesPage() {
  const [filters, setFilters] = useState<PropertyFilters>(initialFilters);
  const { visibleProperties: properties } = useRental();

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return properties.filter((p) => {
      if (filters.rental_model !== "all" && p.rental_model !== filters.rental_model) return false;
      if (filters.status !== "all" && p.status !== filters.status) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.short_name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q)
      );
    });
  }, [properties, filters]);

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            All Properties
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {filtered.length} of {properties.length} properties
          </p>
        </div>
        <Link href="/admin/properties/new" className="ui-btn ui-btn-primary">
          <span className="text-base leading-none">+</span>
          <span>Add Property</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="ui-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <IconSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--text-faint)" } as React.CSSProperties}
          />
          <input
            className="ui-input"
            placeholder="Search property name, address, city…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <select
          className="ui-select w-auto min-w-[160px]"
          value={filters.rental_model}
          onChange={(e) =>
            setFilters((f) => ({ ...f, rental_model: e.target.value as PropertyFilters["rental_model"] }))
          }
        >
          <option value="all">All Models</option>
          <option value="room_rental">Room Rental</option>
          <option value="whole_unit">Whole Unit</option>
        </select>
        <select
          className="ui-select w-auto min-w-[160px]"
          value={filters.status}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value as PropertyFilters["status"] }))
          }
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="under_service">Under Service</option>
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          className="ui-card p-12 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          <p className="text-sm">No properties match the current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  );
}
