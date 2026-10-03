"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cancelAccountOrderAction } from "@/app/(storefront)/account/orders/actions";
import { cancelGuestOrderAction } from "@/app/(storefront)/track-order/actions";
import { Button } from "@/components/ui/Button";
import { FieldTextarea } from "@/components/ui/Field";
import {
  CANCEL_ORDER_ACTION,
  CANCEL_ORDER_HINT,
  CANCEL_ORDER_PENDING,
  CANCEL_ORDER_REASON_LABEL,
  cancellationResultMessage,
} from "@/lib/cancellation-copy";
import styles from "@/components/tracking/Tracking.module.css";

type CancelOrderFormProps = {
  orderReference: string;
  mode: "account" | "guest";
  onCancelled?: () => void;
};

export function CancelOrderForm({ orderReference, mode, onCancelled }: CancelOrderFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("orderReference", orderReference);
    setPending(true);
    const result =
      mode === "guest" ? await cancelGuestOrderAction(data) : await cancelAccountOrderAction(data);
    setPending(false);
    setMessage(cancellationResultMessage(result.status, result.reason));
    if (result.status === "cancelled" || result.status === "already_cancelled") {
      onCancelled?.();
      if (mode === "account") {
        router.refresh();
      }
    }
  }

  return (
    <form className={styles.actions} onSubmit={onSubmit}>
      <FieldTextarea
        id={`cancel-reason-${orderReference}`}
        name="reason"
        label={CANCEL_ORDER_REASON_LABEL}
        hint={CANCEL_ORDER_HINT}
        maxLength={500}
        rows={3}
      />
      {message ? (
        <p className="text-small" role="status">
          {message}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" loading={pending} disabled={pending}>
        {pending ? CANCEL_ORDER_PENDING : CANCEL_ORDER_ACTION}
      </Button>
    </form>
  );
}
