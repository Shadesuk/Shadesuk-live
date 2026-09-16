import type { ReactNode } from "react";
import styles from "./AdminShell.module.css";

export function AdminContent({ children }: { children: ReactNode }) {
  return <div className={styles.page}>{children}</div>;
}
