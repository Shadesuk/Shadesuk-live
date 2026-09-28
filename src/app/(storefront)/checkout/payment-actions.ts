"use server";

import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import { isUuid } from "@/lib/ids";
import { clearPaymentAttemptId } from "@/lib/payment/attempt-cookie";
import { resolvePayPalServerConfig } from "@/lib/paypal/config";
import {
  closeCheckoutPaymentAttempt,
  initiatePendingPayPalPayment,
} from "@/services/pending-payment";
import { captureVerifiedPayment } from "@/lib/payment/capture-verified";
import { verifyPayPalClientReturn } from "@/lib/paypal/verify-client-return";
import { findPaymentIdByPayPalOrderId } from "@/lib/payment/verification-store";

export type CheckoutPaymentStartResult =
  | {
      status: "ok";
      paymentId: string;
      orderReference: string;
      providerOrderId: string;
      /** Public PayPal Client ID — safe for the browser. Never the secret. */
      clientId: string;
      /** Matches server PAYPAL_MODE — selects SDK script host. Never hardcode live on the client. */
      mode: "sandbox" | "live";
      amountMinor: number;
      currency: "GBP";
    }
  | { status: "invalid" }
  | { status: "empty" }
  | { status: "expired" }
  | { status: "blocked" }
  | { status: "unavailable" }
  | { status: "error" };

export type CheckoutPaymentVerifyResult =
  | { status: "verified"; orderReference: string }
  | { status: "already_processed"; orderReference: string }
  | { status: "error" };

export type PayPalCheckoutConfigResult =
  | { status: "ok"; clientId: string; mode: "sandbox" | "live" }
  | { status: "unavailable" };

/**
 * Public Client ID and the server mode for the official PayPal button.
 * Does not create an order and never returns the client secret.
 * `mode` follows PAYPAL_MODE. This recovery does not switch production to live.
 */
export async function loadPayPalCheckoutConfigAction(): Promise<PayPalCheckoutConfigResult> {
  if (!(await cartActionOriginAllowed())) {
    return { status: "unavailable" };
  }
  const config = resolvePayPalServerConfig();
  if (!config.ok) {
    return { status: "unavailable" };
  }
  return {
    status: "ok",
    clientId: config.config.clientId,
    mode: config.config.mode,
  };
}

/**
 * Buyer cancelled the PayPal button. Leaves the row unpaid and not a purchase.
 * Network failures must not call this — the same attempt can be retried.
 */
export async function cancelCheckoutPaymentAction(input: {
  paymentId: unknown;
}): Promise<{ status: "ok" } | { status: "error" }> {
  if (hasForbiddenOwnershipKey(input) || !(await cartActionOriginAllowed())) {
    return { status: "error" };
  }
  if (typeof input.paymentId !== "string" || !isUuid(input.paymentId)) {
    return { status: "error" };
  }
  try {
    await closeCheckoutPaymentAttempt(input.paymentId, "cancelled", "Buyer cancelled PayPal.");
  } catch {
    return { status: "error" };
  }
  return { status: "ok" };
}

/** Instrument declined. Does not mark a purchase. A later click starts a new attempt. */
export async function declineCheckoutPaymentAction(input: {
  paymentId: unknown;
}): Promise<{ status: "ok" } | { status: "error" }> {
  if (hasForbiddenOwnershipKey(input) || !(await cartActionOriginAllowed())) {
    return { status: "error" };
  }
  if (typeof input.paymentId !== "string" || !isUuid(input.paymentId)) {
    return { status: "error" };
  }
  try {
    await closeCheckoutPaymentAttempt(
      input.paymentId,
      "failed",
      "PayPal declined the instrument.",
    );
  } catch {
    return { status: "error" };
  }
  return { status: "ok" };
}

/**
 * Starts a pending PayPal attempt. Accepts no client money fields.
 * Returns the public Client ID for Phase 3 Buttons (action-return; not NEXT_PUBLIC_).
 */
export async function initiateCheckoutPaymentAction(
  input?: Record<string, unknown>,
): Promise<CheckoutPaymentStartResult> {
  if (input && hasForbiddenOwnershipKey(input)) {
    return { status: "error" };
  }
  if (!(await cartActionOriginAllowed())) {
    return { status: "error" };
  }

  const started = await initiatePendingPayPalPayment();
  if (started.status !== "ok") {
    if (
      started.status === "invalid" ||
      started.status === "empty" ||
      started.status === "expired" ||
      started.status === "blocked" ||
      started.status === "unavailable"
    ) {
      return { status: started.status };
    }
    return { status: "error" };
  }

  const config = resolvePayPalServerConfig();
  if (!config.ok) {
    return { status: "error" };
  }

  return {
    status: "ok",
    paymentId: started.paymentId,
    orderReference: started.orderReference,
    providerOrderId: started.providerOrderId,
    clientId: config.config.clientId,
    mode: config.config.mode,
    amountMinor: started.amountMinor,
    currency: "GBP",
  };
}

/**
 * Client-return verify: server Capture + amount reconcile, then app capture writer.
 * Never marks captured from browser approval alone.
 */
export async function verifyCheckoutPaymentAction(input: {
  paymentId: unknown;
  paypalOrderId: unknown;
  amountMinor?: unknown;
  currency?: unknown;
  total?: unknown;
  totalMinor?: unknown;
}): Promise<CheckoutPaymentVerifyResult> {
  if (hasForbiddenOwnershipKey(input)) {
    return { status: "error" };
  }
  if (!(await cartActionOriginAllowed())) {
    return { status: "error" };
  }
  if (typeof input.paypalOrderId !== "string" || !input.paypalOrderId.trim()) {
    return { status: "error" };
  }
  let paymentId = typeof input.paymentId === "string" ? input.paymentId : "";
  if (!isUuid(paymentId)) {
    const resolved = await findPaymentIdByPayPalOrderId(input.paypalOrderId);
    if (!resolved) {
      return { status: "error" };
    }
    paymentId = resolved;
  }

  const verified = await verifyPayPalClientReturn({
    paymentId,
    paypalOrderId: input.paypalOrderId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    total: input.total,
    totalMinor: input.totalMinor,
  });

  if (verified.outcome !== "verified" && verified.outcome !== "already_captured") {
    return { status: "error" };
  }

  const captured = await captureVerifiedPayment(verified);
  if (captured.outcome === "captured" || captured.outcome === "already_captured") {
    try {
      await clearPaymentAttemptId();
    } catch {
      // Capture already committed. The cookie expiring is harmless.
    }
    return {
      status: captured.outcome === "already_captured" ? "already_processed" : "verified",
      orderReference: captured.orderReference,
    };
  }
  return { status: "error" };
}
