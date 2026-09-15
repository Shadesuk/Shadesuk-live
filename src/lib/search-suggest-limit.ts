/**
 * Process-local limiter for GET /api/search/suggest.
 * Not a WAF. Bounds naive scraping on one instance without blocking typing
 * (overlay debounce is 200ms).
 *
 * Leftmost X-Forwarded-For is not used; clientAddressFromHeaders already
 * prefers platform headers and the rightmost forwarded hop.
 */

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 60;
const BURST_WINDOW_MS = 10 * 1000;
const MAX_PER_BURST = 20;

const buckets = new Map<string, Bucket>();

export const SEARCH_SUGGEST_RETRY_AFTER_SECONDS = 10;

export function searchSuggestAttemptAllowed(ip: string | null): boolean {
  const key = ip?.trim() || "unknown";
  const now = Date.now();
  const minute = consumeBucket(`m:${key}`, MAX_PER_WINDOW, WINDOW_MS, now);
  const burst = consumeBucket(`b:${key}`, MAX_PER_BURST, BURST_WINDOW_MS, now);
  return minute && burst;
}

export function resetSearchSuggestRateLimitForTests(): void {
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
