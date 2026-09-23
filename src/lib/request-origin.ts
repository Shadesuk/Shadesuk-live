import { isAllowedCartActionOrigin } from "@/lib/cart-origin";

/**
 * Origin for the OAuth callback. Must be the host the shopper is actually on
 * so the PKCE and checkout cookies survive the round trip. Falls back to the
 * configured site origin when the request headers are missing or untrusted.
 */
export function resolveActionOrigin(input: {
  origin: string | null;
  forwardedHost: string | null;
  host: string | null;
  forwardedProto: string | null;
  siteUrl: string;
}): string {
  const siteOrigin = parseOrigin(input.siteUrl) ?? "http://localhost:3000";
  const requestHost = firstHeader(input.forwardedHost) ?? firstHeader(input.host);
  const fromOrigin = parseOrigin(input.origin);
  if (
    fromOrigin &&
    isAllowedCartActionOrigin({
      origin: fromOrigin,
      referer: null,
      host: requestHost,
      siteUrl: siteOrigin,
    })
  ) {
    return fromOrigin;
  }

  if (requestHost && /^[a-z0-9.-]+(?::\d+)?$/i.test(requestHost)) {
    const proto = firstHeader(input.forwardedProto) ?? "https";
    if (proto === "http" || proto === "https") {
      const built = `${proto}://${requestHost}`;
      if (
        isAllowedCartActionOrigin({
          origin: built,
          referer: null,
          host: requestHost,
          siteUrl: siteOrigin,
        })
      ) {
        return built;
      }
    }
  }

  return siteOrigin;
}

function parseOrigin(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function firstHeader(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}
