import "server-only";

import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/guest-cookie-hmac";

/**
 * Official Checkout success signature:
 * HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 */
export function verifyRazorpayCheckoutSignature(input: {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const orderId = input.providerOrderId.trim();
  const paymentId = input.providerPaymentId.trim();
  const signature = input.signature.trim();
  const secret = input.keySecret;
  if (!orderId || !paymentId || !signature || !secret) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(expected, signature);
}
