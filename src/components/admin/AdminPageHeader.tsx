import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./AdminPageHeader.module.css";

export function AdminPageHeader({
  kicker,
  title,
  description,
  action,
}: {
  kicker?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className={cx(styles.header, action ? styles.withAction : undefined)}>
      <div className={styles.copy}>
        {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
        <h1 className={`text-h2 ${styles.title}`}>{title}</h1>
        {description ? (
          <p className={`text-body ${styles.description}`}>{description}</p>
        ) : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </header>
  );
}
