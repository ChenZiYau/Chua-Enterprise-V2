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
        <Link href="/admin/properties" className="text-sm" style={{ color: "var(--text-muted)" }}>
          ← Back to Properties
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
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">
      <Link
        href={`/admin/properties/${property.id}`}
        className="text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        ← Back to {property.name}
      </Link>

      <div className="ui-card p-6 lg:p-8 max-w-4xl">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Edit Property
        </h2>
        <p className="text-sm mt-1 mb-6" style={{ color: "var(--text-muted)" }}>
          Update details for {property.name}.
        </p>

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
