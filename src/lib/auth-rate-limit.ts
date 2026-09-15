/**
 * Process-local limiter for auth mutations. Not a substitute for edge/WAF
 * limits in production; it still bounds naive repeated attempts on one instance.
 */

const WINDOW_MS = 15 * 60 * 1000;
const SIGN_IN_MAX = 8;
const RESET_MAX = 5;
const REGISTER_MAX = 6;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function authAttemptAllowed(
  kind: "sign-in" | "reset" | "register",
  key: string,
): boolean {
  const max = kind === "reset" ? RESET_MAX : kind === "register" ? REGISTER_MAX : SIGN_IN_MAX;
  const id = `${kind}:${key}`;
  const now = Date.now();
  const current = buckets.get(id);
  if (!current || current.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= max) {
    return false;
  }
  current.count += 1;
  return true;
}

export function authRateLimitKey(ip: string | null, email: string): string {
  return `${ip ?? "unknown"}:${email.trim().toLowerCase()}`;
}
