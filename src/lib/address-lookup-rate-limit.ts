/**
 * Process-local limiter for checkout/account address lookup Server Actions.
 * Same bucket pattern as search-suggest-limit. Not a WAF.
 * Bounds Postcodes.io traffic on one instance. Manual address submit is not limited here.
 */

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 40;
const BURST_WINDOW_MS = 10 * 1000;
const MAX_PER_BURST = 15;

const buckets = new Map<string, Bucket>();

export function addressLookupAttemptAllowed(ip: string | null): boolean {
  const key = ip?.trim() || "unknown";
  const now = Date.now();
  const minute = consumeBucket(`m:${key}`, MAX_PER_WINDOW, WINDOW_MS, now);
  const burst = consumeBucket(`b:${key}`, MAX_PER_BURST, BURST_WINDOW_MS, now);
  return minute && burst;
}

export function resetAddressLookupRateLimitForTests(): void {
  buckets.clear();
}

function consumeBucket(key: string, max: number, windowMs: number, now: number): boolean {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) {
    return false;
  }
  current.count += 1;
  return true;
}
