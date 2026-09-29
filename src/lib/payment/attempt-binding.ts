import { isUuid } from "@/lib/ids";

/**
 * Cancel and decline may close only the open attempt named by this browser's
 * httpOnly checkout-attempt cookie. A client-supplied UUID is not enough.
 */
export function paymentAttemptBoundToCookie(
  requestedPaymentId: string,
  cookiePaymentId: string | null,
): boolean {
  return (
    isUuid(requestedPaymentId) &&
    typeof cookiePaymentId === "string" &&
    isUuid(cookiePaymentId) &&
    requestedPaymentId === cookiePaymentId
  );
}

/**
 * An open attempt can be reused only by the shopper who owns it.
 * A signed-in shopper must match `orders.user_id`.
 * A guest (no account user) may reuse only a guest attempt (`user_id` null)
 * and must not reuse another user's attempt.
 * A mismatch must not close the other attempt.
 */
export function checkoutAttemptOwnerMatches(
  orderUserId: string | null,
  currentUserId: string | null,
): boolean {
  if (currentUserId === null) {
    return orderUserId === null;
  }
  if (!isUuid(currentUserId)) {
    return false;
  }
  return orderUserId === currentUserId;
}
