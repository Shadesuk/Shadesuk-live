import "server-only";

import { cookies } from "next/headers";
import { GUEST_CART_COOKIE } from "@/contracts";
import {
  DEMO_CART_LINES_COOKIE,
  decodeDemoCartCookie,
  encodeDemoCartCookie,
  type DemoCartLine,
} from "@/lib/demo-cart-cookie";
import { guestCartCookieSecure } from "@/lib/guest-cart-cookie-secure";
import { requireGuestCookieSecret } from "@/lib/guest-cookie-hmac";

export async function readDemoCartLines(sessionId: string): Promise<DemoCartLine[]> {
  const store = await cookies();
  return decodeDemoCartCookie(sessionId, store.get(DEMO_CART_LINES_COOKIE)?.value);
}

export async function writeDemoCartLines(
  sessionId: string,
  items: DemoCartLine[],
): Promise<void> {
  const secret = requireGuestCookieSecret();
  const value = encodeDemoCartCookie(sessionId, items, secret);
  if (!value) {
    return;
  }
  const store = await cookies();
  store.set({
    name: DEMO_CART_LINES_COOKIE,
    value,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: guestCartCookieSecure(),
    maxAge: GUEST_CART_COOKIE.maxAgeSeconds,
  });
}
