"use client";

import { useState, type FormEvent } from "react";
import { trackGuestOrderAction } from "@/app/track-order/actions";
import { TrackOrderResult } from "@/components/tracking/TrackOrderResult";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  EMAIL_LABEL,
  GENERIC_LOOKUP_ERROR,
  ORDER_REFERENCE_LABEL,
  TRACK_ORDER_ACTION,
  TRACK_YOUR_ORDER,
} from "@/lib/tracking-copy";
import { track } from "@/lib/analytics";
import type { GuestOrderTrackingView } from "@/contracts/order/dto";
import styles from "./Tracking.module.css";

export function TrackOrderForm() {
  const [orderReference, setOrderReference] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [order, setOrder] = useState<GuestOrderTrackingView | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setFormError("");
    const result = await trackGuestOrderAction({ orderReference, email });
    if (result.status === "ok") {
      setOrder(result.order);
      setPending(false);
      track("track_order", { status: result.order.status });
      return;
    }
    setOrder(null);
    setFormError(result.message || GENERIC_LOOKUP_ERROR);
    setPending(false);
  }

  if (order) {
    return <TrackOrderResult order={order} onTrackAnother={() => setOrder(null)} />;
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate data-track-order-form>
      <h1 className="text-h2">{TRACK_YOUR_ORDER}</h1>
      {formError ? (
        <p className="text-small" role="alert">
          {formError}
        </p>
      ) : null}
      <Field
        id="track-order-reference"
        name="orderReference"
        type="text"
        label={ORDER_REFERENCE_LABEL}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={orderReference}
        required
        disabled={pending}
        onChange={(event) => setOrderReference(event.target.value)}
      />
      <Field
        id="track-order-email"
        name="email"
        type="email"
        label={EMAIL_LABEL}
        autoComplete="email"
        inputMode="email"
        value={email}
        required
        disabled={pending}
        onChange={(event) => setEmail(event.target.value)}
      />
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>
          {TRACK_ORDER_ACTION}
        </Button>
      </div>
    </form>
  );
}
