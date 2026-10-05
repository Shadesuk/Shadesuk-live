import type { CheckoutQuoteLock } from "@/lib/checkout-quote-lock";
import type { CheckoutQuote } from "@/lib/checkout-quote";
import type { PendingPaymentAttempt } from "@/lib/payment/pending-attempt";

/**
 * Facts copied onto the payment when the attempt is created, then into
 * order_charge_snapshots when the payment is captured. The snapshot does
 * not read live FX or the current catalogue.
 */
export type PaymentChargeFacts = {
  fx_rate_id: string | null;
  fx_version: number | null;
  fx_rate: string | null;
  quote_frozen_at: string | null;
  shipping_method_id: string | null;
  shipping_label: string | null;
  estimated_delivery: string | null;
  charge_subtotal_minor: number;
  charge_shipping_minor: number;
};

export function paypalChargeFacts(input: {
  lock: CheckoutQuoteLock | null;
  quote: CheckoutQuote;
  shippingMethodId: string | null;
}): PaymentChargeFacts {
  const lock = input.lock;
  return {
    fx_rate_id: lock?.fxRateId ?? null,
    fx_version: lock?.fxVersion ?? null,
    fx_rate: lock?.fxRate ?? null,
    quote_frozen_at: lock ? new Date(lock.frozenAt).toISOString() : null,
    shipping_method_id: lock?.shippingMethodId ?? input.shippingMethodId,
    shipping_label: lock?.shippingLabel ?? input.quote.shippingLabel,
    estimated_delivery: lock?.estimatedDelivery ?? input.quote.estimatedDelivery,
  charge_subtotal_minor:
    lock && lock.chargeCurrency !== "GBP" ? lock.chargeSubtotalMinor : input.quote.subtotalMinor,
  charge_shipping_minor:
    lock && lock.chargeCurrency !== "GBP" ? lock.chargeShippingMinor : input.quote.shippingMinor,
};
}

/**
 * Mirrors the PayPal branch of insert_order_charge_snapshot plus the
 * order_charge_snapshots CHECKs. A chargeable UK attempt must pass before
 * the provider is captured, because the snapshot insert is in that same
 * transaction and a CHECK failure would roll the capture back.
 */
export function paypalAttemptSatisfiesChargeSnapshot(attempt: PendingPaymentAttempt): boolean {
  const country = String(attempt.order.delivery_address.country ?? "").trim().toUpperCase();
  const chargeSubtotal = attempt.payment.charge_subtotal_minor;
  const chargeShipping = attempt.payment.charge_shipping_minor;
  const optionalText = [
    attempt.payment.shipping_method_id,
    attempt.payment.shipping_label,
    attempt.payment.estimated_delivery,
    attempt.payment.fx_rate_id,
    attempt.payment.fx_rate,
  ];
  const addressKeys = Object.keys(attempt.order.delivery_address);
  return (
    /^[A-Z]{2}$/.test(country) &&
    attempt.order.currency === "GBP" &&
    attempt.payment.provider === "paypal" &&
    (attempt.payment.currency === "GBP" ||
      attempt.payment.currency === "EUR" ||
      attempt.payment.currency === "USD") &&
    attempt.order.subtotal_minor >= 0 &&
    attempt.order.shipping_minor >= 0 &&
    attempt.order.total_minor > 0 &&
    attempt.order.total_minor === attempt.order.subtotal_minor + attempt.order.shipping_minor &&
    chargeSubtotal >= 0 &&
    chargeShipping >= 0 &&
    attempt.payment.amount_minor > 0 &&
    attempt.payment.amount_minor === chargeSubtotal + chargeShipping &&
    (attempt.payment.currency === "GBP"
      ? attempt.payment.amount_minor === attempt.order.total_minor &&
        attempt.payment.fx_rate_id == null
      : Boolean(attempt.payment.fx_rate_id && attempt.payment.quote_frozen_at)) &&
    addressKeys.length > 0 &&
    attempt.items.length > 0 &&
    optionalText.every((value) => value == null || value.trim() !== "")
  );
}

export function indiaChargeFacts(lock: CheckoutQuoteLock & { fxRateId: string; fxRate: string; fxVersion: number }): PaymentChargeFacts {
  return {
    fx_rate_id: lock.fxRateId,
    fx_version: lock.fxVersion,
    fx_rate: lock.fxRate,
    quote_frozen_at: new Date(lock.frozenAt).toISOString(),
    shipping_method_id: lock.shippingMethodId,
    shipping_label: lock.shippingLabel,
    estimated_delivery: lock.estimatedDelivery,
    charge_subtotal_minor: lock.chargeSubtotalMinor,
    charge_shipping_minor: lock.chargeShippingMinor,
  };
}
