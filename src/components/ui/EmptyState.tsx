import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./EmptyState.module.css";

type EmptyStateProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  titleAs?: "h1" | "h2";
  titleId?: string;
};

export function EmptyState({
  title,
  description,
  actions,
  className,
  titleAs = "h2",
  titleId,
}: EmptyStateProps) {
  const Title = titleAs;
  return (
    <div className={cx(styles.wrap, className)} role="status">
      <Title id={titleId} tabIndex={titleId ? -1 : undefined} className={titleAs === "h1" ? "text-h2" : "text-h3"}>
        {title}
      </Title>
      {description ? <p className="text-body">{description}</p> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
