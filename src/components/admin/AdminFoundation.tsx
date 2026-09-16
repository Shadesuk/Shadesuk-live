import type { AdminActor } from "@/lib/admin-session";
import {
  ADMIN_FOUNDATION_BODY,
  ADMIN_FOUNDATION_HEADING,
  ADMIN_ROLE_LABEL,
  ADMIN_SIGNED_IN_AS,
  ADMIN_TITLE,
} from "@/lib/admin-copy";
import { AdminSignOutButton } from "./AdminSignOutButton";
import styles from "./AdminAuth.module.css";

export function AdminFoundation({ actor }: { actor: AdminActor }) {
  return (
    <div className={styles.stack} data-admin-role={actor.role}>
      <p className={styles.kicker}>{ADMIN_TITLE}</p>
      <h1 className={`text-h2 ${styles.heading}`}>{ADMIN_FOUNDATION_HEADING}</h1>
      <p className={`text-body ${styles.body}`}>{ADMIN_FOUNDATION_BODY}</p>
      <dl className={styles.meta}>
        <div>
          <dt>{ADMIN_SIGNED_IN_AS}</dt>
          <dd>{actor.email || actor.id}</dd>
        </div>
        <div>
          <dt>{ADMIN_ROLE_LABEL}</dt>
          <dd>{actor.roleLabel}</dd>
        </div>
      </dl>
      <AdminSignOutButton />
    </div>
  );
}
