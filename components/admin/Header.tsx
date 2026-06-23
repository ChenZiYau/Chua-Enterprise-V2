"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconBell, IconSearch } from "./icons";
import { useMobileNav } from "./MobileNavContext";
import { useRental } from "@/context/RentalContext";
import { MONTHS, PAYMENT_STATUS_LABEL } from "@/types/rental";
import { startOfDay, todayIso } from "@/lib/date";

const titleMap: { pattern: RegExp; title: string; subtitle: string }[] = [
  { pattern: /^\/admin\/?$/, title: "Dashboard", subtitle: "Property management overview" },
  { pattern: /^\/admin\/properties\/new/, title: "Add Property", subtitle: "Create a new rental property" },
  { pattern: /^\/admin\/properties\/[^/]+/, title: "Property", subtitle: "Property details" },
  { pattern: /^\/admin\/properties/, title: "Properties", subtitle: "Manage rental properties, rooms, revenue, expenses, and occupancy" },
  { pattern: /^\/admin\/revenue/, title: "Revenue", subtitle: "Record and review property income" },
  { pattern: /^\/admin\/expenses/, title: "Expenses", subtitle: "Track property expenses" },
  { pattern: /^\/admin\/invoices/, title: "Invoices", subtitle: "Tenant invoices and billing" },
  { pattern: /^\/admin\/tenants/, title: "Tenants", subtitle: "Manage tenants and leases" },
  { pattern: /^\/admin\/maintenance/, title: "Maintenance", subtitle: "Service requests and work orders" },
  { pattern: /^\/admin\/insights/, title: "Insights", subtitle: "Important alerts and portfolio health" },
  { pattern: /^\/admin\/reports/, title: "Reports", subtitle: "Financial and occupancy reports" },
  { pattern: /^\/admin\/settings/, title: "Settings", subtitle: "Workspace settings" },
];

function resolveTitle(pathname: string | null) {
  if (!pathname) return { title: "Dashboard", subtitle: "" };
  for (const entry of titleMap) if (entry.pattern.test(pathname)) return entry;
  return { title: "Dashboard", subtitle: "" };
}

type SearchHit = { label: string; sub: string; group: string; href: string };

type NotifItem = {
  id: string;
  kind: "payment" | "lease" | "maintenance" | "revenue" | "invoice";
  title: string;
  detail: string;
  tone: "danger" | "warning";
  href: string;
  cta: string;
  description: string;
  meta: { label: string; value: string }[];
};

function fmtMYR(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

function daysUntil(iso: string) {
  const diff = new Date(`${iso}T00:00:00`).getTime() - new Date(`${todayIso()}T00:00:00`).getTime();
  return Math.round(diff / 86_400_000);
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { title, subtitle } = resolveTitle(pathname);
  const { toggle } = useMobileNav();
  const { visibleProperties, units, tenants, revenueEntries, maintenanceEntries, loadError, getUnit } = useRental();

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // -- Global search results ------------------------------------------
  const results = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (const p of visibleProperties) {
      if (p.name.toLowerCase().includes(q) || (p.address ?? "").toLowerCase().includes(q)) {
        hits.push({ label: p.name, sub: p.address ?? "Property", group: "Properties", href: `/admin/properties/${p.id}` });
      }
    }
    for (const t of tenants) {
      const unit = t.unit_id ? getUnit(t.unit_id) : undefined;
      if (
        t.name.toLowerCase().includes(q) ||
        (t.email ?? "").toLowerCase().includes(q) ||
        (t.phone ?? "").toLowerCase().includes(q) ||
        (t.ic_number ?? "").toLowerCase().includes(q)
      ) {
        hits.push({ label: t.name, sub: unit?.name ?? "Tenant", group: "Tenants", href: `/admin/tenants` });
      }
    }
    for (const u of units) {
      if ((u.name ?? "").toLowerCase().includes(q) || (u.tenant_name ?? "").toLowerCase().includes(q)) {
        hits.push({ label: u.name, sub: u.tenant_name ?? "Vacant", group: "Units", href: `/admin/properties/${u.property_id}` });
      }
    }
    return hits.slice(0, 12);
  }, [query, visibleProperties, tenants, units, getUnit]);

  // -- Notifications derived from real data ---------------------------
  const notifications = useMemo<NotifItem[]>(() => {
    const items: NotifItem[] = [];
    const nowIso = todayIso();
    const now = startOfDay(nowIso).getTime();
    const current = new Date(`${nowIso}T00:00:00`);
    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth() + 1;

    const currentRevenueEntries = revenueEntries.filter((entry) => entry.year === currentYear && entry.month === currentMonth);
    const thisMonthRevenue = currentRevenueEntries.reduce((sum, entry) => sum + entry.total_amount, 0);
    const lastMonthDate = new Date(currentYear, currentMonth - 2, 1);
    const lastMonthRevenue = revenueEntries
      .filter((entry) => entry.year === lastMonthDate.getFullYear() && entry.month === lastMonthDate.getMonth() + 1)
      .reduce((sum, entry) => sum + entry.total_amount, 0);
    const revenueDelta = lastMonthRevenue ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : null;

    if (revenueDelta == null || revenueDelta < 0) {
      items.push({
        id: "insight-revenue-month",
        kind: "revenue",
        title: "Monthly revenue insight",
        detail:
          revenueDelta == null
            ? `${MONTHS[currentMonth - 1]} ${currentYear}: ${fmtMYR(thisMonthRevenue)} recorded`
            : `${MONTHS[currentMonth - 1]} ${currentYear}: ${fmtMYR(thisMonthRevenue)} (${revenueDelta}% vs last month)`,
        tone: "warning",
        href: "/admin/insights",
        cta: "Open Insights",
        description:
          revenueDelta == null
            ? "There is not enough previous-month revenue data to compare performance yet."
            : `This month is down ${Math.abs(revenueDelta)}% compared with last month.`,
        meta: [
          { label: "This month", value: fmtMYR(thisMonthRevenue) },
          { label: "Last month", value: fmtMYR(lastMonthRevenue) },
          { label: "Entries", value: String(currentRevenueEntries.length) },
        ],
      });
    }

    const invoicesToGenerate = revenueEntries.filter((entry) => !entry.invoice_generated);
    if (invoicesToGenerate.length > 0) {
      items.push({
        id: "invoice-generation-reminder",
        kind: "invoice",
        title: "Generate invoices",
        detail: `${invoicesToGenerate.length} revenue ${invoicesToGenerate.length === 1 ? "entry needs" : "entries need"} invoices`,
        tone: "warning",
        href: "/admin/invoices",
        cta: "Open Invoices",
        description: "Some revenue entries do not have generated invoices yet. Generate them before sending statements to tenants.",
        meta: [
          { label: "Pending invoices", value: String(invoicesToGenerate.length) },
          { label: "Pending amount", value: fmtMYR(invoicesToGenerate.reduce((sum, entry) => sum + entry.total_amount, 0)) },
        ],
      });
    }

    for (const entry of maintenanceEntries) {
      const overdue = entry.status !== "completed" && entry.due_date && startOfDay(entry.due_date).getTime() < now;
      const urgent = entry.status !== "completed" && entry.priority === "urgent";
      if (!overdue && !urgent) continue;
      items.push({
        id: `maint-${entry.id}`,
        kind: "maintenance",
        title: overdue ? "Maintenance overdue" : "Urgent maintenance",
        detail: `${entry.property || "Property"} - ${entry.unit || "Unit"} - ${entry.issue}`,
        tone: overdue ? "danger" : "warning",
        href: "/admin/maintenance",
        cta: "Open Maintenance",
        description: overdue
          ? "This case is past its estimated completion date and has not been completed."
          : "This case is marked urgent and needs attention.",
        meta: [
          { label: "Property", value: entry.property || "-" },
          { label: "Unit", value: entry.unit || "-" },
          { label: "Tenant", value: entry.tenant || "-" },
          { label: "Due date", value: entry.due_date || "-" },
          { label: "Priority", value: entry.priority },
          { label: "Status", value: entry.status.replace(/_/g, " ") },
        ],
      });
    }

    for (const e of revenueEntries) {
      if (e.payment_status === "overdue" || e.payment_status === "pending") {
        const unit = getUnit(e.unit_id);
        const prop = visibleProperties.find((p) => p.id === e.property_id);
        const period = `${MONTHS[e.month - 1]} ${e.year}`;
        items.push({
          id: `pay-${e.id}`,
          kind: "payment",
          title: `Payment ${PAYMENT_STATUS_LABEL[e.payment_status]}`,
          detail: `${prop?.name ?? "Property"}${unit ? ` - ${unit.name}` : ""} - ${period}`,
          tone: e.payment_status === "overdue" ? "danger" : "warning",
          href: "/admin/invoices",
          cta: "Open in Invoices",
          description:
            e.payment_status === "overdue"
              ? `Rent for ${period} is overdue. Follow up with the tenant and record the payment once received.`
              : `Rent for ${period} is still pending. It hasn't been marked as paid yet.`,
          meta: [
            { label: "Property", value: prop?.name ?? "-" },
            { label: "Unit", value: unit?.name ?? "-" },
            { label: "Tenant", value: unit?.tenant_name ?? "-" },
            { label: "Period", value: period },
            { label: "Amount due", value: fmtMYR(e.total_amount) },
            { label: "Status", value: PAYMENT_STATUS_LABEL[e.payment_status] },
          ],
        });
      }
    }
    const in30 = now + 30 * 86_400_000;
    for (const t of tenants) {
      if (!t.lease_end) continue;
      const end = startOfDay(t.lease_end).getTime();
      if (end >= now && end <= in30) {
        const unit = t.unit_id ? getUnit(t.unit_id) : undefined;
        const prop = unit ? visibleProperties.find((p) => p.id === unit.property_id) : undefined;
        const left = daysUntil(t.lease_end);
        items.push({
          id: `lease-${t.id}`,
          kind: "lease",
          title: "Lease ending soon",
          detail: `${t.name} - ends ${t.lease_end}`,
          tone: left <= 7 ? "danger" : "warning",
          href: "/admin/tenants",
          cta: "Open in Tenants",
          description: `${t.name}'s lease ends in ${left} day${left === 1 ? "" : "s"}. Consider arranging a renewal or move-out.`,
          meta: [
            { label: "Tenant", value: t.name },
            { label: "Property", value: prop?.name ?? "-" },
            { label: "Unit", value: unit?.name ?? "-" },
            { label: "Lease ends", value: t.lease_end },
            { label: "Days left", value: `${left} day${left === 1 ? "" : "s"}` },
            { label: "Phone", value: t.phone ?? "-" },
          ],
        });
      }
    }
    // Most urgent first (danger before warning).
    return items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "danger" ? -1 : 1)).slice(0, 20);
  }, [revenueEntries, maintenanceEntries, tenants, visibleProperties, getUnit]);

  const expanded = notifications.find((n) => n.id === expandedId) ?? null;

  // -- Outside-click / Esc handling -----------------------------------
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
        setExpandedId(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMobileSearchOpen(false);
        setNotifOpen(false);
        setExpandedId(null);
      }
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function go(href: string) {
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setNotifOpen(false);
    setExpandedId(null);
    setQuery("");
    router.push(href);
  }

  return (
    <header
      className="sticky top-0 z-30 flex flex-wrap items-center gap-3 sm:gap-4 px-4 sm:px-6 lg:px-8 py-4 sm:py-5"
      style={{
        background: "var(--background)",
        borderBottom: "1px solid var(--border-soft)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label="Open navigation menu"
        className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      <div className="min-w-0 mr-auto">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        {subtitle ? (
          <p className="text-xs sm:text-sm mt-0.5 hidden sm:block" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>

      {/* Global search */}
      <button
        type="button"
        aria-label="Open search"
        onClick={() => {
          setMobileSearchOpen((open) => !open);
          setNotifOpen(false);
          setExpandedId(null);
        }}
        className="md:hidden w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition"
        style={{
          background: mobileSearchOpen ? "var(--accent-soft)" : "var(--surface-muted)",
          color: mobileSearchOpen ? "var(--accent)" : "var(--text-secondary)",
        }}
      >
        <IconSearch className="w-[18px] h-[18px]" />
      </button>

      <div className="relative w-full max-w-xs hidden md:block" ref={searchRef}>
        <IconSearch
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10"
          style={{ color: "var(--text-faint)" } as React.CSSProperties}
        />
        <input
          className="ui-input"
          placeholder="Search properties, tenants, units..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
        />
        {searchOpen && query.trim() && (
          <div
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-xl border overflow-hidden"
            style={{ background: "var(--surface)", borderColor: "var(--border-soft)", boxShadow: "0 16px 40px rgba(0,0,0,0.18)" }}
          >
            {results.length === 0 ? (
              <p className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                No matches for &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1">
                {results.map((r, i) => (
                  <li key={`${r.href}-${i}`}>
                    <button
                      type="button"
                      onClick={() => go(r.href)}
                      className="w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition hover:bg-[var(--surface-muted)]"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {r.label}
                        </span>
                        <span className="block text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {r.sub}
                        </span>
                      </span>
                      <span className="ui-chip shrink-0">{r.group}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {mobileSearchOpen && (
        <div
          className="md:hidden fixed left-3 right-3 top-[72px] z-50 rounded-2xl border overflow-hidden"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border-soft)",
            boxShadow: "0 20px 48px rgba(0,0,0,0.26)",
            animation: "notifIn 180ms cubic-bezier(.2,.7,.2,1) both",
          }}
        >
          <div className="p-3 border-b" style={{ borderColor: "var(--border-soft)" }}>
            <div className="relative flex items-center gap-2">
              <IconSearch
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10"
                style={{ color: "var(--text-faint)" } as React.CSSProperties}
              />
              <input
                autoFocus
                className="ui-input w-full"
                placeholder="Search properties, tenants, units..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="button" className="ui-btn shrink-0" onClick={() => setMobileSearchOpen(false)}>
                Close
              </button>
            </div>
          </div>
          {query.trim() ? (
            results.length === 0 ? (
              <p className="px-4 py-4 text-sm" style={{ color: "var(--text-muted)" }}>
                No matches for &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              <ul className="max-h-[55vh] overflow-y-auto py-1">
                {results.map((r, i) => (
                  <li key={`${r.href}-mobile-${i}`}>
                    <button
                      type="button"
                      onClick={() => go(r.href)}
                      className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 transition hover:bg-[var(--surface-muted)]"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {r.label}
                        </span>
                        <span className="block text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {r.sub}
                        </span>
                      </span>
                      <span className="ui-chip shrink-0">{r.group}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="px-4 py-4 text-sm" style={{ color: "var(--text-muted)" }}>
              Start typing to search your dashboard.
            </p>
          )}
        </div>
      )}

      {/* Notifications */}
      <div className="relative shrink-0" ref={notifRef}>
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => {
            setNotifOpen((o) => !o);
            setExpandedId(null);
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center relative transition"
          style={{
            background: notifOpen ? "var(--accent-soft)" : "var(--surface-muted)",
            color: notifOpen ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          <IconBell className="w-[18px] h-[18px]" />
          {notifications.length > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
              style={{ background: "var(--danger)", boxShadow: "0 0 0 2px var(--surface)" }}
            >
              {notifications.length > 9 ? "9+" : notifications.length}
            </span>
          )}
        </button>

        {notifOpen && (
          <>
            {/* Main panel */}
            <div
              className="absolute right-0 top-[calc(100%+10px)] z-50 w-[420px] max-w-[94vw] rounded-2xl border overflow-hidden flex flex-col"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border-soft)",
                boxShadow: "0 24px 60px rgba(15,17,22,0.22)",
                animation: "notifIn 180ms cubic-bezier(.2,.7,.2,1) both",
              }}
            >
              {/* Gradient header */}
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, var(--surface)) 0%, var(--surface) 100%)",
                  borderBottom: "1px solid var(--border-soft)",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    <IconBell className="w-[16px] h-[16px]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                      Notifications
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {notifications.length} need{notifications.length === 1 ? "s" : ""} attention
                    </p>
                  </div>
                </div>
                {notifications.length > 0 && (
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-1 rounded-full"
                    style={{ background: "var(--danger)", color: "#fff" }}
                  >
                    {notifications.filter((n) => n.tone === "danger").length} urgent
                  </span>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-3xl mb-2">&#127881;</p>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    You&apos;re all caught up
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    No urgent maintenance, invoice reminders, overdue payments, or expiring leases.
                  </p>
                </div>
              ) : (
                <ul className="max-h-[60vh] overflow-y-auto p-2 flex flex-col gap-2">
                  {notifications.map((n) => {
                    const open = expandedId === n.id;
                    const tone = n.tone === "danger" ? "var(--danger)" : "var(--warning)";
                    return (
                      <li
                        key={n.id}
                        className="rounded-xl border transition"
                        style={{
                          borderColor: open ? tone : "var(--border-soft)",
                          background: open ? "var(--surface-muted)" : "var(--surface)",
                        }}
                      >
                        <div className="p-3.5 flex items-start gap-3">
                          <span
                            className="mt-0.5 w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                            style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}
                          >
                            {n.kind === "payment" || n.kind === "revenue" || n.kind === "invoice" ? <CoinIcon /> : <ClockIcon />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                                {n.title}
                              </p>
                              <span
                                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}
                              >
                                {n.tone === "danger" ? "Urgent" : "Soon"}
                              </span>
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {n.detail}
                            </p>
                            <div className="flex items-center gap-2 mt-2.5">
                              <button
                                type="button"
                                onClick={() => go(n.href)}
                                className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                                style={{ background: "var(--accent)", color: "#fff" }}
                              >
                                Bring me there
                                <ArrowIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => setExpandedId(open ? null : n.id)}
                                className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition"
                                style={{
                                  border: "1px solid var(--border-soft)",
                                  color: open ? "var(--accent)" : "var(--text-secondary)",
                                  background: "var(--surface)",
                                }}
                              >
                                {open ? "Hide" : "Show more"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Inline detail (small screens - the side popout is desktop-only) */}
                        {open && (
                          <div
                            className="lg:hidden px-3.5 pb-3.5 -mt-1 flex flex-col gap-3"
                            style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "0.875rem" }}
                          >
                            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                              {n.description}
                            </p>
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                              {n.meta.map((m) => (
                                <div key={m.label} className="min-w-0">
                                  <dt className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                                    {m.label}
                                  </dt>
                                  <dd className="text-sm font-medium mt-0.5 truncate" style={{ color: "var(--text-primary)" }}>
                                    {m.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Connected detail popout - sits to the left of the panel */}
            {expanded && (
              <div
                className="absolute top-[calc(100%+10px)] z-50 w-[320px] max-w-[92vw] rounded-2xl border overflow-hidden hidden lg:block"
                style={{
                  right: "434px",
                  background: "var(--surface)",
                  borderColor: expanded.tone === "danger" ? "var(--danger)" : "var(--warning)",
                  boxShadow: "0 24px 60px rgba(15,17,22,0.22)",
                  animation: "popoutIn 200ms cubic-bezier(.2,.7,.2,1) both",
                }}
              >
                <div
                  className="px-5 py-4"
                  style={{
                    background: `color-mix(in srgb, ${expanded.tone === "danger" ? "var(--danger)" : "var(--warning)"} 10%, var(--surface))`,
                    borderBottom: "1px solid var(--border-soft)",
                  }}
                >
                  <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
                    Details
                  </p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
                    {expanded.title}
                  </p>
                </div>
                <div className="p-5 flex flex-col gap-4">
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {expanded.description}
                  </p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {expanded.meta.map((m) => (
                      <div key={m.label} className="min-w-0">
                        <dt className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                          {m.label}
                        </dt>
                        <dd className="text-sm font-medium mt-0.5 truncate" style={{ color: "var(--text-primary)" }}>
                          {m.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    type="button"
                    onClick={() => go(expanded.href)}
                    className="w-full text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    {expanded.cta}
                    <ArrowIcon />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes notifIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes popoutIn {
          from { opacity: 0; transform: translateX(10px) scale(0.98); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }
      `}</style>
      {loadError && (
        <div className="basis-full rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(211,84,84,0.08)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
          Data did not load: {loadError}
        </div>
      )}
    </header>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 5 0c0 1.5-2.5 1.5-2.5 2.5s2.5 1 2.5 2.5a2.5 2 0 0 1-5 0" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
