"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PropertyCard } from "@/components/property/PropertyCard";
import { useRental } from "@/context/RentalContext";
import { IconSearch } from "@/components/admin/icons";
import { STATUS_LABEL, type PropertyFilters } from "@/types/rental";

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

  const roomCount = properties.filter((p) => p.rental_model === "room_rental").length;
  const wholeCount = properties.filter((p) => p.rental_model === "whole_unit").length;

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p
            className="text-[11px] uppercase tracking-[0.16em]"
            style={{ color: "var(--text-faint)" }}
          >
            Portfolio
          </p>
          <h2
            className="text-2xl font-semibold mt-1 tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Properties
          </h2>
          <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
            {properties.length} active
            <span style={{ color: "var(--text-faint)" }}> · </span>
            {roomCount} room rental
            <span style={{ color: "var(--text-faint)" }}> · </span>
            {wholeCount} whole unit
          </p>
        </div>
        <Link href="/admin/properties/new" className="ui-btn ui-btn-primary">
          <span className="text-base leading-none">+</span>
          <span>Add Property</span>
        </Link>
      </header>

      {/* Filters — ghost strip, no boxed card to keep the page calm */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <IconSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--text-faint)" } as React.CSSProperties}
          />
          <input
            className="ui-input"
            placeholder="Search by name, address, city…"
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
          <option value="all">All models</option>
          <option value="room_rental">Room rental</option>
          <option value="whole_unit">Whole unit</option>
        </select>
        <select
          className="ui-select w-auto min-w-[160px]"
          value={filters.status}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value as PropertyFilters["status"] }))
          }
        >
          <option value="all">All statuses</option>
          {(["active", "inactive", "under_service"] as const).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        {(filters.search || filters.rental_model !== "all" || filters.status !== "all") && (
          <button
            type="button"
            className="ui-btn"
            onClick={() => setFilters(initialFilters)}
          >
            Reset
          </button>
        )}
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
