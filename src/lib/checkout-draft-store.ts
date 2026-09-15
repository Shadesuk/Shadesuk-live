import "server-only";

import { cookies } from "next/headers";
import {
  CHECKOUT_DRAFT_COOKIE,
  CHECKOUT_DRAFT_TTL_SECONDS,
  decodeCheckoutDraftCookie,
  encodeCheckoutDraftCookie,
} from "@/lib/checkout-draft";
import { guestCartCookieSecure } from "@/lib/guest-cart-cookie-secure";
import { requireGuestCookieSecret } from "@/lib/guest-cookie-hmac";
import { emptyCheckoutDraft, type PublicCheckoutDraft } from "@/types/checkout";

export async function readCheckoutDraft(sessionId: string | null): Promise<PublicCheckoutDraft> {
  if (!sessionId) {
    return emptyCheckoutDraft();
  }
  const store = await cookies();
  return decodeCheckoutDraftCookie(sessionId, store.get(CHECKOUT_DRAFT_COOKIE)?.value);
}

export async function writeCheckoutDraft(
  sessionId: string,
  draft: PublicCheckoutDraft,
): Promise<void> {
  const secret = requireGuestCookieSecret();
  const value = encodeCheckoutDraftCookie(sessionId, draft, Date.now(), secret);
  if (!value) {
    return;
  }
  const store = await cookies();
  store.set({
    name: CHECKOUT_DRAFT_COOKIE,
    value,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: guestCartCookieSecure(),
    maxAge: CHECKOUT_DRAFT_TTL_SECONDS,
  });
}
