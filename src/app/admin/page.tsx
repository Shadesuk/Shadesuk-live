import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { getAdminGate } from "@/lib/admin-session";

export default async function AdminPage() {
  const gate = await getAdminGate();
  return <AdminAuthScreen gate={gate} />;
}
