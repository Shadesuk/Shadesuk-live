import "server-only";

import type { EmailDeliveryStatus, EmailEventRow } from "./schema";

export type EmailEventInsert = {
  order_id: string | null;
  shipment_id: string | null;
  recipient_email: string;
  email_type: string;
  provider: string;
  idempotency_key: string;
  status: "pending";
  attempts: 0;
};

export type EmailEventPendingPatch = {
  status: "sent" | "failed";
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  attempts: number;
};

export type EmailEventDeliveryPatch = {
  delivery_status: EmailDeliveryStatus;
  delivery_updated_at: string;
};

export type EmailWebhookReceipt = {
  providerEventId: string;
  eventType: string;
  providerMessageId: string | null;
};

export type EmailEventStore = {
  insertPending(
    row: EmailEventInsert,
  ): Promise<{ status: "inserted"; event: EmailEventRow } | { status: "conflict" } | { status: "error"; error: string }>;
  findByIdempotencyKey(key: string): Promise<EmailEventRow | null>;
  findById(id: string): Promise<EmailEventRow | null>;
  findByProviderMessageId(
    provider: string,
    providerMessageId: string,
  ): Promise<{ status: "ok"; event: EmailEventRow | null } | { status: "error"; error: string }>;
  updateIfPending(id: string, patch: EmailEventPendingPatch): Promise<EmailEventRow | null>;
  updateDeliveryIfCurrent(
    id: string,
    expected: EmailDeliveryStatus,
    patch: EmailEventDeliveryPatch,
  ): Promise<EmailEventRow | null>;
  claimWebhookReceipt(
    receipt: EmailWebhookReceipt,
  ): Promise<{ status: "claimed" } | { status: "duplicate" } | { status: "error"; error: string }>;
};
