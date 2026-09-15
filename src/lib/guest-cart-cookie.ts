import "server-only";

import { cookies } from "next/headers";
import {
  CART_MEDIATION_RULES,
  createGuestCartSessionId,
  GUEST_CART_COOKIE_NAME,
  guestCartCookieSetOptions,
  isGuestCartSessionId,
} from "@/contracts";
import { guestCartCookieSecure } from "@/lib/guest-cart-cookie-secure";

/**
 * Bind the request to a guest cart session using the httpOnly cookie only.
 * Never return the session id in RSC props or Server Action JSON.
 */
export async function readGuestCartSessionId(): Promise<string | null> {
  const store = await cookies();
  const existing = store.get(GUEST_CART_COOKIE_NAME)?.value;
  return isGuestCartSessionId(existing) ? existing : null;
}

export async function ensureGuestCartSessionCookie(): Promise<void> {
  await bindGuestCartSession();
}

/**
 * Server-only. The returned session id is for mediation against PR #10
 * `carts.session_id` / the demo lines cookie. Do not serialize it.
 */
export async function bindGuestCartSession(): Promise<string> {
  if (!CART_MEDIATION_RULES.clientMustNotSendSessionId) {
    throw new Error("Guest cart mediation must not accept client session ids.");
  }

  const store = await cookies();
  const existing = store.get(GUEST_CART_COOKIE_NAME)?.value;
  if (isGuestCartSessionId(existing)) {
    return existing;
  }

  const sessionId = createGuestCartSessionId();
  const options = guestCartCookieSetOptions(sessionId, {
    secure: guestCartCookieSecure(),
  });

  store.set({
    name: options.name,
    value: options.value,
    httpOnly: options.httpOnly,
    path: options.path,
    sameSite: options.sameSite,
    secure: options.secure,
    maxAge: options.maxAge,
  });
  return sessionId;
}
