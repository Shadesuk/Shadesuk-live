import { isAdminAppPath, isSafeNextPath } from "@/lib/account-validate";
import { routes } from "@/lib/navigation";

/** Short-lived httpOnly cookie. Not a Supabase session cookie. */
export const AUTH_RETURN_COOKIE = "shadesuk-auth-return";

export const AUTH_RETURN_MAX_AGE_SECONDS = 60 * 10;

const MAX_RETURN_PATH_LENGTH = 512;

const ACCOUNT_ENTRY_PATHS = new Set<string>([
  routes.account,
  routes.accountRegister,
  routes.accountForgotPassword,
  routes.accountResetPassword,
]);

/**
 * Where Google (and the rest of the `next` flow) should land.
 * Query wins, then the cookie set before the provider redirect, then account.
 * `/` is not the fallback — a missing return path must not dump checkout on the homepage.
 */
export function resolveAuthReturnPath(input: {
  queryNext?: string | null;
  cookieNext?: string | null;
  fallback?: string;
}): string {
  const fallback = input.fallback ?? routes.account;
  const fromQuery = safeReturnPath(input.queryNext);
  if (fromQuery) {
    return fromQuery;
  }
  const fromCookie = safeReturnPath(decodeReturnCookie(input.cookieNext));
  if (fromCookie) {
    return fromCookie;
  }
  return fallback;
}

export function encodeAuthReturnCookie(path: string): string {
  return encodeURIComponent(path);
}

export function decodeReturnCookie(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Storefront path worth returning to after sign-in.
 * Account entry screens are excluded so the flow cannot loop.
 * Home is excluded so a bare homepage visit is not treated as an explicit return.
 */
export function authNextFromPathname(pathname: string): string | undefined {
  const safe = safeReturnPath(pathname);
  if (!safe || safe === routes.home || ACCOUNT_ENTRY_PATHS.has(safe)) {
    return undefined;
  }
  if (safe.startsWith("/auth/")) {
    return undefined;
  }
  return safe;
}

export function accountEntryHref(pathname: string): string {
  const next = authNextFromPathname(pathname);
  if (!next) {
    return routes.account;
  }
  return `${routes.account}?next=${encodeURIComponent(next)}`;
}

/**
 * `redirect()` rejects the server-action promise with this digest.
 * That rejection is navigation, not a failed Google sign-in.
 */
export function isFrameworkRedirect(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || value.length > MAX_RETURN_PATH_LENGTH) {
    return null;
  }
  if (!isSafeNextPath(value) || isAdminAppPath(value)) {
    return null;
  }
  return value;
}
