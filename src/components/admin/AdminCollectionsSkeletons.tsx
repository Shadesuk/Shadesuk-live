import { ADMIN_COLLECTION_LOADING, ADMIN_COLLECTIONS_LOADING } from "@/lib/admin-copy";
import styles from "./AdminCollections.module.css";

export function AdminCollectionsTableSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_COLLECTIONS_LOADING}
      </p>
      {["a", "b", "c", "d", "e"].map((key) => (
        <div key={key} className={`${styles.skeletonBlock} ${styles.skeletonRow}`} aria-hidden="true" />
      ))}
    </div>
  );
}

export function AdminCollectionEditorSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {ADMIN_COLLECTION_LOADING}
      </p>
      <div className={styles.stack} aria-hidden="true">
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="header" />
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="fields" />
        <div className={`${styles.skeletonBlock} ${styles.skeletonRow}`} data-skeleton="products" />
      </div>
    </div>
  );
}
