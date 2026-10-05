import { majorToMinorGbp, minorToMajorGbp, STORE_CURRENCY } from "@/contracts/money";
import { UK_STANDARD_DELIVERY } from "@/lib/checkout-copy";
import { normalizeCountry } from "@/lib/checkout-validate";
import { resolveShippingOptions, type ShippingMethodOption } from "@/lib/shipping/options";
import { CHECKOUT_COUNTRY_GB } from "@/types/checkout";
import type { PublicCart } from "@/types/cart";

/** Flat UK standard delivery. Integer pence only. */
export const UK_STANDARD_DELIVERY_MINOR = 465 as const;

export type CheckoutShippingStatus = "priced" | "unavailable" | "unsupported";

export type CheckoutQuote = {
  currency: typeof STORE_CURRENCY;
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  subtotal: number;
  shipping: number;
  total: number;
  shippingStatus: CheckoutShippingStatus;
  shippingLabel: string | null;
  estimatedDelivery: string | null;
};

/**
 * Server-owned checkout totals. Client shipping/total/currency arguments are ignored.
 */
export function authoritativeCheckoutQuote(input: {
  subtotalMinor: number;
  shippingMinor?: number;
  totalMinor?: number;
  currency?: string;
  subtotal?: number;
  shipping?: number;
  total?: number;
  country?: string;
}): CheckoutQuote {
  const subtotalMinor =
    Number.isInteger(input.subtotalMinor) && input.subtotalMinor >= 0 ? input.subtotalMinor : 0;
  const requested = input.country ? normalizeCountry(input.country) : CHECKOUT_COUNTRY_GB;
  if (requested !== CHECKOUT_COUNTRY_GB) {
    const resolved = resolveShippingOptions(requested);
    const option = resolved.status === "priced" ? resolved.options[0] : null;
    if (!option) {
      return unfinishedQuote(subtotalMinor, resolved.status === "unsupported" ? "unsupported" : "unavailable");
    }
    return pricedQuote(subtotalMinor, option);
  }
  const uk = resolveShippingOptions(CHECKOUT_COUNTRY_GB);
  const option = uk.status === "priced" ? uk.options[0] : null;
  const shippingMinor = option?.amountMinor ?? UK_STANDARD_DELIVERY_MINOR;
  return pricedQuote(subtotalMinor, {
    methodId: option?.methodId ?? "uk-standard",
    zoneId: "uk",
    code: option?.code ?? "standard",
    label: option?.label ?? UK_STANDARD_DELIVERY,
    estimatedDelivery: option?.estimatedDelivery ?? "2+ weeks",
    currency: STORE_CURRENCY,
    amountMinor: shippingMinor,
  });
}

export function checkoutQuoteFromCart(cart: PublicCart, country?: string): CheckoutQuote {
  const subtotalMinor = cart.items.reduce((sum, item) => {
    if (item.currency !== STORE_CURRENCY) {
      return sum;
    }
    return sum + majorToMinorGbp(item.unitPrice) * item.quantity;
  }, 0);
  return authoritativeCheckoutQuote({ subtotalMinor, country });
}

function pricedQuote(subtotalMinor: number, option: ShippingMethodOption): CheckoutQuote {
  const totalMinor = subtotalMinor + option.amountMinor;
  return {
    currency: STORE_CURRENCY,
    subtotalMinor,
    shippingMinor: option.amountMinor,
    totalMinor,
    subtotal: minorToMajorGbp(subtotalMinor),
    shipping: minorToMajorGbp(option.amountMinor),
    total: minorToMajorGbp(totalMinor),
    shippingStatus: "priced",
    shippingLabel: option.label,
    estimatedDelivery: option.estimatedDelivery,
  };
}

/**
 * An unpriced quote keeps totalMinor equal to the subtotal so the summary can
 * show money. That figure is not chargeable unless shippingStatus is priced.
 */
export function quoteIsChargeable(quote: CheckoutQuote): boolean {
  if (quote.shippingStatus !== "priced") {
    return false;
  }
  return quote.totalMinor === quote.subtotalMinor + quote.shippingMinor && quote.shippingMinor >= 0;
}

function unfinishedQuote(subtotalMinor: number, shippingStatus: Exclude<CheckoutShippingStatus, "priced">): CheckoutQuote {
  return {
    currency: STORE_CURRENCY,
    subtotalMinor,
    shippingMinor: 0,
    totalMinor: subtotalMinor,
    subtotal: minorToMajorGbp(subtotalMinor),
    shipping: 0,
    total: minorToMajorGbp(subtotalMinor),
    shippingStatus,
    shippingLabel: null,
    estimatedDelivery: null,
  };
}

export function checkoutUnavailableBlocked(cart: PublicCart): boolean {
  if (cart.items.length === 0) {
    return true;
  }
  return cart.issues.some(
    (issue) => issue.issue === "product_removed" || issue.issue === "variant_unavailable",
  );
}

export function checkoutHasPriceChange(cart: PublicCart): boolean {
  return (
    cart.issues.some((issue) => issue.issue === "price_changed") ||
    cart.items.some((item) => item.issue === "price_changed")
  );
}
