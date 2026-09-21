import "server-only";

import { EMAIL_PROVIDER_RESEND } from "./schema";
import { decideDeliveryTransition, deliveryStatusForResendType } from "./delivery";
import type { EmailEventStore } from "./store";
import { createSupabaseEmailEventStore } from "./supabase-store";

export type ResendWebhookProcessInput = {
  type: string;
  createdAt: string;
  emailId: string | null;
  providerEventId: string;
};

export type ResendWebhookProcessResult =
  | { httpStatus: 200; outcome: "updated" | "unchanged" | "duplicate" | "ignored" }
  | { httpStatus: 404; outcome: "unmatched" }
  | { httpStatus: 503; outcome: "error"; error: string };

/**
 * Applies a verified Resend event to email_events only.
 * Never reads or writes orders, payments, or shipments.
 */
export async function processVerifiedResendWebhook(
  input: ResendWebhookProcessInput,
  store?: EmailEventStore,
): Promise<ResendWebhookProcessResult> {
  const db = store ?? createSupabaseEmailEventStore();
  const deliveryStatus = deliveryStatusForResendType(input.type);
  if (!deliveryStatus) {
    return { httpStatus: 200, outcome: "ignored" };
  }

  const emailId = input.emailId?.trim() ?? "";
  const providerEventId = input.providerEventId.trim();
  if (!emailId || !providerEventId) {
    return { httpStatus: 404, outcome: "unmatched" };
  }

  const found = await db.findByProviderMessageId(EMAIL_PROVIDER_RESEND, emailId);
  if (found.status === "error") {
    return { httpStatus: 503, outcome: "error", error: found.error };
  }
  if (!found.event) {
    return { httpStatus: 404, outcome: "unmatched" };
  }

  const claimed = await db.claimWebhookReceipt({
    providerEventId,
    eventType: input.type,
    providerMessageId: emailId,
  });
  if (claimed.status === "error") {
    return { httpStatus: 503, outcome: "error", error: claimed.error };
  }
  if (claimed.status === "duplicate") {
    return { httpStatus: 200, outcome: "duplicate" };
  }

  const decision = decideDeliveryTransition({
    currentStatus: found.event.delivery_status,
    currentAt: found.event.delivery_updated_at,
    incomingStatus: deliveryStatus,
    incomingAt: input.createdAt,
  });
  if (decision === "ignore") {
    return { httpStatus: 200, outcome: "unchanged" };
  }

  const updated = await db.updateDeliveryIfCurrent(found.event.id, found.event.delivery_status, {
    delivery_status: deliveryStatus,
    delivery_updated_at: input.createdAt,
  });
  if (!updated) {
    return { httpStatus: 200, outcome: "unchanged" };
  }
  return { httpStatus: 200, outcome: "updated" };
}

export function webhookEmailIdFromEvent(event: unknown): string | null {
  if (!event || typeof event !== "object") {
    return null;
  }
  const data = "data" in event ? event.data : null;
  if (!data || typeof data !== "object") {
    return null;
  }
  const emailId = "email_id" in data ? data.email_id : null;
  return typeof emailId === "string" && emailId.trim() ? emailId.trim() : null;
}
