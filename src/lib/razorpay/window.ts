import { QUOTE_LOCK_TTL_MS } from "@/lib/checkout-quote-lock";

/** Leave enough time for checkout.js to close before the lock expires. */
export const INDIA_CHECKOUT_MIN_WINDOW_MS = 60 * 1000;

/**
 * Lock expiry is decided when the Razorpay order is created.
 * `timeoutSeconds` is the checkout.js window and ends at the lock expiry.
 */
export function indiaCheckoutWindow(
  frozenAt: number,
  now = Date.now(),
): { ok: true; timeoutSeconds: number } | { ok: false } {
  if (!Number.isInteger(frozenAt) || frozenAt <= 0) {
    return { ok: false };
  }
  const remaining = QUOTE_LOCK_TTL_MS - (now - frozenAt);
  if (remaining < INDIA_CHECKOUT_MIN_WINDOW_MS) {
    return { ok: false };
  }
  return { ok: true, timeoutSeconds: Math.floor(remaining / 1000) };
}
