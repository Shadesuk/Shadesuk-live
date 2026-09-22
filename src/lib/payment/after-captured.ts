import "server-only";

import { dispatchOrderConfirmationEmail } from "@/lib/email/order-confirmation";

/**
 * Authoritative post-commit side effect after verified payment capture.
 *
 * Invoke this only after `captureVerifiedRazorpayPayment` has committed
 * `orders.payment_status = captured`. Do not call from checkout review,
 * Razorpay Checkout callbacks, the Razorpay webhook route, analytics,
 * or admin fulfilment updates.
 *
 * Email failures are swallowed by the dispatcher and must never roll back
 * the captured order or payment.
 */
export async function onVerifiedPaymentCaptured(orderId: string): Promise<void> {
  await dispatchOrderConfirmationEmail(orderId);
}
