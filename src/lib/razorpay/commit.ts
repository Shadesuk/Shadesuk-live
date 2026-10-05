import "server-only";

import { readCheckoutDraft } from "@/lib/checkout-draft-store";
import { readGuestCartSessionId } from "@/lib/guest-cart-cookie";
import { buildIndiaCharge } from "@/lib/payment/india-charge";
import { getOptionalAccountUser } from "@/lib/account-session";
import { loadLivePendingPaymentLines } from "@/services/pending-payment";
import { getPublicCart } from "@/services/cart";
import { resolveRazorpayServerConfig } from "./config";
import { captureRazorpayPayment, createRazorpayOrder, fetchRazorpayPayment } from "./order";
import { assessRazorpayCapture } from "./assess";
import { razorpayCheckoutSignatureMatches } from "./signature";
import {
  attachIndiaProviderOrder,
  insertIndiaPayment,
  loadStoredIndiaPayment,
  markIndiaPaymentCaptured,
  markIndiaPaymentFailed,
} from "./persist";
import { onVerifiedPaymentCaptured } from "@/lib/payment/after-captured";

export type IndiaCheckoutStart =
  | {
      status: "ok";
      paymentId: string;
      orderReference: string;
      providerOrderId: string;
      amountMinor: number;
      currency: "INR";
      keyId: string;
    }
  | { status: "blocked" | "expired" | "invalid" | "empty" | "unavailable" | "error" };

/**
 * Server-only India start. Missing keys, an expired lock, or an unpriced
 * country return an error. This function does not call PayPal.
 */
export async function startIndiaCheckout(): Promise<IndiaCheckoutStart> {
  const config = resolveRazorpayServerConfig();
  if (!config.ok) {
    return { status: "unavailable" };
  }
  const cart = await getPublicCart();
  if (cart.items.length === 0) {
    return { status: "empty" };
  }
  const sessionId = await readGuestCartSessionId();
  const draft = await readCheckoutDraft(sessionId);
  const user = await getOptionalAccountUser();
  const lines = await loadLivePendingPaymentLines(user?.id ?? null);
  if (!lines) {
    return { status: "blocked" };
  }
  const built = buildIndiaCharge({ draft, lines, userId: user?.id ?? null });
  if (!built.ok) {
    return { status: built.reason === "invalid" ? "invalid" : built.reason };
  }
  let persisted;
  try {
    persisted = await insertIndiaPayment(built.charge);
  } catch {
    return { status: "error" };
  }
  const lock = draft.quoteLock;
  if (!lock) {
    await markIndiaPaymentFailed(persisted.paymentId, "The quote lock was missing.");
    return { status: "blocked" };
  }
  const provider = await createRazorpayOrder({
    lock,
    receipt: persisted.paymentId.replace(/-/g, "").slice(0, 40),
    config: config.config,
  });
  if (!provider.ok || provider.order.amountMinor !== built.charge.payment.amountMinor) {
    await markIndiaPaymentFailed(persisted.paymentId, provider.ok ? "Amount mismatch." : provider.error);
    return { status: "error" };
  }
  try {
    await attachIndiaProviderOrder(persisted.paymentId, provider.order.providerOrderId);
  } catch {
    await markIndiaPaymentFailed(persisted.paymentId, "Could not attach the Razorpay order.");
    return { status: "error" };
  }
  return {
    status: "ok",
    paymentId: persisted.paymentId,
    orderReference: persisted.orderReference,
    providerOrderId: provider.order.providerOrderId,
    amountMinor: provider.order.amountMinor,
    currency: "INR",
    keyId: config.config.keyId,
  };
}

export async function verifyIndiaCheckout(input: {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}): Promise<{ status: "verified" | "already_processed"; orderReference: string } | { status: "error" }> {
  const config = resolveRazorpayServerConfig();
  if (!config.ok) {
    return { status: "error" };
  }
  if (
    !razorpayCheckoutSignatureMatches({
      orderId: input.providerOrderId,
      paymentId: input.providerPaymentId,
      signature: input.signature,
      secret: config.config.keySecret,
    })
  ) {
    return { status: "error" };
  }
  return settleIndiaPayment({
    providerOrderId: input.providerOrderId,
    providerPaymentId: input.providerPaymentId,
    config: config.config,
  });
}

export async function settleIndiaPayment(input: {
  providerOrderId: string;
  providerPaymentId: string;
  config: NonNullable<ReturnType<typeof resolveRazorpayServerConfig> & { ok: true }>["config"];
  fetchImpl?: typeof fetch;
}): Promise<{ status: "verified" | "already_processed"; orderReference: string } | { status: "error" }> {
  const stored = await loadStoredIndiaPayment(input.providerOrderId);
  const remote = await fetchRazorpayPayment({
    paymentId: input.providerPaymentId,
    config: input.config,
    fetchImpl: input.fetchImpl,
  });
  if (!stored || !remote || remote.orderId !== input.providerOrderId) {
    return { status: "error" };
  }
  const decision = assessRazorpayCapture({
    stored,
    returnedAmountMinor: remote.amountMinor,
    returnedCurrency: remote.currency,
    incomingPaymentId: remote.id,
  });
  if (decision === "reject") {
    return { status: "error" };
  }
  if (decision === "duplicate") {
    return { status: "already_processed", orderReference: stored.orderReference };
  }
  if (remote.status === "authorized") {
    const captured = await captureRazorpayPayment({
      paymentId: remote.id,
      amountMinor: stored.amountMinor,
      currency: "INR",
      config: input.config,
      fetchImpl: input.fetchImpl,
    });
    if (!captured) {
      return { status: "error" };
    }
  } else if (remote.status !== "captured") {
    return { status: "error" };
  }
  const marked = await markIndiaPaymentCaptured({
    paymentId: stored.paymentId,
    orderId: stored.orderId,
    providerPaymentId: remote.id,
  });
  if (marked === "rejected") {
    return { status: "error" };
  }
  if (marked === "captured") {
    try {
      await onVerifiedPaymentCaptured(stored.orderId);
    } catch {
      // The captured row stays captured if email fails.
    }
  }
  return {
    status: marked === "duplicate" ? "already_processed" : "verified",
    orderReference: stored.orderReference,
  };
}
