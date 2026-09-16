import {
  ADMIN_DASHBOARD_LOADING_ALERTS,
  ADMIN_DASHBOARD_LOADING_KPIS,
  ADMIN_DASHBOARD_LOADING_ORDERS,
  ADMIN_DASHBOARD_LOADING_SALES,
} from "@/lib/admin-copy";
import styles from "./AdminDashboard.module.css";

export function AdminKpiSkeleton() {
  return (
    <section className={styles.section} aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_DASHBOARD_LOADING_KPIS}
      </p>
      <div className={styles.skeletonKpis} aria-hidden="true">
        {["a", "b", "c", "d"].map((key) => (
          <div key={key} className={styles.skeletonKpi}>
            <div className={styles.skeletonLine} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonValue}`} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminSalesSkeleton() {
  return (
    <section className={styles.section} aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_DASHBOARD_LOADING_SALES}
      </p>
      <div className={`${styles.skeletonBlock} ${styles.skeletonChart}`} aria-hidden="true" />
    </section>
  );
}

export function AdminOrdersSkeleton() {
  return (
    <section className={styles.section} aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_DASHBOARD_LOADING_ORDERS}
      </p>
      <div className={styles.skeletonOrders} aria-hidden="true">
        {["a", "b", "c"].map((key) => (
          <div key={key} className={`${styles.skeletonBlock} ${styles.skeletonOrder}`} />
        ))}
      </div>
    </section>
  );
}

export function AdminAlertsSkeleton() {
  return (
    <section className={styles.section} aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_DASHBOARD_LOADING_ALERTS}
      </p>
      <div className={styles.skeletonOrders} aria-hidden="true">
        {["a", "b"].map((key) => (
          <div key={key} className={`${styles.skeletonBlock} ${styles.skeletonOrder}`} />
        ))}
      </div>
    </section>
  );
}
