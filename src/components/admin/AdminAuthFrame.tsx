import type { ReactNode } from "react";
import styles from "./AdminAuth.module.css";

export function AdminAuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <main id="main" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
