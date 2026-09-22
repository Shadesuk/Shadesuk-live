import "server-only";

import type { PaymentStatus } from "@/contracts/order/schema";
import { PAYMENT_PROVIDER_RAZORPAY } from "@/contracts/payment/schema";
import { STORE_CURRENCY } from "@/contracts/money";
import { isUuid } from "@/lib/ids";
import { resolveRazorpayServerConfig } from "@/lib/razorpay/config";
import {
  fetchRazorpayPayment,
  type FetchedRazorpayPayment,
} from "@/lib/razorpay/fetch-payment";
import { verifyRazorpayCheckoutSignature } from "@/lib/razorpay/verify-signature";
import {
  createSupabasePaymentVerificationStore,
  type PaymentVerificationRecord,
  type PaymentVerificationStore,
} from "@/lib/payment/verification-store";

export type UntrustedCheckoutCallback = {
  paymentId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
  amountMinor?: unknown;
  currency?: unknown;
  total?: unknown;
  totalMinor?: unknown;
};

export type VerifyCheckoutRejectReason =
  | "invalid_input"
  | "invalid_signature"
  | "unknown_payment"
  | "order_mismatch"
  | "provider_order_mismatch"
  | "amount_mismatch"
  | "currency_mismatch"
  | "ineligible"
  | "provider_unavailable";

export type VerifyCheckoutResult =
  | {
      outcome: "verified";
      paymentId: string;
      orderId: string;
      orderReference: string;
      providerOrderId: string;
      providerPaymentId: string;
      amountMinor: number;
      currency: "GBP";
      paymentStatus: Extract<PaymentStatus, "created" | "authorized">;
      orderPaymentStatus: Extract<PaymentStatus, "created" | "authorized">;
    }
  | { outcome: "already_captured"; paymentId: string; orderId: string }
  | { outcome: "rejected"; reason: VerifyCheckoutRejectReason };

export type VerifyCheckoutDependencies = {
  store?: PaymentVerificationStore;
  verifySignature?: typeof verifyRazorpayCheckoutSignature;
  fetchProviderPayment?: (providerPaymentId: string) => Promise<
    { ok: true; payment: FetchedRazorpayPayment } | { ok: false; error: string }
  >;
  keySecret?: string;
};

/**
 * Verifies an untrusted Razorpay Checkout callback.
 * Does not mark captured, decrement stock, convert the cart, or send email.
 */
export async function verifyRazorpayCheckoutPayment(
  input: UntrustedCheckoutCallback,
  dependencies?: VerifyCheckoutDependencies,
): Promise<VerifyCheckoutResult> {
  const paymentId = typeof input.paymentId === "string" ? input.paymentId.trim() : "";
  const razorpayPaymentId =
    typeof input.razorpayPaymentId === "string" ? input.razorpayPaymentId.trim() : "";
  const razorpayOrderId =
    typeof input.razorpayOrderId === "string" ? input.razorpayOrderId.trim() : "";
  const razorpaySignature =
    typeof input.razorpaySignature === "string" ? input.razorpaySignature.trim() : "";
  if (!isUuid(paymentId) || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
    return { outcome: "rejected", reason: "invalid_input" };
  }

  const store = dependencies?.store ?? createSupabasePaymentVerificationStore();
  const loaded = await store.loadByPaymentId(paymentId);
  if (!loaded) {
    return { outcome: "rejected", reason: "unknown_payment" };
  }
  if (loaded.payment.order_id !== loaded.order.id) {
    return { outcome: "rejected", reason: "order_mismatch" };
  }
  if (loaded.payment.provider !== PAYMENT_PROVIDER_RAZORPAY) {
    return { outcome: "rejected", reason: "ineligible" };
  }
  if (isCaptured(loaded)) {
    return { outcome: "already_captured", paymentId: loaded.payment.id, orderId: loaded.order.id };
  }
  if (!isEligibleForVerification(loaded)) {
    return { outcome: "rejected", reason: "ineligible" };
  }

  const expectedProviderOrderId = loaded.payment.provider_order_id;
  if (!expectedProviderOrderId || razorpayOrderId !== expectedProviderOrderId) {
    return { outcome: "rejected", reason: "provider_order_mismatch" };
  }

  const resolvedSecret = resolveKeySecret(dependencies);
  if (!resolvedSecret) {
    return { outcome: "rejected", reason: "provider_unavailable" };
  }

  const verifySignature = dependencies?.verifySignature ?? verifyRazorpayCheckoutSignature;
  const signatureOk = verifySignature({
    providerOrderId: expectedProviderOrderId,
    providerPaymentId: razorpayPaymentId,
    signature: razorpaySignature,
    keySecret: resolvedSecret,
  });
  if (!signatureOk) {
    return { outcome: "rejected", reason: "invalid_signature" };
  }

  const fetchProviderPayment = dependencies?.fetchProviderPayment ?? fetchRazorpayPayment;
  const fetched = await fetchProviderPayment(razorpayPaymentId);
  if (!fetched.ok) {
    return { outcome: "rejected", reason: "provider_unavailable" };
  }
  if (fetched.payment.providerPaymentId !== razorpayPaymentId) {
    return { outcome: "rejected", reason: "unknown_payment" };
  }
  if (fetched.payment.providerOrderId !== expectedProviderOrderId) {
    return { outcome: "rejected", reason: "provider_order_mismatch" };
  }
  if (fetched.payment.currency !== STORE_CURRENCY || loaded.payment.currency !== STORE_CURRENCY) {
    return { outcome: "rejected", reason: "currency_mismatch" };
  }
  if (fetched.payment.amountMinor !== loaded.payment.amount_minor) {
    return { outcome: "rejected", reason: "amount_mismatch" };
  }

  try {
    await store.attachProviderPaymentId(loaded.payment.id, razorpayPaymentId);
  } catch {
    // Verification still succeeded; capture writer can attach the id later.
  }

  const paymentStatus = loaded.payment.status === "authorized" ? "authorized" : "created";
  const orderPaymentStatus = loaded.order.payment_status === "authorized" ? "authorized" : "created";

  return {
    outcome: "verified",
    paymentId: loaded.payment.id,
    orderId: loaded.order.id,
    orderReference: loaded.order.order_reference,
    providerOrderId: expectedProviderOrderId,
    providerPaymentId: razorpayPaymentId,
    amountMinor: loaded.payment.amount_minor,
    currency: "GBP",
    paymentStatus,
    orderPaymentStatus,
  };
}

function isCaptured(record: PaymentVerificationRecord): boolean {
  return (
    record.payment.status === "captured" ||
    record.order.payment_status === "captured" ||
    Boolean(record.payment.captured_at)
  );
}

function isEligibleForVerification(record: PaymentVerificationRecord): boolean {
  if (isCaptured(record)) {
    return false;
  }
  const paymentOk = record.payment.status === "created" || record.payment.status === "authorized";
  const orderOk =
    record.order.payment_status === "created" || record.order.payment_status === "authorized";
  return paymentOk && orderOk && !record.payment.captured_at;
}

function resolveKeySecret(dependencies?: VerifyCheckoutDependencies): string {
  if (typeof dependencies?.keySecret === "string" && dependencies.keySecret) {
    return dependencies.keySecret;
  }
  const resolved = resolveRazorpayServerConfig();
  return resolved.ok ? resolved.config.keySecret : "";
}
