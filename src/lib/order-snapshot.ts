import type { CheckoutQuoteLock } from "@/lib/checkout-quote-lock";
import type { CheckoutQuote } from "@/lib/checkout-quote";

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
    charge_subtotal_minor: input.quote.subtotalMinor,
    charge_shipping_minor: input.quote.shippingMinor,
  };
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
