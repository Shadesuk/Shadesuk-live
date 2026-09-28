/**
 * Supabase sends the shopper to the Site URL (the homepage) when `redirectTo`
 * is not an exact allow-listed callback. The authorization `code` is then on
 * `/?code=…` and `/auth/callback` never runs.
 *
 * Recover only that case: same-origin redirect to `/auth/callback` with the
 * code or a known provider error. Do not copy other query params (`next`
 * would be an open redirect). Do not log the code.
 */

const OAUTH_ERRORS = new Set([
  "access_denied",
  "server_error",
  "temporarily_unavailable",
  "unauthorized_client",
]);

const CODE_PATTERN = /^[A-Za-z0-9._~-]{20,512}$/;

export function oauthCallbackRecoveryPath(url: URL): string | null {
  if (url.pathname !== "/") {
    return null;
  }
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const dest = new URL("/auth/callback", url.origin);
  if (code && CODE_PATTERN.test(code)) {
    dest.searchParams.set("code", code);
  }
  if (error && OAUTH_ERRORS.has(error)) {
    dest.searchParams.set("error", error);
  }
  if (!dest.searchParams.has("code") && !dest.searchParams.has("error")) {
    return null;
  }
  return `${dest.pathname}${dest.search}`;
}
