import "server-only";

import { isStaffAdmin } from "@/contracts/admin/roles";
import { getAdminGate } from "@/lib/admin-session";
import { isUuid } from "@/lib/ids";
import { createSupabaseAdminClient, hasSupabaseSecretKey } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type MarkOrderRefundedResult =
  | { status: "refunded" }
  | { status: "already_refunded" }
  | { status: "unauthorized" }
  | { status: "ineligible"; reason: "not_cancelled" | "not_pending" }
  | { status: "not_found" }
  | { status: "error" };

type RpcPayload = {
  status?: string;
  reason?: string;
};

/**
 * Records an admin confirmation that the PayPal refund was already completed
 * outside this app. Does not call PayPal. Customers cannot reach this path.
 */
export async function markOrderRefunded(orderId: string): Promise<MarkOrderRefundedResult> {
  const gate = await getAdminGate();
  if (gate.status !== "ok" || !isStaffAdmin(gate.actor.role)) {
    return { status: "unauthorized" };
  }
  if (!isUuid(orderId)) {
    return { status: "not_found" };
  }
  if (!isSupabaseConfigured() || !hasSupabaseSecretKey()) {
    return { status: "error" };
  }

  const admin = createSupabaseAdminClient();
  const rpc = await admin.rpc("mark_order_refunded", {
    p_order_id: orderId,
    p_actor_user_id: gate.actor.id,
  });
  if (rpc.error || !rpc.data || typeof rpc.data !== "object") {
    return { status: "error" };
  }
  const payload = rpc.data as RpcPayload;
  if (payload.status === "refunded") {
    return { status: "refunded" };
  }
  if (payload.status === "already_refunded") {
    return { status: "already_refunded" };
  }
  if (payload.status === "unauthorized") {
    return { status: "unauthorized" };
  }
  if (payload.status === "not_found") {
    return { status: "not_found" };
  }
  if (payload.status === "ineligible") {
    if (payload.reason === "not_cancelled" || payload.reason === "not_pending") {
      return { status: "ineligible", reason: payload.reason };
    }
    return { status: "ineligible", reason: "not_pending" };
  }
  return { status: "error" };
}
