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
 * Never return the session id to the caller — it must not appear in RSC props
 * or Server Action JSON.
 */
export async function ensureGuestCartSessionCookie(): Promise<void> {
  if (!CART_MEDIATION_RULES.clientMustNotSendSessionId) {
    throw new Error("Guest cart mediation must not accept client session ids.");
  }

  const store = await cookies();
  const existing = store.get(GUEST_CART_COOKIE_NAME)?.value;
  if (isGuestCartSessionId(existing)) {
    return;
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
}
