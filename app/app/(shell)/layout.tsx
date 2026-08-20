import { AlertBanner } from "@/components/alert-banner";
import { AppSidebar } from "@/components/app-sidebar";
import { ShellHeader } from "@/components/shell-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-background">
        <ShellHeader />
        <AlertBanner />
        <div className="surface-grid flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
