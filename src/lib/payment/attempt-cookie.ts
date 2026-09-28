import "server-only";

import { cookies } from "next/headers";
import { isUuid } from "@/lib/ids";
import { guestCartCookieSecure } from "@/lib/guest-cart-cookie-secure";

/** Short-lived pointer at the open PayPal attempt. Not a capture credential. */
export const PAYMENT_ATTEMPT_COOKIE = "shadesuk_payment_attempt";

/** PayPal checkout orders are approvable for about three hours. */
export const PAYMENT_ATTEMPT_MAX_AGE_SECONDS = 60 * 60 * 3;

export async function readPaymentAttemptId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(PAYMENT_ATTEMPT_COOKIE)?.value ?? "";
  return isUuid(value) ? value : null;
}

export async function rememberPaymentAttemptId(paymentId: string): Promise<void> {
  if (!isUuid(paymentId)) {
    return;
  }
  const store = await cookies();
  store.set({
    name: PAYMENT_ATTEMPT_COOKIE,
    value: paymentId,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: guestCartCookieSecure(),
    maxAge: PAYMENT_ATTEMPT_MAX_AGE_SECONDS,
  });
}

export async function clearPaymentAttemptId(): Promise<void> {
  const store = await cookies();
  store.set({
    name: PAYMENT_ATTEMPT_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: guestCartCookieSecure(),
    maxAge: 0,
  });
}
