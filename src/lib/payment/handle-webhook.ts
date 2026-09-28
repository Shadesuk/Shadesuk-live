import "server-only";

/**
 * Razorpay webhook handler — retired hard-cut stub (Phase 2).
 *
 * New payments use `provider=paypal`. Phase 4 adds `POST /api/webhooks/paypal`
 * (postback signature verify) and deletes `src/app/api/webhooks/razorpay`.
 * This route remains until Phase 4 so we do not leave a ghost archive path;
 * it fails closed and never marks payments captured.
 */
export type RazorpayWebhookHttpResult = {
  status: 200 | 400 | 503;
  body: { ok: boolean };
};

export type HandleRazorpayWebhookInput = {
  rawBody: string;
  signature: string;
  eventIdHeader?: string;
};

export async function handleRazorpayWebhook(
  _input: HandleRazorpayWebhookInput,
): Promise<RazorpayWebhookHttpResult> {
  return { status: 503, body: { ok: false } };
}
