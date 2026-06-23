"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import { useMobileNav } from "./MobileNavContext";
import {
  IconDashboard,
  IconProperties,
  IconRevenue,
  IconExpenses,
  IconInvoices,
  IconDeposit,
  IconTenants,
  IconMaintenance,
  IconReports,
  IconSettings,
  IconLogout,
  IconShare,
} from "./icons";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    title: "Management",
    items: [
      { label: "Properties", href: "/admin/properties", icon: IconProperties },
      { label: "Tenants", href: "/admin/tenants", icon: IconTenants },
    ],
  },
  {
    title: "Financials",
    items: [
      { label: "Revenue", href: "/admin/revenue", icon: IconRevenue },
      { label: "Expenses", href: "/admin/expenses", icon: IconExpenses },
      { label: "Invoices", href: "/admin/invoices", icon: IconInvoices },
      { label: "Deposits", href: "/admin/deposits", icon: IconDeposit },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Maintenance", href: "/admin/maintenance", icon: IconMaintenance },
      { label: "Share", href: "/admin/share", icon: IconShare },
    ],
  },
  {
    title: "Analytics",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: IconDashboard },
      { label: "Insights", href: "/admin/insights", icon: IconReports },
      { label: "Reports", href: "/admin/reports", icon: IconReports },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Settings", href: "/admin/settings", icon: IconSettings },
    ],
  },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { open, setOpen } = useMobileNav();
  const [collapsed, setCollapsed] = useState(false);

  // Restore the persisted collapsed state on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.localStorage.getItem("sidebar-collapsed") === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      }
      return next;
    });
  }

  function handleLogout() {
    signOut();
    router.replace("/login");
  }

  // `mini` collapses labels to an icon-only rail (desktop only).
  // `onToggle` renders the collapse control; omitted for the mobile drawer.
  const inner = (mini: boolean, onToggle?: () => void) => (
    <>
      <div
        className={
          "flex pt-1 " +
          (mini ? "flex-col items-center gap-3" : "items-center justify-between gap-2")
        }
      >
        <Link
          href="/admin/properties"
          aria-label="Go to Properties"
          className={"flex items-center min-w-0 rounded-lg transition hover:opacity-80 " + (mini ? "" : "gap-2.5 px-0.5")}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--accent)" }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11 12 4l9 7" />
              <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
            </svg>
          </div>
          {!mini && (
            <span className="text-white font-semibold tracking-tight truncate">Chua Enterprise</span>
          )}
        </Link>

        {/* Collapse / expand toggle - only meaningful on the desktop rail */}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={mini ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!mini}
            title={mini ? "Expand sidebar" : "Collapse sidebar"}
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition hover:bg-[var(--sidebar-muted)] hover:text-white"
            style={{ color: "var(--sidebar-text-muted)" }}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: mini ? "rotate(180deg)" : "none" }}
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto mt-2">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            {mini ? (
              <div
                className="mx-auto my-2 h-px w-6"
                style={{ background: "rgba(255,255,255,0.08)" }}
                aria-hidden
              />
            ) : (
              <p
                className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--sidebar-text-muted)" }}
              >
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="ui-nav-item"
                  data-active={active || undefined}
                  onClick={() => setOpen(false)}
                  title={mini ? item.label : undefined}
                  style={
                    mini
                      ? { justifyContent: "center", paddingLeft: 0, paddingRight: 0 }
                      : undefined
                  }
                >
                  <Icon className="ui-nav-icon" />
                  {!mini && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div
          className={
            "flex items-center py-1 " + (mini ? "justify-center px-0" : "gap-3 px-1.5")
          }
        >
          <div
            className="w-9 h-9 rounded-full shrink-0"
            style={{
              background: "linear-gradient(135deg, #4a4f5b 0%, #2a2d34 100%)",
              border: "2px solid rgba(255,255,255,0.08)",
            }}
          />
          {!mini && (
            <>
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
            </>
          )}
        </div>
        {mini && (
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
            className="w-9 h-9 mx-auto mt-1 rounded-md flex items-center justify-center transition hover:bg-[var(--sidebar-muted)] hover:text-white"
            style={{ color: "var(--sidebar-text-muted)" }}
          >
            <IconLogout className="w-4 h-4" />
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={
          "hidden lg:flex flex-col shrink-0 gap-6 sticky top-0 h-screen transition-all duration-200 ease-out " +
          (collapsed ? "w-[76px] px-2.5 py-5" : "w-[248px] p-5")
        }
        style={{ background: "var(--sidebar)", color: "var(--sidebar-text)" }}
      >
        {inner(collapsed, toggleCollapsed)}
      </aside>

      {/* Mobile overlay */}
      <div
        className={
          "lg:hidden fixed inset-0 z-40 transition-opacity duration-200 " +
          (open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
        }
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Mobile drawer */}
      <aside
        className={
          "lg:hidden fixed top-0 left-0 z-50 flex flex-col w-[260px] max-w-[80vw] h-screen p-5 gap-6 transition-transform duration-200 ease-out " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
        style={{ background: "var(--sidebar)", color: "var(--sidebar-text)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {inner(false)}
      </aside>
    </>
  );
}
