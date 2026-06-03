import { DashboardLayout } from "@/components/admin/DashboardLayout";
import { RentalProvider } from "@/context/RentalContext";
import { AuthGate } from "@/components/auth/AuthGate";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <RentalProvider>
        <ConfirmProvider>
          <DashboardLayout>{children}</DashboardLayout>
        </ConfirmProvider>
      </RentalProvider>
    </AuthGate>
  );
}
