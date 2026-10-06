/**
 * Process-local limiter for browser geolocation reverse geocodes.
 * The Geoapify key stays on the server.
 */

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 8;
const BURST_WINDOW_MS = 10 * 1000;
const MAX_PER_BURST = 3;
const buckets = new Map<string, Bucket>();

export function geocodeAttemptAllowed(ip: string | null): boolean {
  const key = ip?.trim() || "unknown";
  const now = Date.now();
  return consume(`m:${key}`, MAX_PER_WINDOW, WINDOW_MS, now) && consume(`b:${key}`, MAX_PER_BURST, BURST_WINDOW_MS, now);
}

function consume(key: string, max: number, windowMs: number, now: number): boolean {
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
