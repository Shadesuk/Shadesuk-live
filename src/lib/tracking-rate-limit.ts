/**
 * Process-local guest tracking limiter. Not a WAF.
 *
 * Every lookup must pass every applicable bucket. A spoofed leftmost
 * X-Forwarded-For cannot reset the budget if the signed client cookie,
 * email fingerprint, or order-reference cap still binds.
 */

import {
  emailRateLimitFingerprint,
  GUEST_TRACKING_RATE_LIMIT,
  normalizeEmail,
} from "@/contracts/order/tracking";
import { parseOrderReferenceInput } from "@/contracts/order/reference";

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = GUEST_TRACKING_RATE_LIMIT.windowSeconds * 1000;
const buckets = new Map<string, Bucket>();

export type GuestTrackingRateLimitInput = {
  ip: string | null;
  limiterId: string | null;
  orderReference: string;
  email: string;
};

export function guestTrackingAttemptAllowed(input: GuestTrackingRateLimitInput): boolean {
  const now = Date.now();
  let allowed = true;
  for (const { key, max } of guestTrackingRateLimitBuckets(input)) {
    if (!consumeBucket(key, max, now)) {
      allowed = false;
    }
  }
  return allowed;
}

export function guestTrackingRateLimitBuckets(
  input: GuestTrackingRateLimitInput,
): Array<{ key: string; max: number }> {
  const reference = parseOrderReferenceInput(input.orderReference) ?? "invalid";
  const ip = input.ip?.trim() || "unknown";
  const email = emailRateLimitFingerprint(normalizeEmail(input.email));
  const limit = GUEST_TRACKING_RATE_LIMIT;
  const keys: Array<{ key: string; max: number }> = [
    { key: `ip-ref:${ip}:${reference}`, max: limit.maxAttempts },
    { key: `email-ref:${email}:${reference}`, max: limit.maxAttempts },
    { key: `ref:${reference}`, max: limit.maxAttemptsPerReference },
    { key: `ip:${ip}`, max: limit.maxAttemptsPerIp },
    { key: `email:${email}`, max: limit.maxAttemptsPerEmail },
  ];
  if (input.limiterId) {
    keys.push({
      key: `client-ref:${input.limiterId}:${reference}`,
      max: limit.maxAttempts,
    });
    keys.push({
      key: `client:${input.limiterId}`,
      max: limit.maxAttemptsPerClient,
    });
  }
  return keys;
}

export function resetGuestTrackingRateLimitForTests(): void {
  buckets.clear();
}

function consumeBucket(key: string, max: number, now: number): boolean {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= max) {
    return false;
  }
  current.count += 1;
  return true;
}
