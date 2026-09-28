"use server";

import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import { isUuid } from "@/lib/ids";
import { resolvePayPalServerConfig } from "@/lib/paypal/config";
import { initiatePendingPayPalPayment } from "@/services/pending-payment";
import { captureVerifiedPayment } from "@/lib/payment/capture-verified";
import { verifyPayPalClientReturn } from "@/lib/paypal/verify-client-return";

export type CheckoutPaymentStartResult =
  | {
      status: "ok";
      paymentId: string;
      orderReference: string;
      providerOrderId: string;
      /** Public PayPal Client ID — safe for the browser. Never the secret. */
      clientId: string;
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
  if (
    typeof input.paymentId !== "string" ||
    !isUuid(input.paymentId) ||
    typeof input.paypalOrderId !== "string"
  ) {
    return { status: "error" };
  }

  const verified = await verifyPayPalClientReturn({
    paymentId: input.paymentId,
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
    return {
      status: captured.outcome === "already_captured" ? "already_processed" : "verified",
      orderReference: captured.orderReference,
    };
  }
  return { status: "error" };
}
