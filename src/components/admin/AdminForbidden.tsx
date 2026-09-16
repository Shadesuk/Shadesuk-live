import type { AdminActor } from "@/lib/admin-session";
import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_FORBIDDEN,
  ADMIN_SIGNED_IN_AS,
  ADMIN_TITLE,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { AdminSignOutButton } from "./AdminSignOutButton";
import styles from "./AdminAuth.module.css";

export function AdminForbidden({
  actor,
  email,
  message = ADMIN_FORBIDDEN,
}: {
  actor?: AdminActor;
  email?: string;
  message?: string;
}) {
  const identity = actor?.email || email;
  return (
    <div className={styles.stack}>
      <p className={styles.kicker}>{ADMIN_TITLE}</p>
      <h1 className={`text-h2 ${styles.heading}`}>{message}</h1>
      {identity ? (
        <p className={`text-body ${styles.body}`}>
          {ADMIN_SIGNED_IN_AS} {identity}
        </p>
      ) : (
        <p className={`text-body ${styles.body}`}>
          Sign in with an authorised Admin or Superadmin account.
        </p>
      )}
      <div className={styles.actions}>
        {actor ? (
          <ButtonLink href={routes.admin} variant="secondary">
            Back
          </ButtonLink>
        ) : null}
        <AdminSignOutButton />
      </div>
    </div>
  );
}
