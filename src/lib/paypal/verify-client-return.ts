import "server-only";

import type { PaymentStatus } from "@/contracts/order/schema";
import { PAYMENT_PROVIDER_PAYPAL } from "@/contracts/payment/schema";
import { STORE_CURRENCY } from "@/contracts/money";
import { isPayPalChargeCurrency, type PayPalChargeCurrency } from "@/lib/payment/payment-route";
import { isUuid } from "@/lib/ids";
import { capturePayPalOrder } from "@/lib/paypal/capture-order";
import { fetchPayPalOrder } from "@/lib/paypal/fetch-order";
import {
  createSupabasePaymentVerificationStore,
  type PaymentVerificationRecord,
  type PaymentVerificationStore,
} from "@/lib/payment/verification-store";

export type UntrustedPayPalClientReturn = {
  paymentId: string;
  paypalOrderId: string;
  /** Ignored if present — never trust client money. */
  amountMinor?: unknown;
  currency?: unknown;
  total?: unknown;
  totalMinor?: unknown;
};

export type VerifyPayPalClientRejectReason =
  | "invalid_input"
  | "unknown_payment"
  | "order_mismatch"
  | "provider_order_mismatch"
  | "amount_mismatch"
  | "currency_mismatch"
  | "ineligible"
  | "provider_unavailable"
  | "capture_incomplete";

export type VerifyPayPalClientReturnResult =
  | {
      outcome: "verified";
      paymentId: string;
      orderId: string;
      orderReference: string;
      providerOrderId: string;
      providerPaymentId: string;
      amountMinor: number;
      currency: PayPalChargeCurrency;
      paymentStatus: Extract<PaymentStatus, "created" | "authorized">;
      orderPaymentStatus: Extract<PaymentStatus, "created" | "authorized">;
    }
  | { outcome: "already_captured"; paymentId: string; orderId: string }
  | { outcome: "rejected"; reason: VerifyPayPalClientRejectReason };

export type VerifyPayPalClientReturnDependencies = {
  store?: PaymentVerificationStore;
  captureOrder?: typeof capturePayPalOrder;
  fetchOrder?: typeof fetchPayPalOrder;
};

/**
 * Server-side reconcile after PayPal Buttons `onApprove`.
 *
 * Always attempts provider Capture (or GET+reconcile if already captured).
 * Never marks SHADESUK `captured` — callers must use `captureVerifiedPayment`.
 * Never trusts browser redirect / client money alone.
 */
export async function verifyPayPalClientReturn(
  input: UntrustedPayPalClientReturn,
  dependencies?: VerifyPayPalClientReturnDependencies,
): Promise<VerifyPayPalClientReturnResult> {
  const paymentId = typeof input.paymentId === "string" ? input.paymentId.trim() : "";
  const paypalOrderId =
    typeof input.paypalOrderId === "string" ? input.paypalOrderId.trim() : "";
  if (!isUuid(paymentId) || !paypalOrderId) {
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
  if (loaded.payment.provider !== PAYMENT_PROVIDER_PAYPAL) {
    return { outcome: "rejected", reason: "ineligible" };
  }
  if (isCaptured(loaded)) {
    return { outcome: "already_captured", paymentId: loaded.payment.id, orderId: loaded.order.id };
  }
  if (!isEligibleForVerification(loaded)) {
    return { outcome: "rejected", reason: "ineligible" };
  }

  const expectedProviderOrderId = loaded.payment.provider_order_id;
  if (!expectedProviderOrderId || paypalOrderId !== expectedProviderOrderId) {
    return { outcome: "rejected", reason: "provider_order_mismatch" };
  }
  if (loaded.order.currency !== STORE_CURRENCY || !isPayPalChargeCurrency(loaded.payment.currency)) {
    return { outcome: "rejected", reason: "currency_mismatch" };
  }

  const captureOrder = dependencies?.captureOrder ?? capturePayPalOrder;
  const fetchOrder = dependencies?.fetchOrder ?? fetchPayPalOrder;

  let providerPaymentId = "";
  let providerAmountMinor: number | null = null;

  const captured = await captureOrder(expectedProviderOrderId);
  if (captured.ok) {
    providerPaymentId = captured.capture.providerPaymentId;
    providerAmountMinor = captured.capture.amountMinor;
    if (captured.capture.currency !== loaded.payment.currency) {
      return { outcome: "rejected", reason: "currency_mismatch" };
    }
  } else if (captured.alreadyCaptured) {
    const fetched = await fetchOrder(expectedProviderOrderId);
    if (!fetched.ok) {
      return { outcome: "rejected", reason: "provider_unavailable" };
    }
    const fromGet = await reconcileFetched(fetched.order, expectedProviderOrderId, loaded);
    if (fromGet.outcome !== "ok") {
      return fromGet.result;
    }
    providerPaymentId = fromGet.providerPaymentId;
    providerAmountMinor = fromGet.amountMinor;
  } else {
    // Capture failed for another reason — still try GET in case of race.
    const fetched = await fetchOrder(expectedProviderOrderId);
    if (fetched.ok) {
      const fromGet = await reconcileFetched(fetched.order, expectedProviderOrderId, loaded);
      if (fromGet.outcome === "ok") {
        providerPaymentId = fromGet.providerPaymentId;
        providerAmountMinor = fromGet.amountMinor;
      } else {
        return { outcome: "rejected", reason: "provider_unavailable" };
      }
    } else {
      return { outcome: "rejected", reason: "provider_unavailable" };
    }
  }

  if (!providerPaymentId || providerAmountMinor == null) {
    return { outcome: "rejected", reason: "capture_incomplete" };
  }
  if (providerAmountMinor !== loaded.payment.amount_minor) {
    return { outcome: "rejected", reason: "amount_mismatch" };
  }

  try {
    await store.attachProviderPaymentId(loaded.payment.id, providerPaymentId);
  } catch {
    // Capture writer can attach later.
  }

  const paymentStatus = loaded.payment.status === "authorized" ? "authorized" : "created";
  const orderPaymentStatus =
    loaded.order.payment_status === "authorized" ? "authorized" : "created";

  return {
    outcome: "verified",
    paymentId: loaded.payment.id,
    orderId: loaded.order.id,
    orderReference: loaded.order.order_reference,
    providerOrderId: expectedProviderOrderId,
    providerPaymentId,
    amountMinor: loaded.payment.amount_minor,
    currency: loaded.payment.currency,
    paymentStatus,
    orderPaymentStatus,
  };
}

async function reconcileFetched(
  order: {
    providerOrderId: string;
    providerPaymentId: string | null;
    amountMinor: number;
    currency: string;
    captureStatus: string | null;
    providerStatus: string;
    customId: string | null;
  },
  expectedOrderId: string,
  loaded: PaymentVerificationRecord,
): Promise<
  | { outcome: "ok"; providerPaymentId: string; amountMinor: number }
  | { outcome: "reject"; result: VerifyPayPalClientReturnResult }
> {
  if (order.providerOrderId !== expectedOrderId) {
    return {
      outcome: "reject",
      result: { outcome: "rejected", reason: "provider_order_mismatch" },
    };
  }
  if (order.currency !== loaded.payment.currency) {
    return { outcome: "reject", result: { outcome: "rejected", reason: "currency_mismatch" } };
  }
  if (order.customId && order.customId !== loaded.payment.id) {
    return { outcome: "reject", result: { outcome: "rejected", reason: "order_mismatch" } };
  }
  if (
    order.captureStatus !== "COMPLETED" &&
    order.providerStatus !== "COMPLETED"
  ) {
    return {
      outcome: "reject",
      result: { outcome: "rejected", reason: "capture_incomplete" },
    };
  }
  if (!order.providerPaymentId) {
    return {
      outcome: "reject",
      result: { outcome: "rejected", reason: "capture_incomplete" },
    };
  }
  return {
    outcome: "ok",
    providerPaymentId: order.providerPaymentId,
    amountMinor: order.amountMinor,
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
