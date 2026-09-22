"use server";

import { revalidatePath } from "next/cache";
import {
  ADMIN_FORBIDDEN,
  ADMIN_ORDER_SAVE_FAILED_BODY,
} from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { adminOrderPath, routes } from "@/lib/navigation";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import {
  dispatchAdminOrder,
  saveAdminFulfilment,
  updateAdminOrderStatus,
  type AdminOrderMutationResult,
} from "@/services/admin-orders";

export type AdminOrderActionState = {
  status: "idle" | "ok" | "invalid" | "error" | "forbidden";
  message?: string;
  errors?: Record<string, string>;
  values?: {
    carrierName: string;
    trackingNumber: string;
    trackingUrl: string;
    status: string;
  };
};

export async function updateAdminOrderStatusAction(
  _prev: AdminOrderActionState,
  formData: FormData,
): Promise<AdminOrderActionState> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(Object.fromEntries(formData))) {
    return { status: "error", message: ADMIN_ORDER_SAVE_FAILED_BODY };
  }
  const gate = await getAdminGate();
  if (gate.status === "unauthenticated" || gate.status === "forbidden") {
    return { status: "forbidden", message: ADMIN_FORBIDDEN };
  }
  const orderId = String(formData.get("orderId") ?? "");
  const result = await updateAdminOrderStatus({
    orderId,
    nextStatus: formData.get("status"),
    actorId: gate.actor.id,
  });
  return finishMutation(result, orderId);
}

export async function saveAdminFulfilmentAction(
  _prev: AdminOrderActionState,
  formData: FormData,
): Promise<AdminOrderActionState> {
  const values = {
    carrierName: String(formData.get("carrierName") ?? ""),
    trackingNumber: String(formData.get("trackingNumber") ?? ""),
    trackingUrl: String(formData.get("trackingUrl") ?? ""),
    status: String(formData.get("status") ?? ""),
  };
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(Object.fromEntries(formData))) {
    return { status: "error", message: ADMIN_ORDER_SAVE_FAILED_BODY, values };
  }
  const gate = await getAdminGate();
  if (gate.status === "unauthenticated" || gate.status === "forbidden") {
    return { status: "forbidden", message: ADMIN_FORBIDDEN, values };
  }
  const orderId = String(formData.get("orderId") ?? "");
  const intent = String(formData.get("intent") ?? "save");
  const result =
    intent === "dispatch"
      ? await dispatchAdminOrder({
          orderId,
          actorId: gate.actor.id,
          carrierName: values.carrierName,
          trackingNumber: values.trackingNumber,
          trackingUrl: values.trackingUrl,
        })
      : await saveAdminFulfilment({
          orderId,
          actorId: gate.actor.id,
          carrierName: values.carrierName,
          trackingNumber: values.trackingNumber,
          trackingUrl: values.trackingUrl,
          status: values.status,
        });
  return finishMutation(result, orderId, values);
}

function finishMutation(
  result: AdminOrderMutationResult,
  orderId: string,
  values?: AdminOrderActionState["values"],
): AdminOrderActionState {
  if (result.status === "ok") {
    revalidatePath(routes.adminOrders);
    revalidatePath(adminOrderPath(orderId));
    revalidatePath(routes.admin);
    revalidatePath(routes.accountOrders, "layout");
    return { status: "ok" };
  }
  if (result.status === "invalid") {
    return { status: "invalid", errors: result.errors, values };
  }
  if (result.status === "forbidden") {
    return { status: "forbidden", message: ADMIN_FORBIDDEN, values };
  }
  if (result.status === "not_found") {
    return { status: "error", message: ADMIN_ORDER_SAVE_FAILED_BODY, values };
  }
  return { status: "error", message: ADMIN_ORDER_SAVE_FAILED_BODY, values };
}
