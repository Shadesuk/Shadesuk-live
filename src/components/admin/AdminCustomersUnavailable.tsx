import { AdminRetryButton } from "./AdminRetryButton";
import {
  ADMIN_CUSTOMERS_UNAVAILABLE_BODY,
  ADMIN_CUSTOMERS_UNAVAILABLE_TITLE,
} from "@/lib/admin-copy";
import styles from "./AdminCustomers.module.css";

export function AdminCustomersUnavailable() {
  return (
    <div className={styles.unavailable} role="alert">
      <h2 className={styles.sectionTitle}>{ADMIN_CUSTOMERS_UNAVAILABLE_TITLE}</h2>
      <p className={`text-body ${styles.quietBody}`}>{ADMIN_CUSTOMERS_UNAVAILABLE_BODY}</p>
      <AdminRetryButton />
    </div>
  );
}
