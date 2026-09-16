import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_NOT_FOUND_ACTION,
  ADMIN_NOT_FOUND_BODY,
  ADMIN_NOT_FOUND_HEADING,
  ADMIN_TITLE,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import styles from "@/components/admin/AdminAuth.module.css";

export default function AdminNotFound() {
  return (
    <div className={styles.stack}>
      <p className={styles.kicker}>{ADMIN_TITLE}</p>
      <h1 className={`text-h2 ${styles.heading}`}>{ADMIN_NOT_FOUND_HEADING}</h1>
      <p className={`text-body ${styles.body}`}>{ADMIN_NOT_FOUND_BODY}</p>
      <div className={styles.actions}>
        <ButtonLink href={routes.admin} variant="secondary">
          {ADMIN_NOT_FOUND_ACTION}
        </ButtonLink>
      </div>
    </div>
  );
}
