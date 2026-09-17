import {
  ADMIN_ANALYTICS_CUSTOMERS_HINT,
  ADMIN_ANALYTICS_CUSTOMERS_TITLE,
  ADMIN_ANALYTICS_KPI_GUEST,
  ADMIN_ANALYTICS_KPI_REGISTERED,
  ADMIN_ANALYTICS_KPI_WITH_ORDERS,
} from "@/lib/admin-copy";
import { loadAdminCustomerInsights } from "@/services/admin-customers";
import { AdminAnalyticsUnavailable } from "./AdminAnalyticsUnavailable";
import styles from "./AdminDashboard.module.css";

export async function AdminAnalyticsCustomers() {
  const result = await loadAdminCustomerInsights();
  if (result.status !== "ok") {
    return <AdminAnalyticsUnavailable />;
  }
  const items = [
    {
      id: "registered",
      label: ADMIN_ANALYTICS_KPI_REGISTERED,
      value: String(result.data.registeredCount),
    },
    {
      id: "with-orders",
      label: ADMIN_ANALYTICS_KPI_WITH_ORDERS,
      value: String(result.data.withOrdersCount),
    },
    {
      id: "guest",
      label: ADMIN_ANALYTICS_KPI_GUEST,
      value: String(result.data.guestCount),
    },
  ] as const;

  return (
    <section className={styles.section} aria-labelledby="analytics-customers-heading">
      <h2 id="analytics-customers-heading" className={styles.sectionTitle}>
        {ADMIN_ANALYTICS_CUSTOMERS_TITLE}
      </h2>
      <ul className={`${styles.kpis} ${styles.customerKpis}`}>
        {items.map((item) => (
          <li key={item.id} className={styles.kpi} data-kpi={item.id}>
            <p className={`text-micro ${styles.kpiLabel}`}>{item.label}</p>
            <p className={`text-h3 ${styles.kpiValue}`}>{item.value}</p>
          </li>
        ))}
      </ul>
      <p className={`text-small ${styles.hint}`}>{ADMIN_ANALYTICS_CUSTOMERS_HINT}</p>
    </section>
  );
}
