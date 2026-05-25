"use client";

import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { PropertyForm } from "@/components/property/PropertyForm";
import { useRental } from "@/context/RentalContext";

export default function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { getProperty, updateProperty } = useRental();
  const property = getProperty(id);

  if (!property) {
    return (
      <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-4">
        <Link
          href="/admin/properties"
          className="text-xs inline-flex items-center gap-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          <span aria-hidden>←</span>
          Back to Properties
        </Link>
        <div className="ui-card p-12 text-center">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Property not found
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-7 max-w-4xl">
      <div>
        <Link
          href={`/admin/properties/${property.id}`}
          className="text-xs inline-flex items-center gap-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          <span aria-hidden>←</span>
          Back to {property.name}
        </Link>
        <div className="mt-4">
          <p
            className="text-[11px] uppercase tracking-[0.16em]"
            style={{ color: "var(--text-faint)" }}
          >
            Edit
          </p>
          <h2
            className="text-2xl font-semibold mt-1 tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {property.name}
          </h2>
          <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
            Editing identity, location, or capacity is safe — historical revenue, expenses, and invoices are linked by ID.
          </p>
        </div>
      </div>

      <div className="ui-card p-6 lg:p-8">
        <PropertyForm
          initial={property}
          submitLabel="Save Changes"
          onCancel={() => router.push(`/admin/properties/${property.id}`)}
          onSubmit={(values) => {
            updateProperty(property.id, values);
            router.push(`/admin/properties/${property.id}`);
          }}
        />
      </div>
    </div>
  );
}
