import { AdminRetryButton } from "./AdminRetryButton";
import {
  ADMIN_COLLECTIONS_UNAVAILABLE_BODY,
  ADMIN_COLLECTIONS_UNAVAILABLE_TITLE,
} from "@/lib/admin-copy";
import styles from "./AdminCollections.module.css";

export function AdminCollectionsUnavailable() {
  return (
    <div className={styles.unavailable} role="alert">
      <h2 className={styles.sectionTitle}>{ADMIN_COLLECTIONS_UNAVAILABLE_TITLE}</h2>
      <p className={`text-body ${styles.quietBody}`}>{ADMIN_COLLECTIONS_UNAVAILABLE_BODY}</p>
      <AdminRetryButton />
    </div>
  );
}
