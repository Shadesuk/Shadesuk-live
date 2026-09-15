import "server-only";

import { cookies } from "next/headers";
import {
  CHECKOUT_DRAFT_COOKIE,
  CHECKOUT_DRAFT_TTL_SECONDS,
  decodeCheckoutDraftCookie,
  encodeCheckoutDraftCookie,
} from "@/lib/checkout-draft";
import { guestCartCookieSecure } from "@/lib/guest-cart-cookie-secure";
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
  const store = await cookies();
  store.set({
    name: CHECKOUT_DRAFT_COOKIE,
    value: encodeCheckoutDraftCookie(sessionId, draft),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: guestCartCookieSecure(),
    maxAge: CHECKOUT_DRAFT_TTL_SECONDS,
  });
}
