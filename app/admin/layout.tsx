import { DashboardLayout } from "@/components/admin/DashboardLayout";
import { RentalProvider } from "@/context/RentalContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RentalProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </RentalProvider>
  );
}
