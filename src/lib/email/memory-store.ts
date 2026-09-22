import "server-only";

import type { EmailEventRow } from "./schema";
import type {
  EmailEventDeliveryPatch,
  EmailEventInsert,
  EmailEventPendingPatch,
  EmailEventStore,
  EmailWebhookReceipt,
} from "./store";

/**
 * In-process unique-key store for repository verification only.
 * It serializes writes so concurrent createOrGet/webhook claims cannot
 * duplicate idempotency keys or svix-ids.
 */
export function createMemoryEmailEventStore(nowIso = () => new Date().toISOString()): EmailEventStore {
  const rows = new Map<string, EmailEventRow>();
  const receipts = new Set<string>();
  let writeChain = Promise.resolve();

  function exclusive<T>(fn: () => T): Promise<T> {
    const run = writeChain.then(fn, fn);
    writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return {
    insertPending(row: EmailEventInsert) {
      return exclusive(() => {
        for (const existing of rows.values()) {
          if (existing.idempotency_key === row.idempotency_key) {
            return { status: "conflict" as const };
          }
        }
        const event: EmailEventRow = {
          id: crypto.randomUUID(),
          order_id: row.order_id,
          shipment_id: row.shipment_id,
          recipient_email: row.recipient_email,
          email_type: row.email_type,
          provider: row.provider,
          provider_message_id: null,
          idempotency_key: row.idempotency_key,
          status: "pending",
          delivery_status: "unknown",
          delivery_updated_at: null,
          error_message: null,
          attempts: 0,
          sent_at: null,
          created_at: nowIso(),
        };
        rows.set(event.id, event);
        return { status: "inserted" as const, event: { ...event } };
      });
    },

    async findByIdempotencyKey(key: string) {
      for (const event of rows.values()) {
        if (event.idempotency_key === key) {
          return { ...event };
        }
      }
      return null;
    },

    async findById(id: string) {
      const event = rows.get(id);
      return event ? { ...event } : null;
    },

    async findByProviderMessageId(provider: string, providerMessageId: string) {
      for (const event of rows.values()) {
        if (event.provider === provider && event.provider_message_id === providerMessageId) {
          return { status: "ok" as const, event: { ...event } };
        }
      }
      return { status: "ok" as const, event: null };
    },

    updateIfPending(id: string, patch: EmailEventPendingPatch) {
      return exclusive(() => {
        const event = rows.get(id);
        if (!event || event.status !== "pending") {
          return null;
        }
        const next: EmailEventRow = { ...event, ...patch };
        rows.set(id, next);
        return { ...next };
      });
    },

    updateDeliveryIfCurrent(id: string, expected: EmailEventRow["delivery_status"], patch: EmailEventDeliveryPatch) {
      return exclusive(() => {
        const event = rows.get(id);
        if (!event || event.delivery_status !== expected) {
          return null;
        }
        const next: EmailEventRow = { ...event, ...patch };
        rows.set(id, next);
        return { ...next };
      });
    },

    claimWebhookReceipt(receipt: EmailWebhookReceipt) {
      return exclusive(() => {
        if (receipts.has(receipt.providerEventId)) {
          return { status: "duplicate" as const };
        }
        receipts.add(receipt.providerEventId);
        return { status: "claimed" as const };
      });
    },
  };
}
