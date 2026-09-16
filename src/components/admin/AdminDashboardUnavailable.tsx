import {
  ADMIN_DASHBOARD_UNAVAILABLE_BODY,
  ADMIN_DASHBOARD_UNAVAILABLE_TITLE,
} from "@/lib/admin-copy";
import { AdminRetryButton } from "./AdminRetryButton";
import styles from "./AdminDashboard.module.css";

export function AdminDashboardUnavailable() {
  return (
    <div className={styles.unavailable} role="alert">
      <h2 className={styles.sectionTitle}>{ADMIN_DASHBOARD_UNAVAILABLE_TITLE}</h2>
      <p className={`text-body ${styles.quietBody}`}>{ADMIN_DASHBOARD_UNAVAILABLE_BODY}</p>
      <AdminRetryButton />
    </div>
  );
}
