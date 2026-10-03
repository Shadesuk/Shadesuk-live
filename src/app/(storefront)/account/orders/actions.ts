"use server";

import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import { cancelAccountOrder } from "@/services/order-cancellation";

export type CancelOrderActionResult = {
  status: "cancelled" | "already_cancelled" | "ineligible" | "not_found" | "error";
  reason?: string;
};

export async function cancelAccountOrderAction(formData: FormData): Promise<CancelOrderActionResult> {
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
  const result = await cancelAccountOrder({ orderReference, reason });
  return { status: result.status, reason: result.reason };
}
