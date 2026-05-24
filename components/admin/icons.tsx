import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const IconDashboard = (p: IconProps) => (
  <svg {...base} {...p}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
);
export const IconProperties = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/><path d="M10 21v-6h4v6"/></svg>
);
export const IconRevenue = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 17l5-5 4 3 8-9"/><path d="M14 6h6v6"/></svg>
);
export const IconExpenses = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 7l5 5 4-3 8 9"/><path d="M20 18h-6v-6"/></svg>
);
export const IconInvoices = (p: IconProps) => (
  <svg {...base} {...p}><path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 12h6M9 16h6M9 8h3"/></svg>
);
export const IconTenants = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c0-2.6 1.4-4.6 4-5"/></svg>
);
export const IconMaintenance = (p: IconProps) => (
  <svg {...base} {...p}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.1-2.1z"/></svg>
);
export const IconReports = (p: IconProps) => (
  <svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 14v3M12 10v7M16 13v4"/></svg>
);
export const IconSettings = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.13.31.2.65.2 1"/></svg>
);
export const IconLogout = (p: IconProps) => (
  <svg {...base} {...p}><path d="M15 17l5-5-5-5"/><path d="M20 12H9"/><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/></svg>
);
export const IconSearch = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
);
export const IconBell = (p: IconProps) => (
  <svg {...base} {...p}><path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>
);
export const IconArrowUp = (p: IconProps) => (
  <svg {...base} {...p}><path d="M7 17 17 7M9 7h8v8"/></svg>
);
export const IconArrowDown = (p: IconProps) => (
  <svg {...base} {...p}><path d="M17 7 7 17M15 17H7V9"/></svg>
);
