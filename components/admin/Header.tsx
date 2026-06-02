"use client";

import { usePathname } from "next/navigation";
import { IconBell, IconSearch } from "./icons";
import { useMobileNav } from "./MobileNavContext";

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
  { pattern: /^\/admin\/reports/, title: "Reports", subtitle: "Financial and occupancy reports" },
  { pattern: /^\/admin\/settings/, title: "Settings", subtitle: "Workspace settings" },
];

function resolveTitle(pathname: string | null) {
  if (!pathname) return { title: "Dashboard", subtitle: "" };
  for (const entry of titleMap) if (entry.pattern.test(pathname)) return entry;
  return { title: "Dashboard", subtitle: "" };
}

export function Header() {
  const pathname = usePathname();
  const { title, subtitle } = resolveTitle(pathname);
  const { toggle } = useMobileNav();

  return (
    <header
      className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 lg:px-8 py-4 sm:py-5"
      style={{ background: "transparent" }}
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

      <div className="relative w-full max-w-xs hidden md:block">
        <IconSearch
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "var(--text-faint)" } as React.CSSProperties}
        />
        <input className="ui-input" placeholder="Search properties, tenants, invoices…" />
      </div>

      <button
        aria-label="Notifications"
        className="w-10 h-10 rounded-full flex items-center justify-center relative shrink-0"
        style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
      >
        <IconBell className="w-[18px] h-[18px]" />
        <span
          className="absolute top-2 right-2.5 w-2 h-2 rounded-full"
          style={{ background: "var(--danger)" }}
        />
      </button>
    </header>
  );
}
