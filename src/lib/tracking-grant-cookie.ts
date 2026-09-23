import "server-only";

import { cookies } from "next/headers";
import { guestCartCookieSecure } from "@/lib/guest-cart-cookie-secure";
import { resolveGuestCookieSecret } from "@/lib/guest-cookie-hmac";
import { decodeTrackingLimiterCookie, TRACKING_LIMITER_COOKIE_NAME } from "@/lib/tracking-limiter";
import {
  decodeTrackingGrant,
  encodeTrackingGrant,
  TRACKING_GRANT_COOKIE_NAME,
  TRACKING_GRANT_TTL_SECONDS,
  type TrackingGrantResult,
} from "@/lib/tracking-grant";

/**
 * HttpOnly proof of a successful guest verification. Never returned in
 * action JSON and never readable by client script.
 */
export async function rememberGuestTrackingGrant(input: {
  orderReference: string;
  limiterId: string | null;
}): Promise<void> {
  if (!input.limiterId) {
    return;
  }
  const secret = resolveGuestCookieSecret();
  const value = encodeTrackingGrant({
    orderReference: input.orderReference,
    limiterId: input.limiterId,
    secret,
  });
  if (!value) {
    return;
  }
  const store = await cookies();
  store.set({
    name: TRACKING_GRANT_COOKIE_NAME,
    value,
    httpOnly: true,
    path: "/track-order",
    sameSite: "lax",
    secure: guestCartCookieSecure(),
    maxAge: TRACKING_GRANT_TTL_SECONDS,
  });
}

export async function clearGuestTrackingGrant(): Promise<void> {
  const store = await cookies();
  store.set({
    name: TRACKING_GRANT_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/track-order",
    sameSite: "lax",
    secure: guestCartCookieSecure(),
    maxAge: 0,
  });
}

export async function readGuestTrackingGrant(now?: number): Promise<TrackingGrantResult | { status: "absent" }> {
  const store = await cookies();
  const raw = store.get(TRACKING_GRANT_COOKIE_NAME)?.value;
  if (!raw) {
    return { status: "absent" };
  }
  const secret = resolveGuestCookieSecret();
  const limiterId = decodeTrackingLimiterCookie(
    store.get(TRACKING_LIMITER_COOKIE_NAME)?.value,
    secret,
  );
  return decodeTrackingGrant({
    value: raw,
    limiterId,
    secret,
    now,
  });
}
