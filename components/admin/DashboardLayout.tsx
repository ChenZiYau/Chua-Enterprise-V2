import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Chatbot } from "./Chatbot";
import { MobileNavProvider } from "./MobileNavContext";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavProvider>
      <div
        className="min-h-screen flex"
        style={{ background: "var(--background)" }}
      >
        <Sidebar />
        <div
          className="flex-1 flex flex-col min-w-0 min-h-screen"
          style={{ background: "var(--background)" }}
        >
          <Header />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
        <Chatbot />
      </div>
    </MobileNavProvider>
  );
}
