import { DashboardLayout } from "@/components/admin/DashboardLayout";
import { RentalProvider } from "@/context/RentalContext";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";

// Access to /admin is enforced server-side by middleware.ts (Supabase session).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RentalProvider>
      <ConfirmProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </ConfirmProvider>
    </RentalProvider>
  );
}
