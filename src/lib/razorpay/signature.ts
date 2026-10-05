import { createHmac, timingSafeEqual } from "node:crypto";

/** Checkout success signature is HMAC-SHA256 of `order_id|payment_id`. */
export function razorpayCheckoutSignature(orderId: string, paymentId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function razorpayCheckoutSignatureMatches(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): boolean {
  if (!input.orderId || !input.paymentId || !input.signature || !input.secret) {
    return false;
  }
  const expected = razorpayCheckoutSignature(input.orderId, input.paymentId, input.secret);
  return hexTimingSafeEqual(expected, input.signature.trim());
}

/** Webhook signature is HMAC-SHA256 of the raw body, not a re-serialized object. */
export function razorpayWebhookSignatureMatches(rawBody: string, signature: string, secret: string): boolean {
  if (!rawBody || !signature || !secret) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return hexTimingSafeEqual(expected, signature.trim());
}

function hexTimingSafeEqual(expected: string, actual: string): boolean {
  if (!/^[0-9a-f]+$/i.test(actual) || expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(actual, "utf8"));
}
