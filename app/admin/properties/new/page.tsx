"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PropertyForm } from "@/components/property/PropertyForm";
import { useRental } from "@/context/RentalContext";

export default function NewPropertyPage() {
  const router = useRouter();
  const { createProperty } = useRental();

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-7 max-w-4xl">
      <div>
        <Link
          href="/admin/properties"
          className="text-xs inline-flex items-center gap-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          <span aria-hidden>←</span>
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
        <PropertyForm
          submitLabel="Save Property"
          onCancel={() => router.push("/admin/properties")}
          onSubmit={(values) => {
            const created = createProperty(values);
            router.push(`/admin/properties/${created.id}`);
          }}
        />
      </div>
    </div>
  );
}
