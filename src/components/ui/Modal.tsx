"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/cx";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";
import styles from "./Modal.module.css";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  descriptionId?: string;
  id?: string;
  variant?: "default" | "search";
  className?: string;
  children: ReactNode;
};

export function Modal({
  open,
  onClose,
  titleId,
  descriptionId,
  id,
  variant = "default",
  className,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useScrollLock(open);
  useFocusTrap(open, dialogRef, handleClose);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <div className={styles.overlay} onClick={handleClose} />
      <div
        ref={dialogRef}
        id={id}
        className={cx(
          styles.dialog,
          variant === "search" && styles.search,
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
