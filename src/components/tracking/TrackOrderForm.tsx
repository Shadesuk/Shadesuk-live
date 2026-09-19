"use client";

import { useState, type FormEvent } from "react";
import { trackGuestOrderAction } from "@/app/(storefront)/track-order/actions";
import { TrackOrderResult } from "@/components/tracking/TrackOrderResult";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { EMAIL_REQUIRED } from "@/lib/account-copy";
import {
  EMAIL_LABEL,
  GENERIC_LOOKUP_ERROR,
  GUEST_ORDER_NOT_FOUND_BODY,
  GUEST_ORDER_NOT_FOUND_TITLE,
  ORDER_REFERENCE_LABEL,
  ORDER_REFERENCE_REQUIRED,
  RATE_LIMITED,
  TRACK_ORDER_ACTION,
  TRACK_YOUR_ORDER,
  TRACKING_LOOKUP_PENDING,
} from "@/lib/tracking-copy";
import { track } from "@/lib/analytics";
import type { GuestOrderTrackingView } from "@/contracts/order/dto";
import styles from "./Tracking.module.css";

export function TrackOrderForm() {
  const [orderReference, setOrderReference] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [formErrorTitle, setFormErrorTitle] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ orderReference?: string; email?: string }>({});
  const [pending, setPending] = useState(false);
  const [order, setOrder] = useState<GuestOrderTrackingView | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    const nextFieldErrors = {
      orderReference: orderReference.trim() ? undefined : ORDER_REFERENCE_REQUIRED,
      email: email.trim() ? undefined : EMAIL_REQUIRED,
    };
    if (nextFieldErrors.orderReference || nextFieldErrors.email) {
      setFieldErrors(nextFieldErrors);
      setFormError("");
      setFormErrorTitle("");
      return;
    }
    setFieldErrors({});
    setPending(true);
    setFormError("");
    setFormErrorTitle("");
    const result = await trackGuestOrderAction({ orderReference, email });
    if (result.status === "ok") {
      setOrder(result.order);
      setPending(false);
      track("track_order", { status: result.order.status });
      return;
    }
    setOrder(null);
    if (result.status === "rate_limited") {
      setFormErrorTitle("");
      setFormError(result.message || RATE_LIMITED);
    } else if (result.status === "not_found") {
      setFormErrorTitle(GUEST_ORDER_NOT_FOUND_TITLE);
      setFormError(GUEST_ORDER_NOT_FOUND_BODY);
    } else {
      setFormErrorTitle("");
      setFormError(result.message || GENERIC_LOOKUP_ERROR);
    }
    setPending(false);
  }

  if (order) {
    return <TrackOrderResult order={order} onTrackAnother={() => setOrder(null)} />;
  }

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      noValidate
      data-track-order-form
      aria-busy={pending || undefined}
    >
      <h1 className="text-h2">{TRACK_YOUR_ORDER}</h1>
      <div className="visually-hidden" aria-live="polite">
        {pending ? TRACKING_LOOKUP_PENDING : ""}
      </div>
      {formError ? (
        <div className={styles.notice} role="alert">
          {formErrorTitle ? <p className="text-micro">{formErrorTitle}</p> : null}
          <p className="text-small">{formError}</p>
        </div>
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
        error={fieldErrors.orderReference}
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
        error={fieldErrors.email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>
          {pending ? "Tracking" : TRACK_ORDER_ACTION}
        </Button>
      </div>
    </form>
  );
}
