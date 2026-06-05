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
          {/* Footer on every admin page. The generous bottom padding keeps the
              text clear of the fixed chat launcher in the bottom-right corner. */}
          <footer
            className="px-4 sm:px-6 lg:px-8 pt-6 pb-24 text-center text-xs"
            style={{ color: "var(--text-faint)", borderTop: "1px solid var(--border-soft)" }}
          >
            &copy; 2026, Chua Enterprise
          </footer>
        </div>
        <Chatbot />
      </div>
    </MobileNavProvider>
  );
}
