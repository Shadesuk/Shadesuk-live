import {
  ADMIN_DASHBOARD_UNAVAILABLE_BODY,
  ADMIN_DASHBOARD_UNAVAILABLE_TITLE,
} from "@/lib/admin-copy";
import { AdminRetryButton } from "./AdminRetryButton";
import styles from "./AdminDashboard.module.css";

export function AdminDashboardUnavailable({
  title = ADMIN_DASHBOARD_UNAVAILABLE_TITLE,
  body = ADMIN_DASHBOARD_UNAVAILABLE_BODY,
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className={styles.unavailable} role="alert">
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={`text-body ${styles.quietBody}`}>{body}</p>
      <AdminRetryButton />
    </div>
  );
}
