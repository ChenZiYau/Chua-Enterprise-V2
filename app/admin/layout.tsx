import { DashboardLayout } from "@/components/admin/DashboardLayout";
import { RentalProvider } from "@/context/RentalContext";
import { AuthGate } from "@/components/auth/AuthGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <RentalProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </RentalProvider>
    </AuthGate>
  );
}
