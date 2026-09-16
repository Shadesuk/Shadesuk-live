import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminForbidden } from "@/components/admin/AdminForbidden";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { canAccessSettings } from "@/contracts/admin/roles";
import {
  ADMIN_SETTINGS_BODY,
  ADMIN_SETTINGS_FORBIDDEN,
  ADMIN_SETTINGS_HEADING,
} from "@/lib/admin-copy";
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
        embedded
      />
    );
  }
  return (
    <div data-admin-settings data-admin-role={gate.actor.role}>
      <AdminPageHeader
        title={ADMIN_SETTINGS_HEADING}
        description={ADMIN_SETTINGS_BODY}
      />
    </div>
  );
}
