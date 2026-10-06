import "server-only";

import { getAdminGate } from "@/lib/admin-session";
import { isUuid } from "@/lib/ids";
import { adminOrderPath } from "@/lib/navigation";
import { INDIA_CAPTURE_UNRECORDED } from "@/lib/razorpay/capture-claim";
import { createSupabaseAdminClient, hasSupabaseSecretKey } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type IndiaCaptureAlert = {
  id: string;
  orderId: string;
  orderReference: string;
  providerPaymentId: string;
  amountMinor: number;
  href: string;
};

export type IndiaCaptureAlertLoadResult =
  | { status: "ok"; alerts: IndiaCaptureAlert[] }
  | { status: "error" };

/**
 * Lists India payments Razorpay has captured that this shop did not record as orders.
 * Admins reconcile those payments in the Razorpay dashboard. This loader does not refund.
 */
export async function loadIndiaCaptureAlerts(): Promise<IndiaCaptureAlertLoadResult> {
  const gate = await getAdminGate();
  if (gate.status !== "ok" || !isSupabaseConfigured() || !hasSupabaseSecretKey()) {
    return { status: "error" };
  }
  try {
    const admin = createSupabaseAdminClient();
    const result = await admin
      .from("order_events")
      .select("id, order_id, metadata, orders(order_reference)")
      .eq("event_type", INDIA_CAPTURE_UNRECORDED)
      .order("created_at", { ascending: true })
      .limit(50);
    if (result.error || !Array.isArray(result.data)) {
      return { status: "error" };
    }
    const alerts: IndiaCaptureAlert[] = [];
    for (const row of result.data) {
      const alert = parseAlert(row);
      if (alert) {
        alerts.push(alert);
      }
    }
    return { status: "ok", alerts };
  } catch {
    return { status: "error" };
  }
}

function parseAlert(value: unknown): IndiaCaptureAlert | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  const metadata = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
  const id = typeof row.id === "string" ? row.id : "";
  const orderId = typeof row.order_id === "string" ? row.order_id : "";
  const providerPaymentId = typeof metadata.provider_payment_id === "string" ? metadata.provider_payment_id : "";
  const amountMinor = metadata.amount_minor;
  if (!isUuid(id) || !isUuid(orderId) || !providerPaymentId || metadata.currency !== "INR" || !Number.isInteger(amountMinor)) {
    return null;
  }
  const orderReference = readOrderReference(row.orders);
  if (!orderReference) {
    return null;
  }
  return {
    id,
    orderId,
    orderReference,
    providerPaymentId,
    amountMinor: amountMinor as number,
    href: adminOrderPath(orderId),
  };
}

function readOrderReference(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") {
    return null;
  }
  const reference = (row as Record<string, unknown>).order_reference;
  return typeof reference === "string" && reference.trim() ? reference : null;
}
