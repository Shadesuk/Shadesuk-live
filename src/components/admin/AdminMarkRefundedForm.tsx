"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { markOrderRefundedAction, type AdminOrderActionState } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/Button";
import {
  ADMIN_REFUND_CONFIRM_BODY,
  ADMIN_REFUND_CONFIRM_TITLE,
  ADMIN_REFUND_FAILED,
  ADMIN_REFUND_KEEP_PENDING,
  ADMIN_REFUND_MARK,
  ADMIN_REFUND_MARKING,
} from "@/lib/admin-copy";
import styles from "./AdminOrders.module.css";

const idle: AdminOrderActionState = { status: "idle" };

export function AdminMarkRefundedForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(markOrderRefundedAction, idle);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const formId = `mark-refunded-${orderId}`;

  useEffect(() => {
    if (state.status !== "idle") {
      dialogRef.current?.close();
    }
  }, [state]);

  return (
    <>
      <form id={formId} className={styles.form} action={action}>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="confirmed" value="yes" />
        {state.status === "invalid" || state.status === "error" || state.status === "forbidden" ? (
          <p className={`text-small ${styles.banner}`} role="alert">
            {state.message ?? state.errors?.refund ?? ADMIN_REFUND_FAILED}
          </p>
        ) : null}
        <Button type="button" variant="primary" disabled={pending} onClick={() => dialogRef.current?.showModal()}>
          {ADMIN_REFUND_MARK}
        </Button>
      </form>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (pending) {
            event.preventDefault();
          }
        }}
      >
        <div className={styles.form}>
          <h3 id={titleId} className={styles.sectionTitle}>
            {ADMIN_REFUND_CONFIRM_TITLE}
          </h3>
          <p className="text-small">{ADMIN_REFUND_CONFIRM_BODY}</p>
          <div className={styles.filterActions}>
            <Button type="submit" form={formId} variant="primary" loading={pending}>
              {pending ? ADMIN_REFUND_MARKING : ADMIN_REFUND_MARK}
            </Button>
            <Button
              type="button"
              variant="tertiary"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
            >
              {ADMIN_REFUND_KEEP_PENDING}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
