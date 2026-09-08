import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./EmptyState.module.css";

type EmptyStateProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx(styles.wrap, className)} role="status">
      <h2 className="text-h3">{title}</h2>
      {description ? <p className="text-body">{description}</p> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
