import { AdminRetryButton } from "./AdminRetryButton";
import {
  ADMIN_MERCHANDISING_UNAVAILABLE_BODY,
  ADMIN_MERCHANDISING_UNAVAILABLE_TITLE,
} from "@/lib/admin-copy";
import type { AdminV1Role } from "@/contracts/admin/roles";
import { loadAdminMerchandising } from "@/services/admin-merchandising";
import { AdminMerchandisingEditor } from "./AdminMerchandisingEditor";
import styles from "./AdminProducts.module.css";

export async function AdminMerchandisingPage({ role }: { role: AdminV1Role }) {
  const result = await loadAdminMerchandising(role);
  if (result.status !== "ok") {
    return (
      <div className={styles.unavailable} role="alert" data-admin-merchandising-unavailable>
        <h2 className={styles.sectionTitle}>{ADMIN_MERCHANDISING_UNAVAILABLE_TITLE}</h2>
        <p className={`text-body ${styles.quietBody}`}>{ADMIN_MERCHANDISING_UNAVAILABLE_BODY}</p>
        <AdminRetryButton />
      </div>
    );
  }
  return <AdminMerchandisingEditor initial={result.data} />;
}
