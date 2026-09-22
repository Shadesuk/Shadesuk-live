import "server-only";

/**
 * Capture-time integration point for the PR #46 Resend stack.
 *
 * This branch does not rebuild `dispatchOrderConfirmationEmail`.
 * `captureVerifiedRazorpayPayment` calls this only after the captured
 * payment/order state has been committed. Email failure must never roll
 * back capture.
 *
 * When PR #46 is merged, replace this no-op with that stack's
 * order-confirmation dispatcher. Do not import Resend from here.
 */
export async function onVerifiedPaymentCaptured(orderId: string): Promise<void> {
  void orderId;
}
