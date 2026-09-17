import {
  ADMIN_ANALYTICS_UNAVAILABLE_BODY,
  ADMIN_ANALYTICS_UNAVAILABLE_TITLE,
} from "@/lib/admin-copy";
import { AdminRetryButton } from "./AdminRetryButton";
import styles from "./AdminDashboard.module.css";

export function AdminAnalyticsUnavailable() {
  return (
    <div className={styles.unavailable} role="alert">
      <h2 className={styles.sectionTitle}>{ADMIN_ANALYTICS_UNAVAILABLE_TITLE}</h2>
      <p className={`text-body ${styles.quietBody}`}>{ADMIN_ANALYTICS_UNAVAILABLE_BODY}</p>
      <AdminRetryButton />
    </div>
  );
}
