import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { parseDashboardPeriod } from "@/contracts/admin/dashboard";
import { getAdminGate } from "@/lib/admin-session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const params = await searchParams;
  const period = parseDashboardPeriod(params.period);
  return <AdminDashboard period={period} role={gate.actor.role} />;
}
