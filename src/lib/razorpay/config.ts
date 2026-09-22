import "server-only";

/**
 * Server-only Razorpay credentials. Never prefix secrets with `NEXT_PUBLIC_`.
 * The public key id for Checkout.js is a later client concern and is not
 * resolved here.
 */

export type RazorpayServerConfig = {
  keyId: string;
  keySecret: string;
};

export type RazorpayServerConfigResult =
  | { ok: true; config: RazorpayServerConfig }
  | { ok: false; issues: string[] };

export type RazorpayWebhookSecretResult =
  | { ok: true; webhookSecret: string }
  | { ok: false; issues: string[] };

function readEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function resolveRazorpayServerConfig(): RazorpayServerConfigResult {
  const keyId = readEnv(process.env.RAZORPAY_KEY_ID);
  const keySecret = readEnv(process.env.RAZORPAY_KEY_SECRET);
  const issues: string[] = [];
  if (!keyId) {
    issues.push("RAZORPAY_KEY_ID is not set");
  }
  if (!keySecret) {
    issues.push("RAZORPAY_KEY_SECRET is not set");
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, config: { keyId, keySecret } };
}

export function getRazorpayServerConfig(): RazorpayServerConfig {
  const resolved = resolveRazorpayServerConfig();
  if (!resolved.ok) {
    throw new Error(`Razorpay is not configured: ${resolved.issues.join("; ")}.`);
  }
  return resolved.config;
}

/** Required when a webhook handler exists. Not required to create a Razorpay order. */
export function resolveRazorpayWebhookSecret(): RazorpayWebhookSecretResult {
  const webhookSecret = readEnv(process.env.RAZORPAY_WEBHOOK_SECRET);
  if (!webhookSecret) {
    return { ok: false, issues: ["RAZORPAY_WEBHOOK_SECRET is not set"] };
  }
  return { ok: true, webhookSecret };
}
