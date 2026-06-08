"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import {
  MONTHS,
  MONTHS_FULL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  type PaymentStatus,
  type RevenueEntry,
} from "@/types/rental";
import { todayIso } from "@/lib/date";

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

function makeInvoiceNumber(e: RevenueEntry) {
  const mm = String(e.month).padStart(2, "0");
  const suffix = e.unit_id.slice(-4).toUpperCase();
  return `INV-${e.year}${mm}-${suffix}`;
}

function invoiceNumber(e: RevenueEntry) {
  return e.invoice_number || makeInvoiceNumber(e);
}

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type InvoiceLine = { label: string; detail?: string; amount: number };

type InvoiceData = {
  number: string;
  issueDate: string;
  period: string;
  billToName: string;
  billToUnit: string;
  propertyName: string;
  propertyAddress: string;
  lines: InvoiceLine[];
  total: number;
  paymentStatus: string;
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
};

function renderInvoiceHtml(d: InvoiceData) {
  const currency = (n: number) =>
    new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
      minimumFractionDigits: 2,
    }).format(n);

  const lineRows = d.lines
    .map(
      (l) => `
        <tr>
          <td>
            <div class="line-label">${esc(l.label)}</div>
            ${l.detail ? `<div class="line-detail">${esc(l.detail)}</div>` : ""}
          </td>
          <td class="amount">${esc(currency(l.amount))}</td>
        </tr>`
    )
    .join("");

  const meta: Array<[string, string]> = [];
  if (d.paymentDate) meta.push(["Paid On", d.paymentDate]);
  if (d.paymentMethod) meta.push(["Method", d.paymentMethod]);
  const metaHtml = meta.length
    ? `<div class="meta-grid">${meta
        .map(
          ([k, v]) =>
            `<div><div class="meta-k">${esc(k)}</div><div class="meta-v">${esc(v)}</div></div>`
        )
        .join("")}</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(d.number)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #f3f4f6; color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px; line-height: 1.5; }
  .sheet { background: #fff; max-width: 760px; margin: 32px auto; padding: 48px 56px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-radius: 6px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start;
    padding-bottom: 24px; border-bottom: 2px solid #111827; }
  .brand h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
  .brand p { margin: 4px 0 0; color: #6b7280; font-size: 12px; }
  .doc-meta { text-align: right; }
  .doc-meta .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; }
  .doc-meta .number { font-family: "SF Mono", Menlo, Consolas, monospace;
    font-size: 16px; font-weight: 600; margin-top: 2px; }
  .doc-meta .issue { font-size: 12px; color: #6b7280; margin-top: 6px; }
  .status { display: inline-block; padding: 4px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 10px; }
  .status-paid { background: #d1fae5; color: #065f46; }
  .status-partial { background: #fef3c7; color: #92400e; }
  .status-pending { background: #e0e7ff; color: #3730a3; }
  .status-overdue { background: #fee2e2; color: #991b1b; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin: 32px 0; }
  .party .heading { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px;
    color: #6b7280; margin-bottom: 6px; }
  .party .name { font-weight: 600; font-size: 14px; }
  .party .sub { color: #6b7280; font-size: 12px; margin-top: 2px; }
  .period { padding: 12px 16px; background: #f9fafb; border-left: 3px solid #111827;
    border-radius: 0 4px 4px 0; margin-bottom: 24px; }
  .period .heading { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; }
  .period .value { font-weight: 600; margin-top: 2px; }
  table.lines { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.lines th { text-align: left; font-size: 10px; text-transform: uppercase;
    letter-spacing: 1.5px; color: #6b7280; padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb; }
  table.lines th.amount { text-align: right; }
  table.lines td { padding: 14px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  table.lines td.amount { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .line-label { font-weight: 500; }
  .line-detail { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .totals { display: flex; justify-content: flex-end; margin-top: 16px; }
  .totals-box { min-width: 260px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 12px; font-size: 13px; }
  .totals-row.grand { border-top: 2px solid #111827; margin-top: 4px; padding-top: 12px;
    font-size: 16px; font-weight: 700; }
  .totals-row .amt { font-variant-numeric: tabular-nums; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    padding: 16px; background: #f9fafb; border-radius: 4px; margin-top: 32px; }
  .meta-k { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; }
  .meta-v { font-weight: 500; margin-top: 2px; }
  .notes { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  .notes .heading { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px;
    color: #6b7280; margin-bottom: 6px; }
  .notes p { margin: 0; color: #374151; white-space: pre-wrap; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb;
    text-align: center; font-size: 11px; color: #9ca3af; }
  .toolbar { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; }
  .toolbar button { padding: 8px 14px; font-size: 12px; font-weight: 500; cursor: pointer;
    border-radius: 4px; border: 1px solid #d1d5db; background: #fff; }
  .toolbar button.primary { background: #111827; color: #fff; border-color: #111827; }
  @media print {
    body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; max-width: none; padding: 32px 40px; border-radius: 0; }
    .toolbar { display: none; }
    @page { size: A4; margin: 12mm; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.close()">Close</button>
    <button class="primary" onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        <h1>INVOICE</h1>
        <p>Chua Enterprise</p>
      </div>
      <div class="doc-meta">
        <div class="label">Invoice #</div>
        <div class="number">${esc(d.number)}</div>
        <div class="issue">Issued ${esc(d.issueDate)}</div>
        <div class="status status-${esc(d.paymentStatus.toLowerCase())}">${esc(d.paymentStatus)}</div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="heading">Bill To</div>
        <div class="name">${esc(d.billToName)}</div>
        <div class="sub">${esc(d.billToUnit)}</div>
      </div>
      <div class="party">
        <div class="heading">Property</div>
        <div class="name">${esc(d.propertyName)}</div>
        <div class="sub">${esc(d.propertyAddress)}</div>
      </div>
    </div>

    <div class="period">
      <div class="heading">Billing Period</div>
      <div class="value">${esc(d.period)}</div>
    </div>

    <table class="lines">
      <thead>
        <tr>
          <th>Description</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="totals-row grand">
          <span>Total Due</span>
          <span class="amt">${esc(currency(d.total))}</span>
        </div>
      </div>
    </div>

    ${metaHtml}

    ${d.notes ? `<div class="notes"><div class="heading">Notes</div><p>${esc(d.notes)}</p></div>` : ""}

    <div class="footer">
      Thank you for your business.
    </div>
  </div>
  <script>
    window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 200); });
  </script>
</body>
</html>`;
}

function openInvoiceWindow(data: InvoiceData) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(renderInvoiceHtml(data));
  w.document.close();
}

export default function InvoicesPage() {
  const {
    revenueEntries,
    visibleProperties,
    tenants,
    getUnit,
    updateRevenueEntry,
  } = useRental();

  const [fromMonth, setFromMonth] = useState(toMonthInput(CUR_YEAR, 1));
  const [toMonth, setToMonth] = useState(toMonthInput(CUR_YEAR, 12));
  const [search, setSearch] = useState("");
  const [filterProp, setFilterProp] = useState("all");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewing, setViewing] = useState<RevenueEntry | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const confirm = useConfirm();

  const unitOptions =
    filterProp === "all"
      ? []
      : revenueEntries
          .filter((e) => e.property_id === filterProp)
          .reduce<{ id: string; name: string }[]>((acc, e) => {
            if (!acc.find((x) => x.id === e.unit_id)) {
              const u = getUnit(e.unit_id);
              acc.push({ id: e.unit_id, name: u?.name ?? e.unit_id });
            }
            return acc;
          }, []);

  const filtered = useMemo(() => {
    const from = parseMonthInput(fromMonth);
    const to = parseMonthInput(toMonth);
    const q = search.trim().toLowerCase();

    return revenueEntries
      .filter((e) => {
        if (from && monthKey(e.year, e.month) < monthKey(from.y, from.m)) return false;
        if (to && monthKey(e.year, e.month) > monthKey(to.y, to.m)) return false;
        return true;
      })
      .filter((e) => filterProp === "all" || e.property_id === filterProp)
      .filter((e) => filterUnit === "all" || e.unit_id === filterUnit)
      .filter((e) => filterStatus === "all" || e.payment_status === filterStatus)
      .filter((e) => {
        if (!q) return true;
        const prop = visibleProperties.find((p) => p.id === e.property_id);
        const unit = getUnit(e.unit_id);
        return (
          invoiceNumber(e).toLowerCase().includes(q) ||
          (prop?.name ?? "").toLowerCase().includes(q) ||
          (unit?.name ?? "").toLowerCase().includes(q) ||
          (unit?.tenant_name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        if (a.property_id !== b.property_id)
          return a.property_id.localeCompare(b.property_id);
        return a.unit_id.localeCompare(b.unit_id);
      });
  }, [
    revenueEntries,
    fromMonth,
    toMonth,
    search,
    filterProp,
    filterUnit,
    filterStatus,
    visibleProperties,
    getUnit,
  ]);

  const totalBilled = filtered.reduce((s, e) => s + e.total_amount, 0);
  const totalOutstanding = filtered
    .filter((e) => e.payment_status !== "paid")
    .reduce((s, e) => s + e.total_amount, 0);

  const resetKey = `${fromMonth}|${toMonth}|${search}|${filterProp}|${filterUnit}|${filterStatus}`;
  const { page, setPage, totalPages, total, pageSize, pageItems } = usePagination(filtered, 10, resetKey);

  function propertyName(entry: RevenueEntry) {
    return visibleProperties.find((p) => p.id === entry.property_id)?.name ?? entry.property_id;
  }

  function tenantFor(entry: RevenueEntry) {
    return tenants.find((tenant) => tenant.unit_id === entry.unit_id);
  }

  async function downloadInvoice(entry: RevenueEntry) {
    const unit = getUnit(entry.unit_id);
    const prop = visibleProperties.find((p) => p.id === entry.property_id);
    const number = invoiceNumber(entry);
    setActionError(null);
    try {
      await updateRevenueEntry(entry.id, {
        invoice_generated: true,
        invoice_number: number,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save invoice number to Notion.");
      return;
    }
    const lines: InvoiceLine[] = [
      { label: "Monthly Rental", amount: entry.rental_amount },
    ];
    if (entry.electricity_amount != null && entry.electricity_amount > 0) {
      lines.push({
        label: "Electricity",
        detail: entry.electricity_units != null ? `${entry.electricity_units} units` : undefined,
        amount: entry.electricity_amount,
      });
    }
    if (entry.other_charges_amount != null && entry.other_charges_amount > 0) {
      lines.push({ label: "Other Charges", amount: entry.other_charges_amount });
    }
    const status = entry.payment_status ?? "pending";
    openInvoiceWindow({
      number,
      issueDate: todayIso(),
      period: `${MONTHS_FULL[entry.month - 1]} ${entry.year}`,
      billToName: unit?.tenant_name ?? "-",
      billToUnit: unit?.name ?? entry.unit_id,
      propertyName: prop?.name ?? entry.property_id,
      propertyAddress: prop?.address ?? "",
      lines,
      total: entry.total_amount,
      paymentStatus: PAYMENT_STATUS_LABEL[status],
      paymentDate: entry.payment_date || undefined,
      paymentMethod: entry.payment_method
        ? entry.payment_method === "other"
          ? (entry.custom_payment_method ?? "Other")
          : PAYMENT_METHOD_LABEL[entry.payment_method]
        : undefined,
      notes: entry.notes || undefined,
    });
  }

  async function sendInvoice(entry: RevenueEntry) {
    const tenant = tenantFor(entry);
    const unit = getUnit(entry.unit_id);
    const number = invoiceNumber(entry);
    const { confirmed } = await confirm({
      title: tenant?.email ? "Send invoice" : "No tenant email",
      message: tenant?.email
        ? `Open an email draft for ${tenant.email}? You will confirm sent status after sending.`
        : "This unit does not have a tenant email in Notion. Mark the invoice as sent only after sending it manually?",
      confirmLabel: tenant?.email ? "Open draft" : "Mark sent",
    });
    if (!confirmed) return;
    setActionError(null);
    try {
      await updateRevenueEntry(entry.id, {
        invoice_generated: true,
        invoice_number: number,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save invoice number to Notion.");
      return;
    }
    if (tenant?.email) {
      const subject = encodeURIComponent(`Invoice ${number} - ${MONTHS_FULL[entry.month - 1]} ${entry.year}`);
      const body = encodeURIComponent(
        `Hi ${tenant.name},\n\nPlease find invoice ${number} for ${unit?.name ?? "your unit"}.\n\nTotal amount: ${fmt(entry.total_amount)}\n\nThank you.`
      );
      window.location.href = `mailto:${tenant.email}?subject=${subject}&body=${body}`;
      const sent = await confirm({
        title: "Mark invoice as sent?",
        message: `Only mark ${number} as sent after you sent the email draft.`,
        confirmLabel: "Mark sent",
      });
      if (!sent.confirmed) return;
    }
    try {
      await updateRevenueEntry(entry.id, {
        invoice_generated: true,
        invoice_number: number,
        invoice_sent: true,
        invoice_sent_at: todayIso(),
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not mark invoice as sent in Notion.");
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Invoices
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Auto-generated from rental revenue entries — ready to view, download, or send.
          </p>
        </div>
      </div>

      {actionError && (
        <div className="ui-card px-4 py-3 flex items-center justify-between gap-3" style={{ borderColor: "var(--danger)", background: "rgba(211,84,84,0.08)" }}>
          <p className="text-sm" style={{ color: "var(--danger)" }}>{actionError}</p>
          <button type="button" className="ui-btn" onClick={() => setActionError(null)}>Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="ui-card p-4 flex flex-wrap gap-3 items-center">
        <input
          type="month"
          className="ui-input w-auto"
          value={fromMonth}
          onChange={(e) => setFromMonth(e.target.value)}
          aria-label="From month"
        />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
        <input
          type="month"
          className="ui-input w-auto"
          value={toMonth}
          onChange={(e) => setToMonth(e.target.value)}
          aria-label="To month"
        />

        <input
          type="search"
          className="ui-input w-auto min-w-[200px] flex-1 max-w-[260px]"
          placeholder="Search invoice #, property, unit, tenant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <Select
          className="w-auto min-w-[160px]"
          ariaLabel="Filter by property"
          value={filterProp}
          onChange={(v) => {
            setFilterProp(v);
            setFilterUnit("all");
          }}
          options={[
            { value: "all", label: "All Properties" },
            ...visibleProperties.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />

        {filterProp !== "all" && unitOptions.length > 0 && (
          <Select
            className="w-auto min-w-[140px]"
            ariaLabel="Filter by unit"
            value={filterUnit}
            onChange={setFilterUnit}
            options={[
              { value: "all", label: "All Units" },
              ...unitOptions.map((u) => ({ value: u.id, label: u.name })),
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

        <div className="ml-auto flex items-center gap-4 text-sm font-semibold">
          <span style={{ color: "var(--danger)" }}>
            Outstanding: {fmt(totalOutstanding)}
          </span>
          <span style={{ color: "var(--text-primary)" }}>
            Billed: {fmt(totalBilled)}
          </span>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="ui-card p-12 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No invoices found. Enter rental revenue first - invoices are
            auto-generated from revenue entries.
          </p>
        </div>
      ) : (
        <div className="ui-card overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead style={{ background: "var(--surface-muted)" }}>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="text-left text-xs uppercase tracking-wider px-5 py-3">
                  Invoice #
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Property
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Unit
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Tenant
                </th>
                <th className="text-left text-xs uppercase tracking-wider px-4 py-3">
                  Period
                </th>
                <th className="text-right text-xs uppercase tracking-wider px-4 py-3">
                  Amount
                </th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-center text-xs uppercase tracking-wider px-4 py-3">
                  Delivery
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((entry) => {
                const prop = visibleProperties.find(
                  (p) => p.id === entry.property_id
                );
                const unit = getUnit(entry.unit_id);
                const statusColors =
                  STATUS_COLORS[entry.payment_status ?? "pending"];
                return (
                  <tr
                    key={entry.id}
                    className="border-t hover:bg-[var(--surface-muted)] transition-colors"
                    style={{ borderColor: "var(--border-soft)" }}
                  >
                    <td
                      className="px-5 py-3 font-mono text-xs"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {invoiceNumber(entry)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/properties/${entry.property_id}`}
                        className="font-medium hover:underline"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {prop?.name ?? entry.property_id}
                      </Link>
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {unit?.name ?? entry.unit_id}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {unit?.tenant_name ?? "-"}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {MONTHS[entry.month - 1]} {entry.year}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-semibold tabular-nums"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {fmt(entry.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: statusColors.bg,
                          color: statusColors.text,
                        }}
                      >
                        {PAYMENT_STATUS_LABEL[entry.payment_status ?? "pending"]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.invoice_sent ? (
                        <span className="ui-chip ui-chip-success text-xs">
                          Sent{entry.invoice_sent_at ? ` ${entry.invoice_sent_at}` : ""}
                        </span>
                      ) : (
                        <span className="ui-chip text-xs">Not sent</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewing(entry)}
                          className="w-7 h-7 rounded flex items-center justify-center transition border border-[var(--border)] hover:bg-[var(--surface-subtle)]"
                          title="View"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadInvoice(entry)}
                          className="w-7 h-7 rounded flex items-center justify-center transition border border-[var(--border)] hover:bg-[var(--surface-subtle)]"
                          title="Download PDF"
                          style={{ color: "var(--accent)" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <path d="M7 10l5 5 5-5" />
                            <path d="M12 15V3" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => sendInvoice(entry)}
                          className="w-7 h-7 rounded flex items-center justify-center transition border border-[var(--border)] hover:bg-[var(--surface-subtle)]"
                          title="Send invoice"
                          style={{ color: entry.invoice_sent ? "var(--success)" : "var(--text-muted)" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 2 11 13" />
                            <path d="m22 2-7 20-4-9-9-4Z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "var(--surface-muted)" }}>
              <tr
                className="border-t"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <td
                  colSpan={5}
                  className="px-5 py-3 text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Total ({filtered.length}{" "}
                  {filtered.length === 1 ? "invoice" : "invoices"})
                </td>
                <td
                  className="px-4 py-3 text-right font-bold tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {fmt(totalBilled)}
                </td>
                <td colSpan={3} />
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
        />
      )}

      {viewing && (
        <InvoiceViewModal
          entry={viewing}
          onDownload={() => downloadInvoice(viewing)}
          onSend={() => sendInvoice(viewing)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function InvoiceViewModal({
  entry,
  onDownload,
  onSend,
  onClose,
}: {
  entry: RevenueEntry;
  onDownload: () => void;
  onSend: () => void;
  onClose: () => void;
}) {
  const { getProperty, getUnit } = useRental();
  const prop = getProperty(entry.property_id);
  const unit = getUnit(entry.unit_id);
  const statusColors = STATUS_COLORS[entry.payment_status ?? "pending"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="ui-card w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between p-6 border-b"
          style={{ borderColor: "var(--border-soft)" }}
        >
          <div>
            <p
              className="text-xs uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Invoice
            </p>
            <p
              className="font-mono text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {invoiceNumber(entry)}
            </p>
          </div>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: statusColors.bg,
              color: statusColors.text,
            }}
          >
            {PAYMENT_STATUS_LABEL[entry.payment_status ?? "pending"]}
          </span>
        </div>

        <div className="p-6 flex flex-col gap-5 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p
                className="text-xs uppercase tracking-wider mb-1"
                style={{ color: "var(--text-faint)" }}
              >
                Bill To
              </p>
              <p
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {unit?.tenant_name ?? "-"}
              </p>
              <p style={{ color: "var(--text-muted)" }}>
                {unit?.name ?? entry.unit_id}
              </p>
            </div>
            <div>
              <p
                className="text-xs uppercase tracking-wider mb-1"
                style={{ color: "var(--text-faint)" }}
              >
                Property
              </p>
              <p
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {prop?.name ?? entry.property_id}
              </p>
              <p style={{ color: "var(--text-muted)" }}>
                {prop?.address ?? ""}
              </p>
            </div>
          </div>

          <div>
            <p
              className="text-xs uppercase tracking-wider mb-1"
              style={{ color: "var(--text-faint)" }}
            >
              Billing Period
            </p>
            <p style={{ color: "var(--text-primary)" }}>
              {MONTHS_FULL[entry.month - 1]} {entry.year}
            </p>
          </div>

          <div
            className="border-t pt-4"
            style={{ borderColor: "var(--border-soft)" }}
          >
            <p
              className="text-xs uppercase tracking-wider mb-3"
              style={{ color: "var(--text-faint)" }}
            >
              Charges
            </p>
            <ul className="flex flex-col gap-2">
              <li className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Rental</span>
                <span
                  className="tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {fmt(entry.rental_amount)}
                </span>
              </li>
              {entry.electricity_amount != null &&
                entry.electricity_amount > 0 && (
                  <li className="flex justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>
                      Electricity
                      {entry.electricity_units != null
                        ? ` (${entry.electricity_units} units)`
                        : ""}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {fmt(entry.electricity_amount)}
                    </span>
                  </li>
                )}
              {entry.other_charges_amount != null &&
                entry.other_charges_amount > 0 && (
                  <li className="flex justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>
                      Other charges
                    </span>
                    <span
                      className="tabular-nums"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {fmt(entry.other_charges_amount)}
                    </span>
                  </li>
                )}
            </ul>
            <div
              className="flex justify-between mt-4 pt-3 border-t font-semibold"
              style={{ borderColor: "var(--border-soft)" }}
            >
              <span style={{ color: "var(--text-primary)" }}>Total</span>
              <span
                className="tabular-nums"
                style={{ color: "var(--success)" }}
              >
                {fmt(entry.total_amount)}
              </span>
            </div>
          </div>

          {(entry.payment_date || entry.payment_method) && (
            <div
              className="border-t pt-4 grid grid-cols-2 gap-4"
              style={{ borderColor: "var(--border-soft)" }}
            >
              {entry.payment_date && (
                <div>
                  <p
                    className="text-xs uppercase tracking-wider mb-1"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Paid On
                  </p>
                  <p style={{ color: "var(--text-primary)" }}>
                    {entry.payment_date}
                  </p>
                </div>
              )}
              {entry.payment_method && (
                <div>
                  <p
                    className="text-xs uppercase tracking-wider mb-1"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Method
                  </p>
                  <p style={{ color: "var(--text-primary)" }}>
                    {entry.payment_method === "other"
                      ? (entry.custom_payment_method ?? "Other")
                      : PAYMENT_METHOD_LABEL[entry.payment_method]}
                  </p>
                </div>
              )}
            </div>
          )}

          {entry.notes && (
            <div
              className="border-t pt-4"
              style={{ borderColor: "var(--border-soft)" }}
            >
              <p
                className="text-xs uppercase tracking-wider mb-1"
                style={{ color: "var(--text-faint)" }}
              >
                Notes
              </p>
              <p style={{ color: "var(--text-secondary)" }}>{entry.notes}</p>
            </div>
          )}
        </div>

        <div
          className="flex justify-end gap-2 p-4 border-t"
          style={{ borderColor: "var(--border-soft)" }}
        >
          <button
            type="button"
            onClick={onDownload}
            className="ui-btn"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={onSend}
            className="ui-btn"
          >
            {entry.invoice_sent ? "Send Again" : "Send"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
