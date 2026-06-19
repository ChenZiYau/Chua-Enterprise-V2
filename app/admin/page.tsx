import { redirect } from "next/navigation";

// The post-login landing page is the Properties screen. Quick entry now lives
// in the property pop-out (see PropertyCard), so the owner can record
// revenue/expenses directly from a property. The full dashboard lives at
// /admin/dashboard (reachable from the sidebar).
export default function AdminIndexPage() {
  redirect("/admin/properties");
}
