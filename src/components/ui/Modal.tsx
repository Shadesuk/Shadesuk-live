"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";
import styles from "./Modal.module.css";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  descriptionId?: string;
  children: ReactNode;
};

export function Modal({
  open,
  onClose,
  titleId,
  descriptionId,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useScrollLock(open);
  useFocusTrap(open, dialogRef, handleClose);

  if (!open) {
    return null;
  }

  return (
    <>
      <div className={styles.overlay} onClick={handleClose} />
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        {children}
      </div>
    </>
  );
}
