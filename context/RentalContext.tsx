"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Property } from "@/types/rental";
import { seedProperties } from "@/data/rentalData";

const STORAGE_KEY = "chua.rental.properties.v1";

type PropertyInput = Omit<Property, "id" | "slug"> & {
  id?: string;
  slug?: string;
};

interface RentalContextValue {
  properties: Property[];
  visibleProperties: Property[];
  getProperty: (id: string) => Property | undefined;
  createProperty: (input: PropertyInput) => Property;
  updateProperty: (id: string, patch: Partial<Property>) => Property | undefined;
  softDeleteProperty: (id: string) => void;
}

const RentalContext = createContext<RentalContextValue | null>(null);

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function generateId() {
  return "prop_" + Math.random().toString(36).slice(2, 10);
}

export function RentalProvider({ children }: { children: React.ReactNode }) {
  const [properties, setProperties] = useState<Property[]>(seedProperties);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on the client
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Property[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProperties(parsed);
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Persist after hydration
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
    } catch {
      /* ignore */
    }
  }, [properties, hydrated]);

  const createProperty = useCallback((input: PropertyInput): Property => {
    const id = input.id ?? generateId();
    const slug = input.slug ?? (slugify(input.name) || id);
    const next: Property = {
      ...input,
      id,
      slug,
      deleted_at: input.deleted_at ?? null,
      delete_expires_at: input.delete_expires_at ?? null,
    };
    setProperties((prev) => [next, ...prev]);
    return next;
  }, []);

  const updateProperty = useCallback(
    (id: string, patch: Partial<Property>) => {
      let updated: Property | undefined;
      setProperties((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          updated = { ...p, ...patch };
          return updated;
        })
      );
      return updated;
    },
    []
  );

  const softDeleteProperty = useCallback((id: string) => {
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setProperties((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, deleted_at: now, delete_expires_at: expires } : p
      )
    );
  }, []);

  const value = useMemo<RentalContextValue>(() => {
    const visibleProperties = properties.filter((p) => !p.deleted_at);
    return {
      properties,
      visibleProperties,
      getProperty: (id: string) => properties.find((p) => p.id === id),
      createProperty,
      updateProperty,
      softDeleteProperty,
    };
  }, [properties, createProperty, updateProperty, softDeleteProperty]);

  return <RentalContext.Provider value={value}>{children}</RentalContext.Provider>;
}

export function useRental() {
  const ctx = useContext(RentalContext);
  if (!ctx) throw new Error("useRental must be used inside RentalProvider");
  return ctx;
}
