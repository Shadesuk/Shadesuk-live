/**
 * Guest cart cookie Secure flag (PR #13).
 * Production must be Secure. Localhost http may be false so the cookie can
 * persist during `next start` on http://127.0.0.1.
 */
export function guestCartCookieSecure(input?: {
  nodeEnv?: string | undefined;
  siteUrl?: string | undefined;
}): boolean {
  const nodeEnv = input?.nodeEnv ?? process.env.NODE_ENV;
  const siteUrl = (input?.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();

  if (siteUrl.toLowerCase().startsWith("https://")) {
    return true;
  }

  if (nodeEnv === "production") {
    return !isLoopbackHttp(siteUrl);
  }

  return false;
}

function isLoopbackHttp(siteUrl: string): boolean {
  if (!siteUrl.toLowerCase().startsWith("http://")) {
    return false;
  }
  try {
    const host = new URL(siteUrl).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}
