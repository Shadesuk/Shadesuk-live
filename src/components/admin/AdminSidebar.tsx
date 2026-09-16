import Link from "next/link";
import type { AdminV1Role } from "@/contracts/admin/roles";
import { ADMIN_TITLE } from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { AdminNav } from "./AdminNav";
import styles from "./AdminShell.module.css";

export function AdminSidebar({ role }: { role: AdminV1Role }) {
  return (
    <aside className={styles.sidebar} aria-label={ADMIN_TITLE}>
      <Link href={routes.admin} className={styles.brand}>
        <span className={styles.brandName}>SHADESUK</span>
        <span className={styles.brandMeta}>Admin</span>
      </Link>
      <AdminNav role={role} />
    </aside>
  );
}
