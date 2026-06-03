"use client";

import { useMemo, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import {
  MONTHS,
  PAYMENT_STATUS_LABEL,
  type PaymentStatus,
  type Tenant,
} from "@/types/rental";

function fmt(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

const STATUS_COLORS: Record<PaymentStatus, { bg: string; text: string }> = {
  paid: { bg: "rgba(47,158,111,0.10)", text: "var(--success)" },
  partial: { bg: "rgba(224,162,61,0.10)", text: "var(--warning)" },
  pending: { bg: "rgba(93,95,239,0.10)", text: "var(--accent)" },
  overdue: { bg: "rgba(211,84,84,0.10)", text: "var(--danger)" },
};

type DrawerState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; tenant: Tenant }
  | { mode: "view"; tenant: Tenant };

export default function TenantsPage() {
  const {
    tenants,
    visibleProperties,
    units,
    getUnit,
    addTenant,
    updateTenant,
    deleteTenant,
    revenueEntries,
  } = useRental();

  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });
  const [search, setSearch] = useState("");
  const [filterProp, setFilterProp] = useState("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const confirm = useConfirm();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants
      .map((t) => {
        const unit = t.unit_id ? getUnit(t.unit_id) : undefined;
        const prop = unit
          ? visibleProperties.find((p) => p.id === unit.property_id)
          : undefined;
        return { tenant: t, unit, prop };
      })
      .filter(({ prop }) => filterProp === "all" || prop?.id === filterProp)
      .filter(({ tenant, unit, prop }) => {
        if (!q) return true;
        return (
          tenant.name.toLowerCase().includes(q) ||
          (tenant.ic_number ?? "").toLowerCase().includes(q) ||
          (tenant.email ?? "").toLowerCase().includes(q) ||
          (tenant.phone ?? "").toLowerCase().includes(q) ||
          (tenant.previous_address ?? "").toLowerCase().includes(q) ||
          (tenant.notes ?? "").toLowerCase().includes(q) ||
          (unit?.name ?? "").toLowerCase().includes(q) ||
          (prop?.name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.tenant.name.localeCompare(b.tenant.name));
  }, [tenants, visibleProperties, getUnit, search, filterProp]);

  async function handleDelete(t: Tenant) {
    const { confirmed } = await confirm({
      title: "Delete tenant?",
      message: `Delete tenant "${t.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteTenant(t.id);
      setDrawer({ mode: "closed" });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete tenant from Notion.");
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Tenants
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Customer directory - IC, contact, current unit, and payment history.
          </p>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn-primary"
          onClick={() => setDrawer({ mode: "create" })}
        >
          + Add Tenant
        </button>
      </div>

      <div className="ui-card p-4 flex flex-wrap gap-3 items-center">
        <input
          type="search"
          className="ui-input w-auto min-w-[240px] flex-1 max-w-[360px]"
          placeholder="Search name, IC, email, phone, unit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          className="w-auto min-w-[160px]"
          ariaLabel="Filter by property"
          value={filterProp}
          onChange={setFilterProp}
          options={[
            { value: "all", label: "All Properties" },
            ...visibleProperties.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <div className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
          {rows.length} of {tenants.length} tenant{tenants.length === 1 ? "" : "s"}
        </div>
      </div>

      {actionError && (
        <div className="ui-card px-4 py-3 flex items-center justify-between gap-3" style={{ borderColor: "var(--danger)", background: "rgba(211,84,84,0.08)" }}>
          <p className="text-sm" style={{ color: "var(--danger)" }}>{actionError}</p>
          <button type="button" className="ui-btn" onClick={() => setActionError(null)}>Dismiss</button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="ui-card p-12 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No tenants yet.{" "}
            <button
              type="button"
              onClick={() => setDrawer({ mode: "create" })}
              style={{ color: "var(--accent)" }}
            >
              Add a tenant
            </button>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <div className="ui-card overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead style={{ background: "var(--surface-muted)" }}>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="text-left text-xs uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">IC #</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Email</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Phone</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Current Unit</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ tenant, unit, prop }) => (
                <tr
                  key={tenant.id}
                  onClick={() => setDrawer({ mode: "view", tenant })}
                  className="border-t cursor-pointer hover:bg-[var(--surface-muted)] transition-colors"
                  style={{ borderColor: "var(--border-soft)" }}
                >
                  <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                    {tenant.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                    {tenant.ic_number ?? "-"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {tenant.email ?? "-"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {tenant.phone ?? "-"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {unit ? `${prop?.name ?? ""} - ${unit.name}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrawer({ mode: "edit", tenant });
                      }}
                      className="w-7 h-7 rounded inline-flex items-center justify-center hover:bg-[var(--surface-subtle)]"
                      title="Edit"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(tenant);
                      }}
                      className="w-7 h-7 rounded inline-flex items-center justify-center hover:bg-[var(--surface-subtle)] ml-1"
                      title="Delete"
                      style={{ color: "var(--danger)" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drawer.mode === "view" && (
        <TenantDetailDrawer
          tenant={drawer.tenant}
          onClose={() => setDrawer({ mode: "closed" })}
          onEdit={() => setDrawer({ mode: "edit", tenant: drawer.tenant })}
          onDelete={() => handleDelete(drawer.tenant)}
          revenueEntries={revenueEntries.filter(
            (e) => e.unit_id === drawer.tenant.unit_id
          )}
          getUnit={getUnit}
          properties={visibleProperties}
        />
      )}

      {(drawer.mode === "create" || drawer.mode === "edit") && (
        <TenantFormDrawer
          initial={drawer.mode === "edit" ? drawer.tenant : null}
          properties={visibleProperties}
          units={units}
          onClose={() => setDrawer({ mode: "closed" })}
          onSubmit={async (input) => {
            setActionError(null);
            try {
              if (drawer.mode === "edit") {
                await updateTenant(drawer.tenant.id, input);
              } else {
                await addTenant(input);
              }
              setDrawer({ mode: "closed" });
            } catch (err) {
              setActionError(err instanceof Error ? err.message : "Could not save tenant to Notion.");
              throw err;
            }
          }}
        />
      )}
    </div>
  );
}

function TenantDetailDrawer({
  tenant,
  onClose,
  onEdit,
  onDelete,
  revenueEntries,
  getUnit,
  properties,
}: {
  tenant: Tenant;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  revenueEntries: ReturnType<typeof useRental>["revenueEntries"];
  getUnit: ReturnType<typeof useRental>["getUnit"];
  properties: ReturnType<typeof useRental>["visibleProperties"];
}) {
  const unit = tenant.unit_id ? getUnit(tenant.unit_id) : undefined;
  const prop = unit ? properties.find((p) => p.id === unit.property_id) : undefined;

  const history = [...revenueEntries].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  const totalPaid = history
    .filter((e) => e.payment_status === "paid")
    .reduce((s, e) => s + e.total_amount, 0);
  const totalOutstanding = history
    .filter((e) => e.payment_status !== "paid")
    .reduce((s, e) => s + e.total_amount, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-full overflow-y-auto"
        style={{ background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between p-6 border-b sticky top-0 z-10"
          style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
        >
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Tenant
            </p>
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {tenant.name}
            </h3>
          </div>
          <div className="flex gap-2">
            <button type="button" className="ui-btn" onClick={onEdit}>Edit</button>
            <button
              type="button"
              className="ui-btn"
              onClick={onDelete}
              style={{ color: "var(--danger)" }}
            >
              Delete
            </button>
            <button type="button" className="ui-btn" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6 text-sm">
          <section>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>
              Contact
            </p>
            <dl className="grid grid-cols-2 gap-3">
              <Field label="IC #" value={tenant.ic_number} mono />
              <Field label="Email" value={tenant.email} />
              <Field label="Phone" value={tenant.phone} />
              <Field label="Current Unit" value={unit ? `${prop?.name ?? ""} - ${unit.name}` : null} />
              <Field label="Lease Start" value={tenant.lease_start} />
              <Field label="Lease End" value={tenant.lease_end} />
            </dl>
          </section>

          <section>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>
              Previous Rental Address
            </p>
            <p style={{ color: "var(--text-secondary)" }}>{tenant.previous_address ?? "-"}</p>
          </section>

          {tenant.notes && (
            <section>
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>
                Notes
              </p>
              <p style={{ color: "var(--text-secondary)" }}>{tenant.notes}</p>
            </section>
          )}

          <section className="border-t pt-5" style={{ borderColor: "var(--border-soft)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                Payment History
              </p>
              <div className="flex gap-4 text-xs">
                <span style={{ color: "var(--success)" }}>Paid: {fmt(totalPaid)}</span>
                <span style={{ color: "var(--danger)" }}>Outstanding: {fmt(totalOutstanding)}</span>
              </div>
            </div>

            {history.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
                No payment records for this tenant&apos;s unit yet.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: "var(--text-faint)" }}>
                      <th className="text-left text-xs uppercase tracking-wider px-6 py-2">Period</th>
                      <th className="text-right text-xs uppercase tracking-wider px-3 py-2">Amount</th>
                      <th className="text-center text-xs uppercase tracking-wider px-6 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((e) => {
                      const sc = STATUS_COLORS[e.payment_status ?? "pending"];
                      return (
                        <tr key={e.id} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                          <td className="px-6 py-2" style={{ color: "var(--text-secondary)" }}>
                            {MONTHS[e.month - 1]} {e.year}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
                            {fmt(e.total_amount)}
                          </td>
                          <td className="px-6 py-2 text-center">
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ background: sc.bg, color: sc.text }}
                            >
                              {PAYMENT_STATUS_LABEL[e.payment_status ?? "pending"]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs mb-0.5" style={{ color: "var(--text-faint)" }}>{label}</dt>
      <dd className={mono ? "font-mono text-xs" : ""} style={{ color: "var(--text-primary)" }}>
        {value ?? "-"}
      </dd>
    </div>
  );
}

function TenantFormDrawer({
  initial,
  properties,
  units,
  onClose,
  onSubmit,
}: {
  initial: Tenant | null;
  properties: ReturnType<typeof useRental>["visibleProperties"];
  units: ReturnType<typeof useRental>["units"];
  onClose: () => void;
  onSubmit: (input: Omit<Tenant, "id" | "created_at">) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icNumber, setIcNumber] = useState(initial?.ic_number ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [previousAddress, setPreviousAddress] = useState(initial?.previous_address ?? "");
  const [unitId, setUnitId] = useState(initial?.unit_id ?? "");
  const [propertyId, setPropertyId] = useState(() => {
    if (!initial?.unit_id) return "";
    const u = units.find((x) => x.id === initial.unit_id);
    return u?.property_id ?? "";
  });
  const [leaseStart, setLeaseStart] = useState(initial?.lease_start ?? "");
  const [leaseEnd, setLeaseEnd] = useState(initial?.lease_end ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitOptions = propertyId
    ? units.filter((u) => u.property_id === propertyId).sort((a, b) => a.sort_order - b.sort_order)
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        ic_number: icNumber.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        previous_address: previousAddress.trim() || null,
        unit_id: unitId || null,
        lease_start: leaseStart || null,
        lease_end: leaseEnd || null,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save tenant to Notion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg h-full overflow-y-auto flex flex-col"
        style={{ background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between p-6 border-b sticky top-0 z-10"
          style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
        >
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {initial ? "Edit Tenant" : "Add Tenant"}
          </h3>
        </div>

        <div className="p-6 flex flex-col gap-4 text-sm flex-1">
          <TextInput label="Full Name *" value={name} onChange={setName} required />
          <TextInput label="IC Number" value={icNumber} onChange={setIcNumber} placeholder="e.g. 901231-14-5678" />
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Email" value={email} onChange={setEmail} type="email" />
            <TextInput label="Phone" value={phone} onChange={setPhone} placeholder="e.g. +60 12-345 6789" />
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-faint)" }}>
              Previous Rental Address
            </label>
            <textarea
              value={previousAddress}
              onChange={(e) => setPreviousAddress(e.target.value)}
              rows={2}
              className="ui-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-faint)" }}>Property</label>
              <Select
                value={propertyId}
                placeholder="- None -"
                onChange={(v) => {
                  setPropertyId(v);
                  setUnitId("");
                }}
                options={[
                  { value: "", label: "- None -" },
                  ...properties.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-faint)" }}>Unit</label>
              <Select
                value={unitId}
                placeholder={propertyId ? "- None -" : "Select a property first"}
                onChange={setUnitId}
                options={[
                  { value: "", label: "- None -" },
                  ...unitOptions.map((u) => ({ value: u.id, label: u.name })),
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Lease Start" type="date" value={leaseStart} onChange={setLeaseStart} />
            <TextInput label="Lease End" type="date" value={leaseEnd} onChange={setLeaseEnd} />
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-faint)" }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="ui-input w-full"
            />
          </div>
        </div>

        <div
          className="p-4 border-t flex justify-end gap-2 sticky bottom-0"
          style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
        >
          {error && <p className="mr-auto self-center text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={saving}>
            {saving ? "Saving..." : initial ? "Save Changes" : "Add Tenant"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--text-faint)" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="ui-input w-full"
      />
    </div>
  );
}
