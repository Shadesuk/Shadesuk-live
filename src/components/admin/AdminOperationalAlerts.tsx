import {
  ADMIN_ALERTS_TITLE,
  ADMIN_ALL_CLEAR_BODY,
  ADMIN_ALL_CLEAR_TITLE,
  ADMIN_RECENT_ORDERS_VIEW,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { loadDashboardAlerts } from "@/services/admin-dashboard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { AdminDashboardUnavailable } from "./AdminDashboardUnavailable";
import styles from "./AdminDashboard.module.css";

export async function AdminOperationalAlerts() {
  const result = await loadDashboardAlerts();
  if (result.status !== "ok") {
    return <AdminDashboardUnavailable />;
  }
  const alerts = result.data;

  return (
    <section className={styles.section} aria-labelledby="dashboard-alerts-heading">
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
            <li key={alert.id} className={styles.alert}>
              <span className="text-small">{alert.label}</span>
              <span className={`text-small ${styles.alertCount}`}>{alert.count}</span>
            </li>
          ))}
        </ul>
      )}
      {alerts.some((alert) => alert.id !== "out-of-stock") ? (
        <ButtonLink href={routes.adminOrders} variant="tertiary">
          {ADMIN_RECENT_ORDERS_VIEW}
        </ButtonLink>
      ) : null}
    </section>
  );
}
