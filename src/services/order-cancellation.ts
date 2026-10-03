import "server-only";

import {
  isCustomerCancellationAttemptAllowed,
  sanitizeCancellationReason,
} from "@/contracts/order/cancellation";
import { parseOrderReferenceInput } from "@/contracts/order/reference";
import { getOptionalAccountUser } from "@/lib/account-session";
import { createSupabaseAdminClient, hasSupabaseSecretKey } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readGuestTrackingGrant } from "@/lib/tracking-grant-cookie";
import { isUuid } from "@/lib/ids";

export type CancellationActor = "customer" | "guest";

export type OrderCancellationResult = {
  status: "cancelled" | "already_cancelled" | "ineligible" | "not_found" | "error";
  reason?: string;
};

type RpcPayload = {
  status?: string;
  reason?: string;
};

export async function cancelAccountOrder(input: {
  orderReference: string;
  reason: unknown;
}): Promise<OrderCancellationResult> {
  const user = await getOptionalAccountUser();
  if (!user) {
    return { status: "not_found" };
  }
  const reference = parseOrderReferenceInput(input.orderReference);
  if (!reference || !cancellationWritesAvailable()) {
    return { status: "error" };
  }

  const admin = createSupabaseAdminClient();
  const loaded = await admin
    .from("orders")
    .select("id, user_id, payment_status, status")
    .eq("order_reference", reference)
    .maybeSingle();
  const row = loaded.data;
  if (loaded.error || !row || typeof row.id !== "string") {
    return loaded.error ? { status: "error" } : { status: "not_found" };
  }
  if (
    row.user_id !== user.id ||
    row.status === "checkout" ||
    !isCustomerCancellationAttemptAllowed(row.payment_status)
  ) {
    return { status: "not_found" };
  }

  return commitCancellation({
    orderId: row.id,
    actorUserId: user.id,
    actorKind: "customer",
    reason: sanitizeCancellationReason(input.reason),
  });
}

export async function cancelGuestOrder(input: {
  orderReference: string;
  reason: unknown;
}): Promise<OrderCancellationResult> {
  const reference = parseOrderReferenceInput(input.orderReference);
  if (!reference) {
    return { status: "not_found" };
  }
  const grant = await readGuestTrackingGrant();
  if (grant.status !== "valid" || grant.orderReference !== reference) {
    return { status: "not_found" };
  }
  if (!cancellationWritesAvailable()) {
    return { status: "error" };
  }

  const admin = createSupabaseAdminClient();
  const loaded = await admin
    .from("orders")
    .select("id, order_reference, payment_status, status")
    .eq("order_reference", reference)
    .maybeSingle();
  const row = loaded.data;
  if (
    loaded.error ||
    !row ||
    typeof row.id !== "string" ||
    row.order_reference !== reference ||
    row.status === "checkout" ||
    !isCustomerCancellationAttemptAllowed(row.payment_status)
  ) {
    return loaded.error ? { status: "error" } : { status: "not_found" };
  }

  return commitCancellation({
    orderId: row.id,
    actorUserId: null,
    actorKind: "guest",
    reason: sanitizeCancellationReason(input.reason),
  });
}

async function commitCancellation(input: {
  orderId: string;
  actorUserId: string | null;
  actorKind: CancellationActor;
  reason: string | null;
}): Promise<OrderCancellationResult> {
  if (!isUuid(input.orderId)) {
    return { status: "not_found" };
  }
  const admin = createSupabaseAdminClient();
  const rpc = await admin.rpc("cancel_order_if_eligible", {
    p_order_id: input.orderId,
    p_actor_user_id: input.actorUserId,
    p_actor_kind: input.actorKind,
    p_reason: input.reason,
  });
  if (rpc.error || !rpc.data || typeof rpc.data !== "object") {
    return { status: "error" };
  }
  const payload = rpc.data as RpcPayload;
  if (payload.status === "already_cancelled") {
    return { status: "already_cancelled" };
  }
  if (payload.status === "ineligible") {
    return { status: "ineligible", reason: payload.reason };
  }
  if (payload.status === "not_found") {
    return { status: "not_found" };
  }
  if (payload.status !== "cancelled") {
    return { status: "error" };
  }

  return { status: "cancelled" };
}

function cancellationWritesAvailable(): boolean {
  return isSupabaseConfigured() && hasSupabaseSecretKey();
}
