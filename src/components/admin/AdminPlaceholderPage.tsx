import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getAdminGate } from "@/lib/admin-session";

export async function AdminPlaceholderPage({
  title,
  description,
  kicker,
}: {
  title: string;
  description: string;
  kicker?: string;
}) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  return <AdminPageHeader kicker={kicker} title={title} description={description} />;
}
