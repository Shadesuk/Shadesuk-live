import { majorToMinorGbp, minorToMajorGbp, STORE_CURRENCY } from "@/contracts/money";
import type { PublicCart } from "@/types/cart";

/** Flat UK standard delivery. Integer pence only. */
export const UK_STANDARD_DELIVERY_MINOR = 465 as const;

export type CheckoutQuote = {
  currency: typeof STORE_CURRENCY;
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  subtotal: number;
  shipping: number;
  total: number;
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
}): CheckoutQuote {
  const subtotalMinor =
    Number.isInteger(input.subtotalMinor) && input.subtotalMinor >= 0 ? input.subtotalMinor : 0;
  const shippingMinor = UK_STANDARD_DELIVERY_MINOR;
  const totalMinor = subtotalMinor + shippingMinor;
  return {
    currency: STORE_CURRENCY,
    subtotalMinor,
    shippingMinor,
    totalMinor,
    subtotal: minorToMajorGbp(subtotalMinor),
    shipping: minorToMajorGbp(shippingMinor),
    total: minorToMajorGbp(totalMinor),
  };
}

export function checkoutQuoteFromCart(cart: PublicCart): CheckoutQuote {
  const subtotalMinor = cart.items.reduce((sum, item) => {
    if (item.currency !== STORE_CURRENCY) {
      return sum;
    }
    return sum + majorToMinorGbp(item.unitPrice) * item.quantity;
  }, 0);
  return authoritativeCheckoutQuote({ subtotalMinor });
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
