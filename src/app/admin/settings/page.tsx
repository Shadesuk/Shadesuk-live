import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminForbidden } from "@/components/admin/AdminForbidden";
import { AdminSettingsStub } from "@/components/admin/AdminSettingsStub";
import { canAccessSettings } from "@/contracts/admin/roles";
import { ADMIN_SETTINGS_FORBIDDEN } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";

export default async function AdminSettingsPage() {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  if (!canAccessSettings(gate.actor.role)) {
    return (
      <AdminForbidden
        actor={gate.actor}
        message={ADMIN_SETTINGS_FORBIDDEN}
      />
    );
  }
  return <AdminSettingsStub actor={gate.actor} />;
}
