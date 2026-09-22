"use server";

import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import { isUuid } from "@/lib/ids";
import { resolveRazorpayServerConfig } from "@/lib/razorpay/config";
import { initiatePendingRazorpayPayment } from "@/services/pending-payment";
import { verifyRazorpayCheckoutPayment } from "@/lib/payment/verify-checkout";

export type CheckoutPaymentStartResult =
  | {
      status: "ok";
      paymentId: string;
      orderReference: string;
      providerOrderId: string;
      publicKeyId: string;
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
  | { status: "already_processed" }
  | { status: "error" };

/**
 * Starts a pending Razorpay attempt. Accepts no client money fields.
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

  const started = await initiatePendingRazorpayPayment();
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

  const config = resolveRazorpayServerConfig();
  if (!config.ok) {
    return { status: "error" };
  }

  return {
    status: "ok",
    paymentId: started.paymentId,
    orderReference: started.orderReference,
    providerOrderId: started.providerOrderId,
    publicKeyId: config.config.keyId,
    amountMinor: started.amountMinor,
    currency: "GBP",
  };
}

export async function verifyCheckoutPaymentAction(input: {
  paymentId: unknown;
  razorpayPaymentId: unknown;
  razorpayOrderId: unknown;
  razorpaySignature: unknown;
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
    typeof input.razorpayPaymentId !== "string" ||
    typeof input.razorpayOrderId !== "string" ||
    typeof input.razorpaySignature !== "string"
  ) {
    return { status: "error" };
  }

  const verified = await verifyRazorpayCheckoutPayment({
    paymentId: input.paymentId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpayOrderId: input.razorpayOrderId,
    razorpaySignature: input.razorpaySignature,
    amountMinor: input.amountMinor,
    currency: input.currency,
    total: input.total,
    totalMinor: input.totalMinor,
  });

  if (verified.outcome === "verified") {
    return { status: "verified", orderReference: verified.orderReference };
  }
  if (verified.outcome === "already_captured") {
    return { status: "already_processed" };
  }
  return { status: "error" };
}
