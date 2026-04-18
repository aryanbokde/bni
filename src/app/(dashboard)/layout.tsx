import Sidebar from "@/components/ui/Sidebar";
import TopBar from "@/components/ui/TopBar";
import OfflineIndicator from "@/components/ui/OfflineIndicator";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Skip to content — accessible keyboard navigation */}
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

      <OfflineIndicator />
      <Sidebar />
      <TopBar />

      {/* Content area: left margin is controlled by CSS based on sidebar state */}
      <main
        id="main-content"
        tabIndex={-1}
        className="dashboard-main pt-14 lg:pt-16 transition-all duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
      >
        <div className="max-w-7xl mx-auto px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
