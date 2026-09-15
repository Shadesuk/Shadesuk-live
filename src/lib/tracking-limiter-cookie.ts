import "server-only";

import { cookies } from "next/headers";
import { guestCartCookieSecure } from "@/lib/guest-cart-cookie-secure";
import {
  requireGuestCookieSecret,
  resolveGuestCookieSecret,
} from "@/lib/guest-cookie-hmac";
import {
  createTrackingLimiterId,
  decodeTrackingLimiterCookie,
  encodeTrackingLimiterCookie,
  TRACKING_LIMITER_COOKIE_MAX_AGE_SECONDS,
  TRACKING_LIMITER_COOKIE_NAME,
} from "@/lib/tracking-limiter";

/**
 * Bind this request to a signed limiter id. The id never goes in action JSON.
 * Unsigned cookies are ignored. Production cannot mint without a real secret.
 */
export async function bindTrackingLimiterId(): Promise<string | null> {
  const store = await cookies();
  const existing = decodeTrackingLimiterCookie(
    store.get(TRACKING_LIMITER_COOKIE_NAME)?.value,
    resolveGuestCookieSecret(),
  );
  if (existing) {
    return existing;
  }

  try {
    const secret = requireGuestCookieSecret();
    const id = createTrackingLimiterId();
    const value = encodeTrackingLimiterCookie(id, secret);
    if (!value) {
      return null;
    }
    store.set({
      name: TRACKING_LIMITER_COOKIE_NAME,
      value,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: guestCartCookieSecure(),
      maxAge: TRACKING_LIMITER_COOKIE_MAX_AGE_SECONDS,
    });
    return id;
  } catch {
    return null;
  }
}
