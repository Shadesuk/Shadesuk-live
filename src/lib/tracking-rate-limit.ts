/**
 * Process-local limiter for guest tracking lookups.
 * 5 attempts / 15 minutes / ip + order_reference (invalid refs share a bucket).
 * Not a substitute for edge/WAF limits in production.
 */

import { GUEST_TRACKING_RATE_LIMIT } from "@/contracts/order/tracking";
import { parseOrderReferenceInput } from "@/contracts/order/reference";

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = GUEST_TRACKING_RATE_LIMIT.windowSeconds * 1000;
const buckets = new Map<string, Bucket>();

export function guestTrackingAttemptAllowed(key: string): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= GUEST_TRACKING_RATE_LIMIT.maxAttempts) {
    return false;
  }
  current.count += 1;
  return true;
}

export function guestTrackingRateLimitKey(
  ip: string | null,
  orderReference: string,
): string {
  const parsed = parseOrderReferenceInput(orderReference);
  return `${ip ?? "unknown"}:${parsed ?? "invalid"}`;
}

export function resetGuestTrackingRateLimitForTests(): void {
  buckets.clear();
}
