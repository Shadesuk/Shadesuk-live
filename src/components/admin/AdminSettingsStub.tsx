import type { AdminActor } from "@/lib/admin-session";
import {
  ADMIN_SETTINGS_BODY,
  ADMIN_SETTINGS_HEADING,
  ADMIN_TITLE,
} from "@/lib/admin-copy";
import { AdminSignOutButton } from "./AdminSignOutButton";
import styles from "./AdminAuth.module.css";

export function AdminSettingsStub({ actor }: { actor: AdminActor }) {
  return (
    <div className={styles.stack} data-admin-settings data-admin-role={actor.role}>
      <p className={styles.kicker}>{ADMIN_TITLE}</p>
      <h1 className={`text-h2 ${styles.heading}`}>{ADMIN_SETTINGS_HEADING}</h1>
      <p className={`text-body ${styles.body}`}>{ADMIN_SETTINGS_BODY}</p>
      <AdminSignOutButton />
    </div>
  );
}
