import { AdminRetryButton } from "./AdminRetryButton";
import {
  ADMIN_ORDERS_UNAVAILABLE_BODY,
  ADMIN_ORDERS_UNAVAILABLE_TITLE,
} from "@/lib/admin-copy";
import styles from "./AdminOrders.module.css";

export function AdminOrdersUnavailable() {
  return (
    <div className={styles.unavailable} role="alert">
      <h2 className={styles.sectionTitle}>{ADMIN_ORDERS_UNAVAILABLE_TITLE}</h2>
      <p className={`text-body ${styles.quietBody}`}>{ADMIN_ORDERS_UNAVAILABLE_BODY}</p>
      <AdminRetryButton />
    </div>
  );
}
