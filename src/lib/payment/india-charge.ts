import { createOrderReference } from "@/contracts/order/reference";
import { STORE_CURRENCY } from "@/contracts/money";
import { liveTotalUndercutsLock, quoteLockExpired } from "@/lib/checkout-quote-lock";
import {
  formatUkPostcode,
  hasCheckoutFieldErrors,
  normalizeCountry,
  normalizeEmailInput,
  validateCheckoutEmail,
} from "@/lib/checkout-validate";
import {
  indiaLockIsChargeable,
  resolvePaymentProvider,
} from "@/lib/payment/resolve-provider";
import { indiaChargeFacts } from "@/lib/order-snapshot";
import { resolveShippingOptions, type ShippingOptionsResult } from "@/lib/shipping/options";
import type { PublicCheckoutDraft } from "@/types/checkout";
import type { PendingOrderInsert, PendingOrderItemInsert, PendingPaymentLine } from "@/lib/payment/pending-attempt";

export type IndiaCharge = {
  order: PendingOrderInsert;
  items: PendingOrderItemInsert[];
    payment: {
      provider: "razorpay";
      amountMinor: number;
      currency: "INR";
      fxRateId: string;
      fxRate: string;
      fxVersion: number;
      frozenAt: number;
      shippingMethodId: string;
      shippingLabel: string;
      estimatedDelivery: string;
      chargeSubtotalMinor: number;
      chargeShippingMinor: number;
      status: "created";
    };
};

export type BuildIndiaChargeResult =
  | { ok: true; charge: IndiaCharge }
  | { ok: false; reason: "invalid" | "empty" | "expired" | "blocked" | "stale" };

export function indiaLiveTotalMinor(
  lines: readonly { lineTotalMinor: number }[],
  shippingMinor: number,
): number | null {
  if (!Number.isInteger(shippingMinor) || shippingMinor < 0) {
    return null;
  }
  let total = shippingMinor;
  for (const line of lines) {
    if (!Number.isInteger(line.lineTotalMinor) || line.lineTotalMinor < 0) {
      return null;
    }
    total += line.lineTotalMinor;
    if (!Number.isSafeInteger(total)) {
      return null;
    }
  }
  return total;
}

/**
 * India charge. PayPal is not a fallback. The order stays GBP.
 * The payment amount is the locked INR total from the same FX rate.
 */
export function buildIndiaCharge(input: {
  draft: PublicCheckoutDraft;
  lines: readonly PendingPaymentLine[];
  userId?: string | null;
  now?: number;
  createReference?: () => string;
  /** Tests can supply a priced rate. Production uses the live catalogue. */
  shippingQuote?: ShippingOptionsResult;
}): BuildIndiaChargeResult {
  const now = input.now ?? Date.now();
  if (input.draft.lockExpired) {
    return { ok: false, reason: "expired" };
  }
  const lock = input.draft.quoteLock;
  if (lock && quoteLockExpired(lock, now)) {
    return { ok: false, reason: "expired" };
  }
  const country = normalizeCountry(input.draft.country);
  const resolved = resolvePaymentProvider({
    country,
    currency: lock?.chargeCurrency ?? null,
  });
  if (!resolved.ok || resolved.provider !== "razorpay") {
    return { ok: false, reason: "blocked" };
  }
  if (!lock || !indiaLockIsChargeable(lock) || !lock.fxRateId || !lock.fxRate || lock.fxVersion == null) {
    return { ok: false, reason: "blocked" };
  }
  const facts = indiaChargeFacts({
    ...lock,
    fxRateId: lock.fxRateId,
    fxRate: lock.fxRate,
    fxVersion: lock.fxVersion,
  });
  const shipping = input.shippingQuote ?? resolveShippingOptions(country);
  const shippingMinor = shipping.status === "priced" ? shipping.options[0]?.amountMinor : null;
  if (shipping.status !== "priced" || !Number.isInteger(shippingMinor) || shippingMinor == null || shippingMinor < 0) {
    return { ok: false, reason: "blocked" };
  }
  const email = normalizeEmailInput(input.draft.email);
  if (hasCheckoutFieldErrors(validateCheckoutEmail(email))) {
    return { ok: false, reason: "invalid" };
  }
  if (input.lines.length === 0) {
    return { ok: false, reason: "empty" };
  }
  let subtotal = 0;
  for (const line of input.lines) {
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      !Number.isInteger(line.unitPriceMinor) ||
      line.unitPriceMinor < 0 ||
      line.lineTotalMinor !== line.unitPriceMinor * line.quantity
    ) {
      return { ok: false, reason: "blocked" };
    }
    const locked = lock.lines.find((entry) => entry.variantId === line.productVariantId);
    if (!locked || locked.quantity !== line.quantity) {
      return { ok: false, reason: "blocked" };
    }
    subtotal += locked.unitPriceMinor * line.quantity;
  }
  if (subtotal !== lock.baseSubtotalMinor) {
    return { ok: false, reason: "blocked" };
  }
  const liveTotal = indiaLiveTotalMinor(input.lines, shippingMinor);
  if (liveTotal == null || liveTotalUndercutsLock(lock, liveTotal)) {
    return { ok: false, reason: "stale" };
  }
  const reference = (input.createReference ?? createOrderReference)();
  const postcode = input.draft.postcode.trim();
  const charge: IndiaCharge = {
    order: {
      order_reference: reference,
      user_id: input.userId ?? null,
      customer_email: email,
      customer_first_name: input.draft.firstName.trim(),
      customer_last_name: input.draft.lastName.trim(),
      status: "checkout",
      payment_status: "created",
      currency: STORE_CURRENCY,
      subtotal_minor: lock.baseSubtotalMinor,
      shipping_minor: lock.baseShippingMinor,
      total_minor: lock.baseSubtotalMinor + lock.baseShippingMinor,
      delivery_address: {
        first_name: input.draft.firstName.trim(),
        last_name: input.draft.lastName.trim(),
        address_line_1: input.draft.line1.trim(),
        address_line_2: input.draft.line2.trim(),
        city: input.draft.city.trim(),
        county: input.draft.county.trim(),
        postcode: country === "GB" ? formatUkPostcode(postcode) : postcode,
        country,
      },
    },
    items: input.lines.map((line) => {
      const locked = lock.lines.find((entry) => entry.variantId === line.productVariantId);
      const unitPriceMinor = locked?.unitPriceMinor ?? line.unitPriceMinor;
      return {
        product_id: line.productId,
        product_variant_id: line.productVariantId,
        sku: line.sku,
        product_name: line.productName,
        colour_name: line.colourName,
        variant_name: line.variantName,
        quantity: line.quantity,
        unit_price_minor: unitPriceMinor,
        line_total_minor: unitPriceMinor * line.quantity,
        product_snapshot: line.productSnapshot ?? {
          sku: line.sku,
          product_name: line.productName,
          colour_name: line.colourName,
          variant_name: line.variantName,
          quantity: line.quantity,
          unit_price_minor: unitPriceMinor,
        },
      };
    }),
    payment: {
      provider: "razorpay",
      amountMinor: lock.chargeTotalMinor,
      currency: "INR",
      fxRateId: facts.fx_rate_id ?? lock.fxRateId,
      fxRate: facts.fx_rate ?? lock.fxRate,
      fxVersion: facts.fx_version ?? lock.fxVersion,
      frozenAt: lock.frozenAt,
      shippingMethodId: facts.shipping_method_id ?? lock.shippingMethodId,
      shippingLabel: facts.shipping_label ?? lock.shippingLabel,
      estimatedDelivery: facts.estimated_delivery ?? lock.estimatedDelivery,
      chargeSubtotalMinor: facts.charge_subtotal_minor,
      chargeShippingMinor: facts.charge_shipping_minor,
      status: "created",
    },
  };
  return { ok: true, charge };
}
