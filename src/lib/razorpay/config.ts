import "server-only";

/**
 * Server-only Razorpay credentials. Test keys only until Syed says otherwise.
 * The key id is returned from a Server Action for checkout.js. Never NEXT_PUBLIC_.
 */

export type RazorpayServerConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

export type RazorpayServerConfigResult =
  | { ok: true; config: RazorpayServerConfig }
  | { ok: false; reason: "missing" | "live_key" };

const TEST_KEY = /^rzp_test_[A-Za-z0-9]+$/;

export function resolveRazorpayServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): RazorpayServerConfigResult {
  const keyId = env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";
  if (!keyId || !keySecret || !webhookSecret) {
    return { ok: false, reason: "missing" };
  }
  if (!TEST_KEY.test(keyId) || keyId.startsWith("rzp_live_")) {
    return { ok: false, reason: "live_key" };
  }
  return { ok: true, config: { keyId, keySecret, webhookSecret } };
}
