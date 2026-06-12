"use client";

import { useMemo, useState } from "react";
import { ShareCard } from "@/components/share/ShareCard";
import { useRental } from "@/context/RentalContext";
import { IconSearch } from "@/components/admin/icons";
import { Select } from "@/components/ui/Select";
import type { PropertyFilters } from "@/types/rental";

const initialFilters: Pick<PropertyFilters, "search" | "rental_model"> = {
  search: "",
  rental_model: "all",
};

export default function SharePage() {
  const [filters, setFilters] = useState(initialFilters);
  const { visibleProperties: properties, getUnitsForProperty } = useRental();

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return properties.filter((p) => {
      if (filters.rental_model !== "all" && p.rental_model !== filters.rental_model) return false;
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
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col gap-8">
      {/* Header */}
      <header className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
          Sharing
        </p>
        <h2 className="text-2xl font-semibold mt-1 tracking-tight" style={{ color: "var(--text-primary)" }}>
          Share
        </h2>
        <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
          Send photo links for properties and rooms to customers
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <IconSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--text-faint)" } as React.CSSProperties}
          />
          <input
            className="ui-input"
            placeholder="Search by name, address, city..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <Select
          className="w-auto min-w-[160px]"
          ariaLabel="Filter by rental model"
          value={filters.rental_model}
          onChange={(v) => setFilters((f) => ({ ...f, rental_model: v as PropertyFilters["rental_model"] }))}
          options={[
            { value: "all", label: "All models" },
            { value: "whole_unit", label: "Whole unit" },
            { value: "room_rental", label: "Room rental" },
          ]}
        />
        {(filters.search || filters.rental_model !== "all") && (
          <button type="button" className="ui-btn" onClick={() => setFilters(initialFilters)}>
            Reset
          </button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="ui-card p-12 text-center" style={{ color: "var(--text-muted)" }}>
          <p className="text-sm">No properties match the current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <ShareCard key={p.id} property={p} units={getUnitsForProperty(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
