"use client";

import { useMemo, useState } from "react";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { DatePickerField } from "@/components/ui/DatePicker";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { RowActionMenu } from "@/components/ui/RowActionMenu";
import { RevenueEntryDrawer } from "@/components/property/RevenueEntryDrawer";
import { MONTHS, type Property, type RevenueEntry } from "@/types/rental";
import { fmtMYR } from "@/lib/ledger";
import {
  buildReceiptData,
  computeReceiptNo,
  openReceiptWindow,
  receiptNo as storedReceiptNo,
} from "@/lib/receipt";

const CUR_YEAR = new Date().getFullYear();

function monthKey(y: number, m: number) {
  return y * 100 + m;
}
function parseMonthInput(s: string): { y: number; m: number } | null {
  if (!s) return null;
  const [y, m] = s.split("-").map(Number);
  if (!y || !m) return null;
  return { y, m };
}
function toMonthInput(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

type DrawerState = {
  open: boolean;
  unitId?: string;
  month?: number;
  year?: number;
};

/** Invoice (receipt) ledger scoped to a single property — mirrors the admin
 *  Invoices page but drops the property column/filter and adds a room filter. */
export function PropertyInvoiceTab({ property }: { property: Property }) {
  const { revenueEntries, tenants, getProperty, getUnit, getUnitsForProperty, updateRevenueEntry, deleteRevenueEntry } =
    useRental();
  const confirm = useConfirm();

  const isRoom = property.rental_model === "room_rental";
  const rooms = getUnitsForProperty(property.id)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const [fromMonth, setFromMonth] = useState(toMonthInput(CUR_YEAR, 1));
  const [toMonth, setToMonth] = useState(toMonthInput(CUR_YEAR, 12));
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [drawer, setDrawer] = useState<DrawerState>({ open: false });
  const [actionError, setActionError] = useState<string | null>(null);

  const receiptNo = (e: RevenueEntry) =>
    storedReceiptNo(e, getProperty(e.property_id), getUnitsForProperty(e.property_id), revenueEntries);

  const filtered = useMemo(() => {
    const from = parseMonthInput(fromMonth);
    const to = parseMonthInput(toMonth);
    const q = search.trim().toLowerCase();

    return revenueEntries
      .filter((e) => e.property_id === property.id)
      .filter((e) => {
        if (from && monthKey(e.year, e.month) < monthKey(from.y, from.m)) return false;
        if (to && monthKey(e.year, e.month) > monthKey(to.y, to.m)) return false;
        return true;
      })
      .filter((e) => filterUnit === "all" || e.unit_id === filterUnit)
      .filter((e) => filterStatus === "all" || e.payment_status === filterStatus)
      .filter((e) => {
        if (!q) return true;
        const unit = getUnit(e.unit_id);
        return (
          receiptNo(e).toLowerCase().includes(q) ||
          (unit?.name ?? "").toLowerCase().includes(q) ||
          (unit?.tenant_name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return a.unit_id.localeCompare(b.unit_id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revenueEntries, property.id, fromMonth, toMonth, search, filterUnit, filterStatus]);

  const totalBilled = filtered.reduce((s, e) => s + e.total_amount, 0);
  const totalOutstanding = filtered
    .filter((e) => e.payment_status !== "paid")
    .reduce((s, e) => s + e.total_amount, 0);

  const resetKey = `${fromMonth}|${toMonth}|${search}|${filterUnit}|${filterStatus}`;
  const { page, setPage, totalPages, total, pageSize, pageItems } = usePagination(filtered, 10, resetKey);

  function receiptDataFor(entry: RevenueEntry, number: string) {
    const tenantName = tenants.find((t) => t.unit_id === entry.unit_id)?.name;
    return buildReceiptData(entry, getProperty(entry.property_id), getUnit(entry.unit_id), tenantName, number);
  }

  async function generateInvoice(entry: RevenueEntry) {
    const number = computeReceiptNo(entry, getProperty(entry.property_id), getUnitsForProperty(entry.property_id), revenueEntries);
    setActionError(null);
    try {
      await updateRevenueEntry(entry.id, { invoice_generated: true, invoice_number: number });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save receipt number to Notion.");
      return;
    }
    openReceiptWindow(receiptDataFor(entry, number), true);
  }

  function previewInvoice(entry: RevenueEntry) {
    openReceiptWindow(receiptDataFor(entry, receiptNo(entry)), false);
  }

  async function handleDelete(entry: RevenueEntry) {
    const { confirmed } = await confirm({
      title: "Delete invoice?",
      message: `Delete invoice ${receiptNo(entry)}? This also removes its revenue entry and cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteRevenueEntry(entry.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete invoice from Notion.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="ui-card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <DatePickerField
            granularity="month"
            className="w-[150px]"
            value={fromMonth}
            onChange={setFromMonth}
            placeholder="From month"
            ariaLabel="From month"
          />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
          <DatePickerField
            granularity="month"
            className="w-[150px]"
            value={toMonth}
            onChange={setToMonth}
            placeholder="To month"
            ariaLabel="To month"
          />

          <div className="ml-auto flex flex-wrap items-center gap-3">
            {isRoom && rooms.length > 0 && (
              <Select
                className="w-auto min-w-[150px]"
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
            placeholder="Search receipt #, unit, tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ml-auto flex items-center gap-4 text-sm font-semibold">
            <span style={{ color: "var(--danger)" }}>Outstanding: {fmtMYR(totalOutstanding)}</span>
            <span style={{ color: "var(--text-primary)" }}>Billed: {fmtMYR(totalBilled)}</span>
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
            No invoices found. Enter rental revenue first — invoices are auto-generated from revenue entries.
          </p>
        </div>
      ) : (
        <div className="ui-card overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead style={{ background: "var(--surface-muted)" }}>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="text-left text-xs uppercase tracking-wider px-5 py-3">Invoice ID</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Tenant</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Unit</th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">Period</th>
                <th className="text-right text-xs uppercase tracking-wider px-4 py-3">Amount</th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">Invoice Generation</th>
                <th className="text-right text-xs uppercase tracking-wider px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((entry) => {
                const unit = getUnit(entry.unit_id);
                return (
                  <tr
                    key={entry.id}
                    className="border-t hover:bg-[var(--surface-muted)] transition-colors"
                    style={{ borderColor: "var(--border-soft)" }}
                  >
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--text-primary)" }}>
                      {receiptNo(entry)}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                      {unit?.tenant_name ?? "-"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                      {unit?.name ?? entry.unit_id}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                      {MONTHS[entry.month - 1]} {entry.year}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {fmtMYR(entry.total_amount)}
                    </td>
                    <td
                      className="px-4 py-3 text-center font-semibold"
                      style={{ color: entry.invoice_generated ? "var(--success)" : "var(--warning)" }}
                    >
                      {entry.invoice_generated ? "Generated" : "Pending"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => generateInvoice(entry)}
                          className="ui-btn ui-btn-primary text-xs px-3 py-1.5"
                          title="Generate receipt"
                        >
                          Gen
                        </button>
                        <RowActionMenu
                          ariaLabel="Invoice actions"
                          items={[
                            { label: "Preview", onClick: () => previewInvoice(entry) },
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
                            { label: "Delete", danger: true, onClick: () => handleDelete(entry) },
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
                <td colSpan={4} className="px-5 py-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Total ({filtered.length} {filtered.length === 1 ? "invoice" : "invoices"})
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {fmtMYR(totalBilled)}
                </td>
                <td colSpan={2} />
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
          unit="invoice"
          unitPlural="invoices"
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
