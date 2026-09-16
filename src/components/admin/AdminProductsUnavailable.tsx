import { AdminRetryButton } from "./AdminRetryButton";
import { ADMIN_PRODUCTS_UNAVAILABLE_BODY, ADMIN_PRODUCTS_UNAVAILABLE_TITLE } from "@/lib/admin-copy";
import styles from "./AdminProducts.module.css";

export function AdminProductsUnavailable() {
  return (
    <div className={styles.unavailable} role="alert">
      <h2 className={styles.sectionTitle}>{ADMIN_PRODUCTS_UNAVAILABLE_TITLE}</h2>
      <p className={`text-body ${styles.quietBody}`}>{ADMIN_PRODUCTS_UNAVAILABLE_BODY}</p>
      <AdminRetryButton />
    </div>
  );
}
