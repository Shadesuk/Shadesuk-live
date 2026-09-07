"use client";

import { cx } from "@/lib/cx";
import styles from "./UtilityButton.module.css";

type UtilityButtonProps = {
  children: string;
  onClick: () => void;
  expanded?: boolean;
  controls?: string;
  hasPopup?: "dialog" | "menu" | "true";
  count?: number;
};

export function UtilityButton({
  children,
  onClick,
  expanded,
  controls,
  hasPopup,
  count,
}: UtilityButtonProps) {
  const label =
    typeof count === "number" && count > 0 ? `${children}, ${count} items` : children;

  return (
    <button
      type="button"
      className={cx(styles.trigger, expanded && styles.expanded)}
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-haspopup={hasPopup}
      aria-label={label}
    >
      {children}
      {typeof count === "number" && count > 0 ? (
        <span className={styles.count} aria-hidden="true">
          {count}
        </span>
      ) : null}
    </button>
  );
}
