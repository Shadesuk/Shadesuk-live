import Link from "next/link";
import {
  ADMIN_ALERTS_TITLE,
  ADMIN_ALL_CLEAR_BODY,
  ADMIN_ALL_CLEAR_TITLE,
} from "@/lib/admin-copy";
import { loadNeedsAttention } from "@/services/admin-ops";
import { AdminDashboardUnavailable } from "./AdminDashboardUnavailable";
import styles from "./AdminDashboard.module.css";

export async function AdminOperationalAlerts() {
  const result = await loadNeedsAttention();
  if (result.status !== "ok") {
    return <AdminDashboardUnavailable />;
  }
  const alerts = result.data;

  return (
    <section className={styles.section} aria-labelledby="dashboard-alerts-heading" data-needs-attention>
      <h2 id="dashboard-alerts-heading" className={styles.sectionTitle}>
        {ADMIN_ALERTS_TITLE}
      </h2>
      {alerts.length === 0 ? (
        <div className={styles.quiet}>
          <p className={`text-micro ${styles.quietTitle}`}>{ADMIN_ALL_CLEAR_TITLE}</p>
          <p className={`text-small ${styles.quietBody}`}>{ADMIN_ALL_CLEAR_BODY}</p>
        </div>
      ) : (
        <ul className={styles.alerts}>
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link href={alert.href} className={styles.alert} data-attention-id={alert.id}>
                <span className="text-small">{alert.label}</span>
                <span className={`text-small ${styles.alertCount}`}>{alert.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
