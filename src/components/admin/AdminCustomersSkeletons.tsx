import {
  ADMIN_CUSTOMER_LOADING,
  ADMIN_CUSTOMERS_LOADING,
} from "@/lib/admin-copy";
import styles from "./AdminCustomers.module.css";

export function AdminCustomersTableSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_CUSTOMERS_LOADING}
      </p>
      {["a", "b", "c", "d", "e"].map((key) => (
        <div key={key} className={`${styles.skeletonBlock} ${styles.skeletonRow}`} aria-hidden="true" />
      ))}
    </div>
  );
}

export function AdminCustomerDetailSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_CUSTOMER_LOADING}
      </p>
      <div className={styles.stack} aria-hidden="true">
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="header" />
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="details" />
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="orders" />
      </div>
    </div>
  );
}
