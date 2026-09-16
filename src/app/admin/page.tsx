import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  ADMIN_HOME_BODY,
  ADMIN_HOME_KICKER,
  ADMIN_HOME_TITLE,
  ADMIN_ROLE_LABEL,
  ADMIN_SIGNED_IN_AS,
} from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import styles from "@/components/admin/AdminAuth.module.css";

export default async function AdminPage() {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  return (
    <div data-admin-home data-admin-role={gate.actor.role}>
      <AdminPageHeader
        kicker={ADMIN_HOME_KICKER}
        title={ADMIN_HOME_TITLE}
        description={ADMIN_HOME_BODY}
      />
      <dl className={styles.meta}>
        <div>
          <dt>{ADMIN_SIGNED_IN_AS}</dt>
          <dd>{gate.actor.email || gate.actor.id}</dd>
        </div>
        <div>
          <dt>{ADMIN_ROLE_LABEL}</dt>
          <dd>{gate.actor.roleLabel}</dd>
        </div>
      </dl>
    </div>
  );
}
