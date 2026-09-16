import {
  ADMIN_ORDERS_LOADING,
  ADMIN_ORDER_LOADING_DETAIL,
} from "@/lib/admin-copy";
import styles from "./AdminOrders.module.css";

export function AdminOrdersTableSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_ORDERS_LOADING}
      </p>
      {["a", "b", "c", "d", "e"].map((key) => (
        <div key={key} className={`${styles.skeletonBlock} ${styles.skeletonRow}`} aria-hidden="true" />
      ))}
    </div>
  );
}

export function AdminOrderDetailSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_ORDER_LOADING_DETAIL}
      </p>
      <div className={styles.stack} aria-hidden="true">
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="header" />
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="customer" />
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="items" />
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="fulfilment" />
      </div>
    </div>
  );
}
