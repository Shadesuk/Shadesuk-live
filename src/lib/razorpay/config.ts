import "server-only";

/**
 * Server-only Razorpay credentials.
 * RAZORPAY_MODE is `test` or `live`. The key id prefix must match that mode.
 * An unset mode, or a prefix that does not match, fails closed.
 * Production sets RAZORPAY_MODE=live together with the live key id, key secret,
 * and webhook secret. This module does not invent those values.
 * The webhook secret on a successful config is the secret for that mode.
 * The key id is returned from a Server Action for checkout.js. Never NEXT_PUBLIC_.
 */

export type RazorpayMode = "test" | "live";

export type RazorpayServerConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  mode: RazorpayMode;
};

export type RazorpayServerConfigResult =
  | { ok: true; config: RazorpayServerConfig }
  | { ok: false; reason: "missing" | "mode" | "key_mismatch" };

const TEST_KEY = /^rzp_test_[A-Za-z0-9]+$/;
const LIVE_KEY = /^rzp_live_[A-Za-z0-9]+$/;

export function resolveRazorpayMode(raw?: string): RazorpayMode | null {
  const mode = raw?.trim().toLowerCase();
  if (mode === "test" || mode === "live") {
    return mode;
  }
  return null;
}

export function resolveRazorpayServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): RazorpayServerConfigResult {
  const keyId = env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";
  if (!keyId || !keySecret || !webhookSecret) {
    return { ok: false, reason: "missing" };
  }
  const mode = resolveRazorpayMode(env.RAZORPAY_MODE);
  if (!mode) {
    return { ok: false, reason: "mode" };
  }
  const prefixOk = mode === "test" ? TEST_KEY.test(keyId) : LIVE_KEY.test(keyId);
  if (!prefixOk) {
    return { ok: false, reason: "key_mismatch" };
  }
  return { ok: true, config: { keyId, keySecret, webhookSecret, mode } };
}
