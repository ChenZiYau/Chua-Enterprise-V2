import { redirect } from "next/navigation";

// The post-login landing page is the Quick Entry screen, so the owner can
// record revenue/expenses immediately with the fewest clicks. The full
// dashboard lives at /admin/dashboard (reachable from the sidebar).
export default function AdminIndexPage() {
  redirect("/admin/entry");
}
