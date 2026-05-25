"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import {
  IconDashboard,
  IconProperties,
  IconRevenue,
  IconExpenses,
  IconInvoices,
  IconTenants,
  IconMaintenance,
  IconReports,
  IconSettings,
  IconLogout,
} from "./icons";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const items: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: IconDashboard },
  { label: "Properties", href: "/admin/properties", icon: IconProperties },
  { label: "Revenue", href: "/admin/revenue", icon: IconRevenue },
  { label: "Expenses", href: "/admin/expenses", icon: IconExpenses },
  { label: "Invoices", href: "/admin/invoices", icon: IconInvoices },
  { label: "Tenants", href: "/admin/tenants", icon: IconTenants },
  { label: "Maintenance", href: "/admin/maintenance", icon: IconMaintenance },
  { label: "Reports", href: "/admin/reports", icon: IconReports },
  { label: "Settings", href: "/admin/settings", icon: IconSettings },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    signOut();
    router.replace("/login");
  }

  return (
    <aside
      className="hidden lg:flex flex-col w-[248px] shrink-0 p-5 gap-6 sticky top-0 h-screen"
      style={{ background: "var(--sidebar)", color: "var(--sidebar-text)" }}
    >
      <div className="flex items-center gap-2.5 px-1.5 pt-1">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "var(--accent)" }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11 12 4l9 7" />
            <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
          </svg>
        </div>
        <span className="text-white font-semibold tracking-tight">Chua Enterprise</span>
      </div>

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto mt-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className="ui-nav-item"
              data-active={active || undefined}
            >
              <Icon className="ui-nav-icon" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3 px-1.5 py-1">
          <div
            className="w-9 h-9 rounded-full shrink-0"
            style={{
              background: "linear-gradient(135deg, #4a4f5b 0%, #2a2d34 100%)",
              border: "2px solid rgba(255,255,255,0.08)",
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate leading-tight">Admin User</p>
            <p
              className="text-[11px] truncate leading-tight mt-0.5"
              style={{ color: "var(--sidebar-text-muted)" }}
            >
              admin@chua.co
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition hover:bg-[var(--sidebar-muted)] hover:text-white"
            style={{ color: "var(--sidebar-text-muted)" }}
          >
            <IconLogout className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
