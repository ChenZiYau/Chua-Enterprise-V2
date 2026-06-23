"use client";

import { useMemo } from "react";
import { useRental } from "@/context/RentalContext";
import { Select, type SelectOption } from "@/components/ui/Select";
import type { RoomInput, Unit } from "@/types/rental";

/** Form-local room draft. `key` is a stable React key; `id` (when present) maps
 *  to an existing unit being edited. Numeric fields are kept as strings while
 *  editing and parsed on submit. */
export type RoomDraft = {
  key: string;
  id?: string;
  name: string;
  rental_rate: string;
  tenant_name: string;
};

let seq = 0;
function nextKey() {
  seq += 1;
  return `room-${Date.now()}-${seq}`;
}

export function blankRoom(): RoomDraft {
  return { key: nextKey(), name: "", rental_rate: "", tenant_name: "" };
}

/** Build the initial draft list from existing units (edit flow). Falls back to a
 *  single blank room so the manager always shows at least one row. */
export function roomsFromUnits(units: Unit[]): RoomDraft[] {
  const sorted = units.slice().sort((a, b) => a.sort_order - b.sort_order);
  if (sorted.length === 0) return [blankRoom()];
  return sorted.map((u) => ({
    key: nextKey(),
    id: u.id,
    name: u.name ?? "",
    rental_rate: u.rental_rate != null ? String(u.rental_rate) : "",
    tenant_name: u.tenant_name ?? "",
  }));
}

/** Convert drafts into the RoomInput payload the context expects. */
export function draftsToRoomInputs(rooms: RoomDraft[]): RoomInput[] {
  return rooms.map((r) => {
    const rate = parseFloat(r.rental_rate);
    return {
      id: r.id,
      name: r.name.trim(),
      rental_rate: Number.isFinite(rate) ? rate : null,
      tenant_name: r.tenant_name.trim() || null,
    };
  });
}

const inputClass = "w-full px-3 py-2 text-sm rounded-lg border outline-none transition focus:border-[var(--accent)]";
const inputStyle: React.CSSProperties = {
  borderColor: "var(--border-soft)",
  background: "var(--surface)",
  color: "var(--text-primary)",
};

/**
 * Dynamic room editor — add as many rooms as needed, each with a name, base rent
 * and tenant. Mirrors the "add another line" pattern of the expense entry drawer.
 */
export function RoomManager({
  rooms,
  onChange,
  error,
}: {
  rooms: RoomDraft[];
  onChange: (rooms: RoomDraft[]) => void;
  error?: string;
}) {
  const { tenants } = useRental();

  // Tenant options come straight from the tenant table — names only, deduped and
  // sorted, with a "Vacant" choice for an unoccupied room. Free typing is not
  // allowed: a room is either vacant or assigned to an existing tenant.
  const tenantOptions = useMemo<SelectOption[]>(() => {
    const names = Array.from(
      new Set(tenants.map((t) => t.name).filter((n): n is string => !!n && n.trim() !== ""))
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "", label: "Vacant" }, ...names.map((name) => ({ value: name, label: name }))];
  }, [tenants]);

  function update(key: string, patch: Partial<RoomDraft>) {
    onChange(rooms.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function add() {
    onChange([...rooms, blankRoom()]);
  }
  function remove(key: string) {
    onChange(rooms.filter((r) => r.key !== key));
  }

  // Past three rooms the list scrolls instead of growing the whole form. The
  // cap is keyed off the third card's bottom edge so the 4th peeks in, hinting
  // there's more to scroll.
  const scrollable = rooms.length > 3;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={"flex flex-col gap-3 " + (scrollable ? "overflow-y-auto pr-1" : "")}
        style={scrollable ? { maxHeight: "min(56vh, 520px)" } : undefined}
      >
      {rooms.map((room, i) => (
        <div
          key={room.key}
          className="rounded-xl border p-3 flex flex-col gap-3 shrink-0"
          style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>
              Room {i + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(room.key)}
              disabled={rooms.length === 1}
              aria-label={`Remove room ${i + 1}`}
              className="w-7 h-7 rounded-lg inline-flex items-center justify-center border transition hover:bg-[var(--surface)] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: "var(--danger)", borderColor: "var(--border-soft)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                Room name
              </span>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="e.g. Master, Middle 1"
                value={room.name}
                onChange={(e) => update(room.key, { name: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                Base rent (RM/mo)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className={inputClass}
                style={inputStyle}
                placeholder="0.00"
                value={room.rental_rate}
                onChange={(e) => update(room.key, { rental_rate: e.target.value })}
              />
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
              Tenant (select Vacant if none)
            </span>
            <Select
              value={room.tenant_name}
              // Keep a current assignment visible even if it isn't in the tenant
              // table (legacy free-typed names) by appending it as an option.
              options={
                room.tenant_name && !tenantOptions.some((o) => o.value === room.tenant_name)
                  ? [...tenantOptions, { value: room.tenant_name, label: `${room.tenant_name} (not in tenant list)` }]
                  : tenantOptions
              }
              placeholder="Select tenant…"
              ariaLabel={`Tenant for room ${i + 1}`}
              onChange={(v) => update(room.key, { tenant_name: v })}
            />
          </div>
        </div>
      ))}
      </div>

      {error ? (
        <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>
      ) : null}

      <button
        type="button"
        onClick={add}
        className="w-full rounded-xl border border-dashed py-2.5 text-sm font-medium transition hover:bg-[var(--surface-muted)]"
        style={{ borderColor: "var(--border-strong)", color: "var(--accent)" }}
      >
        + Add Room
      </button>
    </div>
  );
}
