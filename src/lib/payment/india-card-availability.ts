import "server-only";

import { resolveRazorpayServerConfig } from "@/lib/razorpay/config";

/**
 * Same server check Review uses before it can open card payment.
 * Missing config and a non-test key both resolve unavailable.
 */
export function indiaCardPaymentConfigured(): boolean {
  return resolveRazorpayServerConfig().ok;
}
