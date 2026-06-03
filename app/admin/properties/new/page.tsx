"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PropertyForm } from "@/components/property/PropertyForm";
import { useRental } from "@/context/RentalContext";

export default function NewPropertyPage() {
  const router = useRouter();
  const { createProperty } = useRental();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-7 max-w-4xl">
      <div>
        <Link
          href="/admin/properties"
          className="text-xs inline-flex items-center gap-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          <span aria-hidden>&#8592;</span>
          Back to Properties
        </Link>
        <div className="mt-4">
          <p
            className="text-[11px] uppercase tracking-[0.16em]"
            style={{ color: "var(--text-faint)" }}
          >
            New
          </p>
          <h2
            className="text-2xl font-semibold mt-1 tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Add a property
          </h2>
          <p className="text-sm mt-1.5 max-w-xl" style={{ color: "var(--text-muted)" }}>
            Choose how the property is rented, then fill in identity, location, and capacity.
          </p>
        </div>
      </div>

      <div className="ui-card p-6 lg:p-8">
        {error && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: "rgba(211,84,84,0.08)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
            {error}
          </div>
        )}
        <PropertyForm
          submitLabel={saving ? "Saving..." : "Save Property"}
          onCancel={() => router.push("/admin/properties")}
          onSubmit={async (values) => {
            setSaving(true);
            setError(null);
            try {
              const created = await createProperty(values);
              router.push(`/admin/properties/${created.id}`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save property to Notion.");
            } finally {
              setSaving(false);
            }
          }}
        />
      </div>
    </div>
  );
}
