import { AppShell } from "@/components/layout/app-shell";
import { GatewayProvider } from "@/lib/store/gateway-store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <GatewayProvider>
      <AppShell>{children}</AppShell>
    </GatewayProvider>
  );
}
