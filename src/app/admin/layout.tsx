import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ADMIN_TITLE } from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";
import styles from "@/components/admin/AdminAuth.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_TITLE,
  "Sign in to SHADESUK Admin.",
  routes.admin,
);

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <main id="main" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
