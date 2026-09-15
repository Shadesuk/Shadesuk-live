"use server";

import { headers } from "next/headers";
import { NETWORK_ERROR } from "@/lib/account-copy";
import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import { clientAddressFromHeaders } from "@/lib/request-address";
import { bindTrackingLimiterId } from "@/lib/tracking-limiter-cookie";
import { lookupGuestOrder } from "@/services/guest-tracking";
import type { GuestTrackingActionResult } from "@/types/tracking";

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
