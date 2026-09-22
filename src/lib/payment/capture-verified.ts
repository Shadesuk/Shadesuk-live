import "server-only";

import { PAYMENT_PROVIDER_RAZORPAY } from "@/contracts/payment/schema";
import { STORE_CURRENCY } from "@/contracts/money";
import { isUuid } from "@/lib/ids";
import { onVerifiedPaymentCaptured } from "@/lib/payment/after-captured";
import {
  createSupabasePaymentCaptureStore,
  type PaymentCaptureRecord,
  type PaymentCaptureStore,
} from "@/lib/payment/capture-store";
import { readGuestCartSessionId } from "@/lib/guest-cart-cookie";
import type { VerifyCheckoutResult } from "@/lib/payment/verify-checkout";

export type ServerVerifiedRazorpayPayment =
  | Extract<VerifyCheckoutResult, { outcome: "verified" }>
  | Extract<VerifyCheckoutResult, { outcome: "already_captured" }>;

export type CaptureRejectReason =
  | "invalid_input"
  | "unknown_payment"
  | "unknown_order"
  | "missing_order_items"
  | "order_mismatch"
  | "provider_mismatch"
  | "provider_payment_mismatch"
  | "provider_order_mismatch"
  | "ineligible"
  | "payment_failed"
  | "payment_cancelled"
  | "inventory_insufficient"
  | "amount_invalid"
  | "currency_mismatch";

export type CaptureVerifiedPaymentResult =
  | {
      outcome: "captured";
      paymentId: string;
      orderId: string;
      orderReference: string;
    }
  | {
      outcome: "already_captured";
      paymentId: string;
      orderId: string;
      orderReference: string;
    }
  | { outcome: "rejected"; reason: CaptureRejectReason }
  | { outcome: "failed"; reason: "write_failed" };

export type CaptureVerifiedPaymentDependencies = {
  store?: PaymentCaptureStore;
  onVerifiedPaymentCaptured?: (orderId: string) => Promise<void>;
  resolveCheckoutSessionId?: () => Promise<string | null>;
};

/**
 * Single application-level path that turns a server-verified Razorpay
 * payment into a captured SHADESUK order.
 *
 * Accepts only `verifyRazorpayCheckoutPayment` results. Does not verify
 * signatures. Does not roll back if the post-capture email hook fails.
 */
export async function captureVerifiedRazorpayPayment(
  verified: ServerVerifiedRazorpayPayment,
  dependencies?: CaptureVerifiedPaymentDependencies,
): Promise<CaptureVerifiedPaymentResult> {
  const paymentId = typeof verified.paymentId === "string" ? verified.paymentId.trim() : "";
  const orderId = typeof verified.orderId === "string" ? verified.orderId.trim() : "";
  if (!isUuid(paymentId) || !isUuid(orderId)) {
    return { outcome: "rejected", reason: "invalid_input" };
  }

  const store = dependencies?.store ?? createSupabasePaymentCaptureStore();
  const loaded = await store.loadByPaymentId(paymentId);
  if (!loaded) {
    return { outcome: "rejected", reason: "unknown_payment" };
  }
  if (loaded.order.id !== loaded.payment.order_id) {
    return { outcome: "rejected", reason: "order_mismatch" };
  }
  if (loaded.order.id !== orderId || loaded.payment.order_id !== orderId) {
    return { outcome: "rejected", reason: "order_mismatch" };
  }

  if (isPaymentAlreadyCaptured(loaded)) {
    if (loaded.order.payment_status !== "captured") {
      try {
        await store.markOrderPaymentCaptured(loaded.order.id);
      } catch {
        // Payment is already captured; order heal is retryable.
      }
    }
    return alreadyCaptured(loaded);
  }

  const eligibility = eligibilityRejection(loaded);
  if (eligibility) {
    return eligibility;
  }
  if (loaded.payment.provider !== PAYMENT_PROVIDER_RAZORPAY) {
    return { outcome: "rejected", reason: "provider_mismatch" };
  }
  if (loaded.payment.currency !== STORE_CURRENCY || loaded.order.currency !== STORE_CURRENCY) {
    return { outcome: "rejected", reason: "currency_mismatch" };
  }
  if (
    !Number.isInteger(loaded.payment.amount_minor) ||
    loaded.payment.amount_minor < 1 ||
    loaded.payment.amount_minor !== loaded.order.total_minor
  ) {
    return { outcome: "rejected", reason: "amount_invalid" };
  }

  if (verified.outcome !== "verified") {
    return { outcome: "rejected", reason: "ineligible" };
  }

  const providerOrderId = verified.providerOrderId.trim();
  const providerPaymentId = verified.providerPaymentId.trim();
  if (!providerOrderId || !providerPaymentId) {
    return { outcome: "rejected", reason: "invalid_input" };
  }
  if (!loaded.payment.provider_order_id || loaded.payment.provider_order_id !== providerOrderId) {
    return { outcome: "rejected", reason: "provider_order_mismatch" };
  }
  if (
    loaded.payment.provider_payment_id &&
    loaded.payment.provider_payment_id !== providerPaymentId
  ) {
    return { outcome: "rejected", reason: "provider_payment_mismatch" };
  }

  if (loaded.items.length === 0) {
    return { outcome: "rejected", reason: "missing_order_items" };
  }

  const needs = inventoryNeeds(loaded);
  if (!needs) {
    return { outcome: "rejected", reason: "missing_order_items" };
  }
  const stocks = await store.loadVariantStock(needs.map((need) => need.variantId));
  for (const need of needs) {
    const stock = stocks.get(need.variantId);
    if (stock == null || stock < need.quantity) {
      return { outcome: "rejected", reason: "inventory_insufficient" };
    }
  }

  const capturedAt = new Date().toISOString();
  let capturedPayment;
  try {
    capturedPayment = await store.capturePayment({
      paymentId: loaded.payment.id,
      providerPaymentId,
      providerOrderId,
      capturedAt,
    });
  } catch {
    return { outcome: "failed", reason: "write_failed" };
  }

  if (!capturedPayment) {
    const raced = await store.loadByPaymentId(paymentId);
    if (raced && isPaymentAlreadyCaptured(raced) && raced.order.id === orderId) {
      return alreadyCaptured(raced);
    }
    return { outcome: "failed", reason: "write_failed" };
  }

  try {
    const capturedOrder = await store.markOrderPaymentCaptured(loaded.order.id);
    if (!capturedOrder && !isPaymentAlreadyCaptured({ ...loaded, payment: capturedPayment })) {
      const reloaded = await store.loadByPaymentId(paymentId);
      if (!reloaded || reloaded.order.payment_status !== "captured") {
        return { outcome: "failed", reason: "write_failed" };
      }
    }
  } catch {
    return { outcome: "failed", reason: "write_failed" };
  }

  for (const need of needs) {
    const expectedStock = stocks.get(need.variantId);
    if (expectedStock == null) {
      continue;
    }
    try {
      await store.decrementVariantStock({
        variantId: need.variantId,
        quantity: need.quantity,
        expectedStock,
      });
    } catch {
      // Payment is already captured; do not roll back. Retry will not decrement again.
    }
  }

  const sessionId = loaded.order.user_id
    ? null
    : await resolveSessionId(dependencies);
  try {
    await store.convertActiveCheckoutCart({
      userId: loaded.order.user_id,
      sessionId,
    });
  } catch {
    // Payment is already captured; cart conversion is retry-safe via status=active filter.
  }

  const notify = dependencies?.onVerifiedPaymentCaptured ?? onVerifiedPaymentCaptured;
  try {
    await notify(loaded.order.id);
  } catch {
    // Downstream email must not un-capture the payment.
  }

  return {
    outcome: "captured",
    paymentId: capturedPayment.id,
    orderId: loaded.order.id,
    orderReference: loaded.order.order_reference,
  };
}

function isPaymentAlreadyCaptured(record: PaymentCaptureRecord): boolean {
  return record.payment.status === "captured" || Boolean(record.payment.captured_at);
}

function alreadyCaptured(record: PaymentCaptureRecord): CaptureVerifiedPaymentResult {
  return {
    outcome: "already_captured",
    paymentId: record.payment.id,
    orderId: record.order.id,
    orderReference: record.order.order_reference,
  };
}

function eligibilityRejection(record: PaymentCaptureRecord): CaptureVerifiedPaymentResult | null {
  if (record.payment.status === "failed" || record.order.payment_status === "failed") {
    return { outcome: "rejected", reason: "payment_failed" };
  }
  if (record.payment.status === "cancelled" || record.order.payment_status === "cancelled") {
    return { outcome: "rejected", reason: "payment_cancelled" };
  }
  const paymentOk = record.payment.status === "created" || record.payment.status === "authorized";
  const orderOk =
    record.order.payment_status === "created" || record.order.payment_status === "authorized";
  if (!paymentOk || !orderOk || record.payment.captured_at) {
    return { outcome: "rejected", reason: "ineligible" };
  }
  return null;
}

function inventoryNeeds(
  record: PaymentCaptureRecord,
): Array<{ variantId: string; quantity: number }> | null {
  const quantities = new Map<string, number>();
  for (const item of record.items) {
    if (!item.product_variant_id || !isUuid(item.product_variant_id) || item.quantity < 1) {
      return null;
    }
    quantities.set(
      item.product_variant_id,
      (quantities.get(item.product_variant_id) ?? 0) + item.quantity,
    );
  }
  return [...quantities.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
}

async function resolveSessionId(
  dependencies?: CaptureVerifiedPaymentDependencies,
): Promise<string | null> {
  if (dependencies?.resolveCheckoutSessionId) {
    return dependencies.resolveCheckoutSessionId();
  }
  return readGuestCartSessionId();
}
