"use server";

import { headers } from "next/headers";
import { NETWORK_ERROR } from "@/lib/account-copy";
import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import { clientAddressFromHeaders } from "@/lib/request-address";
import { clearGuestTrackingGrant } from "@/lib/tracking-grant-cookie";
import { bindTrackingLimiterId } from "@/lib/tracking-limiter-cookie";
import { lookupGuestOrder } from "@/services/guest-tracking";
import { cancelGuestOrder } from "@/services/order-cancellation";
import type { GuestTrackingActionResult } from "@/types/tracking";
import type { CancelOrderActionResult } from "@/app/(storefront)/account/orders/actions";

export async function trackGuestOrderAction(input: {
  orderReference: string;
  email: string;
}): Promise<GuestTrackingActionResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error", message: NETWORK_ERROR };
  }
  if (typeof input.orderReference !== "string" || typeof input.email !== "string") {
    return { status: "error", message: NETWORK_ERROR };
  }

  const requestHeaders = await headers();
  const ip = clientAddressFromHeaders(requestHeaders);
  const limiterId = await bindTrackingLimiterId();

  return lookupGuestOrder({
    orderReference: input.orderReference,
    email: input.email,
    ip,
    limiterId,
  });
}

export async function cancelGuestOrderAction(formData: FormData): Promise<CancelOrderActionResult> {
  if (!(await cartActionOriginAllowed())) {
    return { status: "error" };
  }
  const orderReference = formData.get("orderReference");
  const reason = formData.get("reason");
  if (typeof orderReference !== "string" || (reason != null && typeof reason !== "string")) {
    return { status: "error" };
  }
  if (hasForbiddenOwnershipKey({ orderReference, reason })) {
    return { status: "error" };
  }
  const result = await cancelGuestOrder({ orderReference, reason });
  return { status: result.status, reason: result.reason };
}

export async function clearGuestTrackingGrantAction(): Promise<void> {
  if (!(await cartActionOriginAllowed())) {
    return;
  }
  await clearGuestTrackingGrant();
}
