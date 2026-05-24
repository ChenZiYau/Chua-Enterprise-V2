"use client";

import { usePathname } from "next/navigation";
import { IconBell, IconSearch } from "./icons";

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

  return (
    <header
      className="flex items-center gap-6 px-6 lg:px-8 py-5 border-b sticky top-0 z-10"
      style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="flex-1 max-w-md relative hidden md:block">
        <IconSearch
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "var(--text-faint)" } as React.CSSProperties}
        />
        <input className="ui-input" placeholder="Search properties, tenants, invoices…" />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <button
          aria-label="Notifications"
          className="w-10 h-10 rounded-full flex items-center justify-center relative"
          style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
        >
          <IconBell className="w-[18px] h-[18px]" />
          <span
            className="absolute top-2 right-2.5 w-2 h-2 rounded-full"
            style={{ background: "var(--danger)" }}
          />
        </button>
        <div className="flex items-center gap-2.5 pl-2">
          <div
            className="w-9 h-9 rounded-full"
            style={{ background: "linear-gradient(135deg, #c8c4b8, #8a8478)" }}
          />
          <div className="hidden md:block">
            <p className="text-sm font-medium leading-tight" style={{ color: "var(--text-primary)" }}>Admin User</p>
            <p className="text-xs leading-tight" style={{ color: "var(--text-muted)" }}>admin@chua.co</p>
          </div>
        </div>
      </div>
    </header>
  );
}
