import { ADMIN_ANALYTICS_LOADING_CUSTOMERS } from "@/lib/admin-copy";
import styles from "./AdminDashboard.module.css";

export function AdminAnalyticsCustomersSkeleton() {
  return (
    <section className={styles.section} aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_ANALYTICS_LOADING_CUSTOMERS}
      </p>
      <div className={`${styles.skeletonKpis} ${styles.skeletonCustomerKpis}`} aria-hidden="true">
        {["a", "b", "c"].map((key) => (
          <div key={key} className={styles.skeletonKpi}>
            <div className={styles.skeletonLine} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonValue}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
