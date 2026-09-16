import { ADMIN_PRODUCTS_LOADING, ADMIN_PRODUCT_LOADING } from "@/lib/admin-copy";
import styles from "./AdminProducts.module.css";

export function AdminProductsTableSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_PRODUCTS_LOADING}
      </p>
      {["a", "b", "c", "d", "e"].map((key) => (
        <div key={key} className={`${styles.skeletonBlock} ${styles.skeletonRow}`} aria-hidden="true" />
      ))}
    </div>
  );
}

export function AdminProductEditorSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_PRODUCT_LOADING}
      </p>
      <div className={styles.stack} aria-hidden="true">
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="header" />
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="fields" />
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="images" />
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="variants" />
      </div>
    </div>
  );
}
