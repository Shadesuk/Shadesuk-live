import "server-only";

import { dispatchOrderConfirmationEmail } from "@/lib/email/order-confirmation";

/**
 * Authoritative post-commit side effect after verified payment capture.
 *
 * Invoke this only after the commerce transaction that set
 * `orders.payment_status = captured` has committed. The application currently
 * has no in-app capture writer (provider webhooks remain out of scope); this
 * is the single hook that writer must call. Do not call from checkout review,
 * frontend success UI, analytics, or admin fulfilment updates.
 *
 * Email failures are swallowed by the dispatcher and must never roll back
 * the captured order or payment.
 */
export async function onVerifiedPaymentCaptured(orderId: string): Promise<void> {
  await dispatchOrderConfirmationEmail(orderId);
}
