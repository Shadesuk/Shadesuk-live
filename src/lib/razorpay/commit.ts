import "server-only";

import { readCheckoutDraft } from "@/lib/checkout-draft-store";
import { readGuestCartSessionId } from "@/lib/guest-cart-cookie";
import { buildIndiaCharge } from "@/lib/payment/india-charge";
import { normalizeEmailInput } from "@/lib/checkout-validate";
import {
  clearPaymentAttemptId,
  readPaymentAttemptId,
  rememberPaymentAttemptId,
} from "@/lib/payment/attempt-cookie";
import { getOptionalAccountUser } from "@/lib/account-session";
import { closeCheckoutPaymentAttempt, loadLivePendingPaymentLines } from "@/services/pending-payment";
import { getPublicCart } from "@/services/cart";
import { resolveRazorpayServerConfig } from "./config";
import { isRazorpayOrderId, isRazorpayPaymentId } from "./ids";
import { captureRazorpayPayment, createRazorpayOrder, fetchRazorpayPayment } from "./order";
import { assessRazorpayCapture } from "./assess";
import { indiaCaptureStep } from "./capture-claim";
import { decideIndiaAttemptReuse } from "./reuse";
import { indiaCheckoutWindow } from "./window";
import { razorpayCheckoutSignatureMatches } from "./signature";
import {
  attachIndiaProviderOrder,
  claimIndiaPaymentForCapture,
  flagIndiaCaptureUnrecorded,
  insertIndiaPayment,
  loadOpenIndiaAttempt,
  loadStoredIndiaPayment,
  markIndiaPaymentCaptured,
  markIndiaPaymentFailed,
  releaseIndiaCaptureClaim,
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
      timeoutSeconds: number;
    }
  | { status: "blocked" | "expired" | "invalid" | "empty" | "unavailable" | "stale" | "error" };

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
  const lock = draft.quoteLock;
  if (!lock) {
    return { status: "blocked" };
  }
  const window = indiaCheckoutWindow(lock.frozenAt);
  if (!window.ok) {
    return { status: "expired" };
  }
  const email = normalizeEmailInput(draft.email);
  const reused = await reuseIndiaAttempt({
    userId: user?.id ?? null,
    email,
    frozenAt: lock.frozenAt,
    amountMinor: built.charge.payment.amountMinor,
    lines: lines.map((line) => ({ variantId: line.productVariantId, quantity: line.quantity })),
    keyId: config.config.keyId,
    timeoutSeconds: window.timeoutSeconds,
  });
  if (reused) {
    return reused;
  }
  let persisted;
  try {
    persisted = await insertIndiaPayment(built.charge);
  } catch {
    return { status: "error" };
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
  try {
    await rememberPaymentAttemptId(persisted.paymentId);
  } catch {
    // The attempt is still payable without the reuse cookie.
  }
  return {
    status: "ok",
    paymentId: persisted.paymentId,
    orderReference: persisted.orderReference,
    providerOrderId: provider.order.providerOrderId,
    amountMinor: provider.order.amountMinor,
    currency: "INR",
    keyId: config.config.keyId,
    timeoutSeconds: window.timeoutSeconds,
  };
}

async function reuseIndiaAttempt(input: {
  userId: string | null;
  email: string;
  frozenAt: number;
  amountMinor: number;
  lines: { variantId: string; quantity: number }[];
  keyId: string;
  timeoutSeconds: number;
}): Promise<IndiaCheckoutStart | null> {
  let paymentId: string | null = null;
  try {
    paymentId = await readPaymentAttemptId();
  } catch {
    return null;
  }
  if (!paymentId) {
    return null;
  }
  const open = await loadOpenIndiaAttempt(paymentId);
  const decision = decideIndiaAttemptReuse({
    open,
    ownerUserId: input.userId,
    email: input.email,
    frozenAt: input.frozenAt,
    amountMinor: input.amountMinor,
    lines: input.lines,
  });
  if (decision === "reuse" && open?.providerOrderId) {
    return {
      status: "ok",
      paymentId: open.paymentId,
      orderReference: open.orderReference,
      providerOrderId: open.providerOrderId,
      amountMinor: open.amountMinor,
      currency: "INR",
      keyId: input.keyId,
      timeoutSeconds: input.timeoutSeconds,
    };
  }
  if (decision === "close") {
    await markIndiaPaymentFailed(paymentId, "Checkout changed before payment.");
    try {
      await clearPaymentAttemptId();
    } catch {
      // The closed row is what blocks a second capture.
    }
    return null;
  }
  if (open) {
    try {
      await clearPaymentAttemptId();
    } catch {
      // Leave the other shopper's attempt open.
    }
    return null;
  }
  try {
    await closeCheckoutPaymentAttempt(paymentId, "cancelled", "Checkout moved to India payment.");
  } catch {
    try {
      await clearPaymentAttemptId();
    } catch {
      // A new India attempt can still be created.
    }
  }
  return null;
}

export async function verifyIndiaCheckout(input: {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}): Promise<{ status: "verified" | "already_processed"; orderReference: string } | { status: "error" }> {
  const settled = await verifyIndiaCheckoutSettlement(input);
  if (settled.status === "error") {
    return { status: "error" };
  }
  return settled;
}

async function verifyIndiaCheckoutSettlement(input: {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}): Promise<IndiaSettleResult> {
  const config = resolveRazorpayServerConfig();
  if (!config.ok) {
    return { status: "error", terminal: true };
  }
  if (
    !razorpayCheckoutSignatureMatches({
      orderId: input.providerOrderId,
      paymentId: input.providerPaymentId,
      signature: input.signature,
      secret: config.config.keySecret,
    })
  ) {
    return { status: "error", terminal: true };
  }
  return settleIndiaPayment({
    providerOrderId: input.providerOrderId,
    providerPaymentId: input.providerPaymentId,
    config: config.config,
  });
}

export type IndiaSettleResult =
  | { status: "verified" | "already_processed"; orderReference: string }
  | { status: "error"; terminal: boolean };

export async function settleIndiaPayment(input: {
  providerOrderId: string;
  providerPaymentId: string;
  config: NonNullable<ReturnType<typeof resolveRazorpayServerConfig> & { ok: true }>["config"];
  fetchImpl?: typeof fetch;
}): Promise<IndiaSettleResult> {
  if (!isRazorpayOrderId(input.providerOrderId) || !isRazorpayPaymentId(input.providerPaymentId)) {
    return { status: "error", terminal: true };
  }
  const stored = await loadStoredIndiaPayment(input.providerOrderId);
  if (!stored) {
    return { status: "error", terminal: true };
  }
  const remote = await fetchRazorpayPayment({
    paymentId: input.providerPaymentId,
    config: input.config,
    fetchImpl: input.fetchImpl,
  });
  if (!remote) {
    return { status: "error", terminal: false };
  }
  if (remote.orderId !== input.providerOrderId) {
    await markIndiaPaymentFailed(stored.paymentId, "Razorpay order did not match the payment.");
    return { status: "error", terminal: true };
  }
  const decision = assessRazorpayCapture({
    stored,
    returnedAmountMinor: remote.amountMinor,
    returnedCurrency: remote.currency,
    incomingPaymentId: remote.id,
  });
  if (decision === "duplicate") {
    return { status: "already_processed", orderReference: stored.orderReference };
  }
  if (decision === "reject") {
    if (stored.status === "created" || stored.status === "authorized") {
      await markIndiaPaymentFailed(stored.paymentId, "Razorpay amount did not match the locked quote.");
    }
    return { status: "error", terminal: true };
  }
  let providerPaymentId = remote.id;
  let moneyCaptured = remote.status === "captured";
  if (remote.status === "authorized") {
    const claim = await claimIndiaPaymentForCapture({
      paymentId: stored.paymentId,
      orderId: stored.orderId,
      providerPaymentId: remote.id,
    });
    const step = indiaCaptureStep({ claim, remoteStatus: remote.status });
    if (step === "duplicate") {
      return { status: "already_processed", orderReference: stored.orderReference };
    }
    if (step === "reject") {
      return { status: "error", terminal: true };
    }
    if (step === "error") {
      return { status: "error", terminal: false };
    }
    if (step === "retry") {
      const again = await fetchRazorpayPayment({
        paymentId: remote.id,
        config: input.config,
        fetchImpl: input.fetchImpl,
      });
      const follow = indiaCaptureStep({ claim: "in_progress", remoteStatus: again?.status ?? "" });
      if (
        follow !== "mark" ||
        !again ||
        again.orderId !== input.providerOrderId ||
        again.amountMinor !== stored.amountMinor
      ) {
        return { status: "error", terminal: false };
      }
      moneyCaptured = true;
      providerPaymentId = again.id;
    } else if (step === "capture") {
      const captured = await captureRazorpayPayment({
        paymentId: remote.id,
        amountMinor: stored.amountMinor,
        currency: "INR",
        config: input.config,
        fetchImpl: input.fetchImpl,
      });
      if (!captured) {
        const again = await fetchRazorpayPayment({
          paymentId: remote.id,
          config: input.config,
          fetchImpl: input.fetchImpl,
        });
        if (
          again?.status === "captured" &&
          again.orderId === input.providerOrderId &&
          again.amountMinor === stored.amountMinor
        ) {
          moneyCaptured = true;
          providerPaymentId = again.id;
        } else {
          if (!again || again.status === "authorized") {
            await releaseIndiaCaptureClaim({
              paymentId: stored.paymentId,
              orderId: stored.orderId,
              providerPaymentId: remote.id,
            });
          }
          return { status: "error", terminal: false };
        }
      } else {
        moneyCaptured = true;
      }
    } else {
      return { status: "error", terminal: true };
    }
  } else if (remote.status !== "captured") {
    await markIndiaPaymentFailed(stored.paymentId, "Razorpay did not authorize that payment.");
    return { status: "error", terminal: true };
  }
  const marked = await markIndiaPaymentCaptured({
    paymentId: stored.paymentId,
    orderId: stored.orderId,
    providerPaymentId,
  });
  if (marked === "error" || marked === "rejected") {
    if (moneyCaptured) {
      await flagIndiaCaptureUnrecorded({
        paymentId: stored.paymentId,
        orderId: stored.orderId,
        providerPaymentId,
        orderReference: stored.orderReference,
      });
    }
    return { status: "error", terminal: marked === "rejected" };
  }
  if (marked === "captured") {
    try {
      await clearPaymentAttemptId();
    } catch {
      // The placed order is what matters.
    }
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

export function indiaWebhookHttpStatus(settled: IndiaSettleResult): number {
  if (settled.status !== "error") {
    return 200;
  }
  return settled.terminal ? 200 : 409;
}
