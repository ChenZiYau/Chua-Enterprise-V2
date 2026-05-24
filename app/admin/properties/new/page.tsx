"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PropertyForm } from "@/components/property/PropertyForm";
import { useRental } from "@/context/RentalContext";

export default function NewPropertyPage() {
  const router = useRouter();
  const { createProperty } = useRental();

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">
      <div>
        <Link
          href="/admin/properties"
          className="text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          ← Back to Properties
        </Link>
      </div>

      <div className="ui-card p-6 lg:p-8 max-w-4xl">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Add Property
        </h2>
        <p className="text-sm mt-1 mb-6" style={{ color: "var(--text-muted)" }}>
          Add a new rental property to your portfolio.
        </p>

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
