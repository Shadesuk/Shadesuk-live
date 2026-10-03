import "server-only";

import {
  toPendingRefundAlert,
  type PendingRefundAlert,
} from "@/contracts/order/cancellation";
import { readRefundStatus } from "@/contracts/order/cancellation";
import { adminOrderPath } from "@/lib/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 200;
const COLUMNS =
  "id, order_reference, cancelled_at, refund_status, refund_amount_minor, total_minor";

export type PendingRefundLoadResult =
  | { status: "ok"; alerts: PendingRefundAlert[] }
  | { status: "error" };

export async function loadPendingRefundAlerts(now = new Date()): Promise<PendingRefundLoadResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const alerts: PendingRefundAlert[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select(COLUMNS)
        .eq("refund_status", "refund_pending")
        .order("cancelled_at", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        return { status: "error" };
      }
      const chunk = Array.isArray(data) ? data : [];
      for (const row of chunk) {
        const alert = parsePendingRefund(row, now);
        if (alert) {
          alerts.push(alert);
        }
      }
      if (chunk.length < PAGE_SIZE) {
        break;
      }
      from += PAGE_SIZE;
    }
    return { status: "ok", alerts };
  } catch {
    return { status: "error" };
  }
}

function parsePendingRefund(value: unknown, now: Date): PendingRefundAlert | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (readRefundStatus(row.refund_status) !== "refund_pending") {
    return null;
  }
  if (typeof row.id !== "string" || typeof row.order_reference !== "string" || typeof row.cancelled_at !== "string") {
    return null;
  }
  const amount = Number.isInteger(row.refund_amount_minor)
    ? (row.refund_amount_minor as number)
    : Number.isInteger(row.total_minor)
      ? (row.total_minor as number)
      : null;
  if (amount == null) {
    return null;
  }
  return toPendingRefundAlert({
    id: row.id,
    orderReference: row.order_reference,
    amountMinor: amount,
    cancelledAt: row.cancelled_at,
    now,
    href: adminOrderPath(row.id),
  });
}
