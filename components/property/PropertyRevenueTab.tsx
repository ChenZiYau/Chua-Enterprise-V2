"use client";

import { useMemo, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { DatePickerField } from "@/components/ui/DatePicker";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { RowActionMenu } from "@/components/ui/RowActionMenu";
import { RevenueEntryDrawer } from "@/components/property/RevenueEntryDrawer";
import {
  MONTHS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  type Property,
} from "@/types/rental";
import {
  entryDayKey,
  fmtMYR,
  parseDayInput,
  PAYMENT_STATUS_COLORS,
} from "@/lib/ledger";

const CUR_YEAR = new Date().getFullYear();

type DrawerState = {
  open: boolean;
  unitId?: string;
  month?: number;
  year?: number;
};

/** Revenue ledger scoped to a single property — mirrors the admin Revenue page
 *  but drops the property column/filter and adds a room filter for room rentals. */
export function PropertyRevenueTab({ property }: { property: Property }) {
  const { revenueEntries, getUnit, getUnitsForProperty, deleteRevenueEntry } = useRental();
  const confirm = useConfirm();

  const isRoom = property.rental_model === "room_rental";
  const rooms = getUnitsForProperty(property.id)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const [fromDate, setFromDate] = useState(`${CUR_YEAR}-01-01`);
  const [toDate, setToDate] = useState(`${CUR_YEAR}-12-31`);
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [drawer, setDrawer] = useState<DrawerState>({ open: false });
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let lo = parseDayInput(fromDate);
    let hi = parseDayInput(toDate);
    if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
    const q = search.trim().toLowerCase();

    return revenueEntries
      .filter((e) => e.property_id === property.id)
      .filter((e) => {
        const k = entryDayKey(e.year, e.month, e.payment_date);
        if (lo != null && k < lo) return false;
        if (hi != null && k > hi) return false;
        return true;
      })
      .filter((e) => filterUnit === "all" || e.unit_id === filterUnit)
      .filter((e) => filterStatus === "all" || e.payment_status === filterStatus)
      .filter((e) => {
        if (!q) return true;
        const unit = getUnit(e.unit_id);
        return (
          (unit?.name ?? "").toLowerCase().includes(q) ||
          (unit?.tenant_name ?? "").toLowerCase().includes(q) ||
          (e.notes ?? "").toLowerCase().includes(q) ||
          (e.custom_payment_method ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return a.unit_id.localeCompare(b.unit_id);
      });
  }, [revenueEntries, property.id, fromDate, toDate, search, filterUnit, filterStatus, getUnit]);

  const totalRevenue = filtered.reduce((s, e) => s + e.total_amount, 0);

  const resetKey = `${fromDate}|${toDate}|${search}|${filterUnit}|${filterStatus}`;
  const { page, setPage, totalPages, total, pageSize, pageItems } = usePagination(filtered, 10, resetKey);

  async function handleDelete(id: string, label: string) {
    const { confirmed } = await confirm({
      title: "Delete revenue entry?",
      message: `Delete the revenue entry for ${label}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteRevenueEntry(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete revenue from the database.");
    }
  }

  const openNew = () => setDrawer({ open: true, unitId: rooms[0]?.id });

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="ui-card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <DatePickerField
            granularity="day"
            className="w-[150px]"
            value={fromDate}
            onChange={setFromDate}
            placeholder="From date"
            ariaLabel="From date"
          />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
          <DatePickerField
            granularity="day"
            className="w-[150px]"
            value={toDate}
            onChange={setToDate}
            placeholder="To date"
            ariaLabel="To date"
          />

          <div className="ml-auto flex flex-wrap items-center gap-3">
            {isRoom && rooms.length > 0 && (
              <Select
                className="w-auto min-w-[200px]"
                ariaLabel="Filter by room"
                value={filterUnit}
                onChange={setFilterUnit}
                options={[
                  { value: "all", label: "All Rooms" },
                  ...rooms.map((u) => ({ value: u.id, label: u.name })),
                ]}
              />
            )}
            <Select
              className="w-auto min-w-[130px]"
              ariaLabel="Filter by status"
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "paid", label: "Paid" },
                { value: "partial", label: "Partial" },
                { value: "pending", label: "Pending" },
                { value: "overdue", label: "Overdue" },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            className="ui-input w-auto min-w-[200px] flex-1 max-w-[360px]"
            placeholder="Search room, tenant, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="ui-btn ui-btn-primary" onClick={openNew}>
            + Enter Revenue
          </button>
          <div className="ml-auto text-sm font-semibold" style={{ color: "var(--success)" }}>
            Total: {fmtMYR(totalRevenue)}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="ui-card px-4 py-3 flex items-center justify-between gap-3" style={{ borderColor: "var(--danger)", background: "rgba(211,84,84,0.08)" }}>
          <p className="text-sm" style={{ color: "var(--danger)" }}>{actionError}</p>
          <button type="button" className="ui-btn" onClick={() => setActionError(null)}>Dismiss</button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="ui-card p-12 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No revenue entries found.{" "}
            <button type="button" onClick={openNew} style={{ color: "var(--accent)" }}>
              Enter revenue
            </button>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <div className="ui-card overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead style={{ background: "var(--surface-muted)" }}>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="text-center text-xs uppercase tracking-wider px-5 py-3">Tenant Name</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Unit</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Month</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Rental</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Electricity</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Other</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Total</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Method</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Invoice</th>
                <th
                  className="text-center text-xs uppercase tracking-wider px-3 py-3 sticky right-0"
                  style={{ background: "var(--surface-muted)", borderLeft: "1px solid var(--border-soft)" }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((entry) => {
                const unit = getUnit(entry.unit_id);
                const statusColors = PAYMENT_STATUS_COLORS[entry.payment_status ?? "pending"];
                const label = `${unit?.name ?? entry.unit_id} - ${MONTHS[entry.month - 1]} ${entry.year}`;
                return (
                  <tr
                    key={entry.id}
                    className="border-t hover:bg-[var(--surface-muted)] transition-colors"
                    style={{ borderColor: "var(--border-soft)" }}
                  >
                    <td
                      className="px-5 py-3 text-center font-medium"
                      style={{ color: unit?.tenant_name ? "var(--text-primary)" : "var(--text-faint)" }}
                    >
                      {unit?.tenant_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: "var(--text-secondary)" }}>
                      {unit?.name ?? entry.unit_id}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: "var(--text-secondary)" }}>
                      {MONTHS[entry.month - 1]} {entry.year}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {fmtMYR(entry.rental_amount)}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {entry.electricity_amount != null ? fmtMYR(entry.electricity_amount) : "-"}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {entry.other_charges_amount != null && entry.other_charges_amount > 0
                        ? fmtMYR(entry.other_charges_amount)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold tabular-nums" style={{ color: "var(--success)" }}>
                      {fmtMYR(entry.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: "var(--text-muted)" }}>
                      {entry.payment_method
                        ? entry.payment_method === "other"
                          ? (entry.custom_payment_method ?? "Other")
                          : PAYMENT_METHOD_LABEL[entry.payment_method]
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold" style={{ color: statusColors.text }}>
                      {PAYMENT_STATUS_LABEL[entry.payment_status ?? "pending"]}
                    </td>
                    <td
                      className="px-4 py-3 text-center font-semibold"
                      style={{ color: entry.invoice_generated ? "var(--success)" : "var(--warning)" }}
                    >
                      {entry.invoice_generated ? "Generated" : "Pending"}
                    </td>
                    <td
                      className="px-3 py-3 sticky right-0 z-[1]"
                      style={{ background: "var(--surface)", borderLeft: "1px solid var(--border-soft)" }}
                    >
                      <div className="flex items-center justify-center">
                        <RowActionMenu
                          ariaLabel="Revenue actions"
                          items={[
                            {
                              label: "Edit",
                              onClick: () =>
                                setDrawer({
                                  open: true,
                                  unitId: entry.unit_id,
                                  month: entry.month - 1,
                                  year: entry.year,
                                }),
                            },
                            { label: "Delete", danger: true, onClick: () => handleDelete(entry.id, label) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "var(--surface-muted)" }}>
              <tr className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                <td colSpan={6} className="px-5 py-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Total ({filtered.length} {filtered.length === 1 ? "entry" : "entries"})
                </td>
                <td className="px-4 py-3 text-center font-bold tabular-nums" style={{ color: "var(--success)" }}>
                  {fmtMYR(totalRevenue)}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPage={setPage}
          unit="entry"
          unitPlural="entries"
        />
      )}

      <RevenueEntryDrawer
        open={drawer.open}
        onClose={() => setDrawer({ open: false })}
        propertyId={property.id}
        lockProperty
        unitId={drawer.open ? drawer.unitId : undefined}
        preselectedMonth={drawer.open ? drawer.month : undefined}
        preselectedYear={drawer.open ? drawer.year : undefined}
      />
    </div>
  );
}
