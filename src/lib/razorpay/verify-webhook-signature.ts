import "server-only";

import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/guest-cookie-hmac";

/**
 * Official Razorpay webhook signature:
 * HMAC_SHA256(raw_body, webhook_secret) compared to X-Razorpay-Signature.
 * The raw body must be the exact bytes received, not re-serialized JSON.
 */
export function verifyRazorpayWebhookSignature(input: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): boolean {
  const rawBody = input.rawBody;
  const signature = input.signature.trim();
  const secret = input.webhookSecret;
  if (!rawBody || !signature || !secret) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}
