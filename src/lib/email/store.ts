import "server-only";

import type { EmailEventRow } from "./schema";

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

export type EmailEventStore = {
  insertPending(
    row: EmailEventInsert,
  ): Promise<{ status: "inserted"; event: EmailEventRow } | { status: "conflict" } | { status: "error"; error: string }>;
  findByIdempotencyKey(key: string): Promise<EmailEventRow | null>;
  findById(id: string): Promise<EmailEventRow | null>;
  updateIfPending(id: string, patch: EmailEventPendingPatch): Promise<EmailEventRow | null>;
};
