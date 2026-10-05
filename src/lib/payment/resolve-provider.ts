import { marketById, marketIdForCountry, resolveConfiguredPaymentProvider } from "@/contracts/markets";
import { quoteLockExpired, type CheckoutQuoteLock } from "@/lib/checkout-quote-lock";
import { normalizeCountry } from "@/lib/checkout-validate";
import { resolveShippingOptions } from "@/lib/shipping/options";
import type { PublicCheckoutDraft } from "@/types/checkout";

/**
 * One payment-provider decision. India + INR is Razorpay.
 * Other supported market currencies are PayPal. Anything else fails closed.
 * A failed India decision is not PayPal.
 */

export type PaymentProviderName = "paypal" | "razorpay";

export type CheckoutPaymentRail = "paypal" | "india" | "unavailable";

export type ResolvedPaymentProvider =
  | { ok: true; provider: PaymentProviderName; currency: string; countryCode: string }
  | { ok: false; reason: "unsupported" };

export function resolvePaymentProvider(input: {
  country: string;
  currency?: string | null;
}): ResolvedPaymentProvider {
  const countryCode = normalizeCountry(input.country);
  const marketId = marketIdForCountry(countryCode);
  const market = marketId ? marketById(marketId) : null;
  if (!market) {
    return { ok: false, reason: "unsupported" };
  }
  const currency = (input.currency ?? market.currency).trim().toUpperCase();
  const provider = resolveConfiguredPaymentProvider({ marketId: market.id, currency });
  if (provider !== "paypal" && provider !== "razorpay") {
    return { ok: false, reason: "unsupported" };
  }
  if (provider === "razorpay" && (countryCode !== "IN" || currency !== "INR")) {
    return { ok: false, reason: "unsupported" };
  }
  return { ok: true, provider, currency, countryCode };
}

/** UI rail. The checkout shell does not name a provider SDK. */
export function checkoutPaymentRail(input: {
  country: string;
  currency?: string | null;
}): CheckoutPaymentRail {
  const resolved = resolvePaymentProvider(input);
  if (!resolved.ok) {
    return "unavailable";
  }
  return resolved.provider === "razorpay" ? "india" : "paypal";
}

/**
 * India can be charged only with a live priced rate, an unexpired INR lock,
 * and the FX row that produced that lock. Otherwise the charge stays closed.
 */
export function indiaChargeReady(draft: PublicCheckoutDraft, now = Date.now()): boolean {
  const lock = draft.quoteLock;
  if (!lock || draft.lockExpired || quoteLockExpired(lock, now)) {
    return false;
  }
  if (!indiaLockIsChargeable(lock)) {
    return false;
  }
  if (normalizeCountry(draft.country) !== "IN" || lock.countryCode !== "IN") {
    return false;
  }
  return resolveShippingOptions("IN").status === "priced";
}

export function indiaLockIsChargeable(lock: CheckoutQuoteLock): boolean {
  return (
    lock.paymentProvider === "razorpay" &&
    lock.chargeCurrency === "INR" &&
    lock.countryCode === "IN" &&
    typeof lock.fxRateId === "string" &&
    lock.fxRateId.length > 0 &&
    typeof lock.fxRate === "string" &&
    lock.fxRate.length > 0 &&
    typeof lock.fxVersion === "number" &&
    Number.isInteger(lock.fxVersion) &&
    lock.fxVersion > 0 &&
    Number.isInteger(lock.chargeTotalMinor) &&
    lock.chargeTotalMinor > 0 &&
    lock.chargeTotalMinor === lock.chargeSubtotalMinor + lock.chargeShippingMinor &&
    lock.taxMinor === 0 &&
    lock.discountMinor === 0
  );
}
