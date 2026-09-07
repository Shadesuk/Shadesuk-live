"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";
import styles from "./Drawer.module.css";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  id?: string;
  children: ReactNode;
  side?: "left" | "right";
};

export function Drawer({
  open,
  onClose,
  titleId,
  children,
  side = "left",
  id,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useScrollLock(open);
  useFocusTrap(open, panelRef, handleClose);

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        className={styles.overlay}
        onClick={handleClose}
      />
      <div
        ref={panelRef}
        id={id}
        className={cx(styles.panel, styles[side])}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {children}
      </div>
    </>
  );
}
