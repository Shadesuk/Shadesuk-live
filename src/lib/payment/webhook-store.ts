import "server-only";

import type { OrderRow } from "@/contracts/order/schema";
import { PAYMENT_PROVIDER_RAZORPAY, type PaymentRow } from "@/contracts/payment/schema";
import { parseOrderRow } from "@/lib/order-rows";
import { parsePaymentRow } from "@/lib/payment/pending-store";
import { createSupabaseAdminClient, hasSupabaseSecretKey } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isUuid } from "@/lib/ids";

const ORDER_COLUMNS =
  "id, order_reference, user_id, customer_email, customer_first_name, customer_last_name, status, payment_status, currency, subtotal_minor, shipping_minor, total_minor, delivery_address, created_at, updated_at";

const PAYMENT_COLUMNS =
  "id, order_id, provider, provider_order_id, provider_payment_id, amount_minor, currency, status, failure_reason, captured_at, created_at, updated_at";

const WEBHOOK_EVENT_COLUMNS =
  "id, provider, provider_event_id, event_type, payload, processed, processed_at, created_at";

export type PaymentWebhookEventRow = {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  created_at: string;
};

export type WebhookPaymentRecord = {
  payment: PaymentRow;
  order: OrderRow;
};

export type RazorpayWebhookStore = {
  insertUnprocessedEvent: (input: {
    providerEventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }) => Promise<PaymentWebhookEventRow>;
  loadEvent: (providerEventId: string) => Promise<PaymentWebhookEventRow | null>;
  markEventProcessed: (providerEventId: string) => Promise<PaymentWebhookEventRow | null>;
  loadPaymentByProviderOrderId: (providerOrderId: string) => Promise<WebhookPaymentRecord | null>;
  loadPaymentByProviderPaymentId: (
    providerPaymentId: string,
  ) => Promise<WebhookPaymentRecord | null>;
  markPaymentFailed: (input: { paymentId: string; reason: string }) => Promise<PaymentRow | null>;
};

export function createSupabaseRazorpayWebhookStore(): RazorpayWebhookStore {
  return {
    async insertUnprocessedEvent(input) {
      if (!webhookWritesAvailable()) {
        throw new Error("Webhook writes are not configured.");
      }
      const admin = createSupabaseAdminClient();
      const inserted = await admin
        .from("payment_webhook_events")
        .insert({
          provider: PAYMENT_PROVIDER_RAZORPAY,
          provider_event_id: input.providerEventId,
          event_type: input.eventType,
          payload: input.payload,
          processed: false,
          processed_at: null,
        })
        .select(WEBHOOK_EVENT_COLUMNS)
        .maybeSingle();
      const created = parseWebhookEventRow(inserted.data);
      if (created) {
        return created;
      }
      if (inserted.error?.code === "23505") {
        const existing = await this.loadEvent(input.providerEventId);
        if (existing) {
          return existing;
        }
      }
      throw new Error("Could not persist the webhook event.");
    },

    async loadEvent(providerEventId) {
      if (!providerEventId.trim() || !webhookWritesAvailable()) {
        return null;
      }
      const admin = createSupabaseAdminClient();
      const result = await admin
        .from("payment_webhook_events")
        .select(WEBHOOK_EVENT_COLUMNS)
        .eq("provider", PAYMENT_PROVIDER_RAZORPAY)
        .eq("provider_event_id", providerEventId.trim())
        .maybeSingle();
      return parseWebhookEventRow(result.data);
    },

    async markEventProcessed(providerEventId) {
      if (!providerEventId.trim() || !webhookWritesAvailable()) {
        return null;
      }
      const admin = createSupabaseAdminClient();
      const processedAt = new Date().toISOString();
      const updated = await admin
        .from("payment_webhook_events")
        .update({
          processed: true,
          processed_at: processedAt,
        })
        .eq("provider", PAYMENT_PROVIDER_RAZORPAY)
        .eq("provider_event_id", providerEventId.trim())
        .eq("processed", false)
        .select(WEBHOOK_EVENT_COLUMNS)
        .maybeSingle();
      const processed = parseWebhookEventRow(updated.data);
      if (processed) {
        return processed;
      }
      return this.loadEvent(providerEventId);
    },

    async loadPaymentByProviderOrderId(providerOrderId) {
      return loadPaymentByColumn("provider_order_id", providerOrderId);
    },

    async loadPaymentByProviderPaymentId(providerPaymentId) {
      return loadPaymentByColumn("provider_payment_id", providerPaymentId);
    },

    async markPaymentFailed(input) {
      if (!isUuid(input.paymentId) || !webhookWritesAvailable()) {
        return null;
      }
      const admin = createSupabaseAdminClient();
      const updated = await admin
        .from("payments")
        .update({
          status: "failed",
          failure_reason: input.reason.slice(0, 280),
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.paymentId)
        .eq("provider", PAYMENT_PROVIDER_RAZORPAY)
        .in("status", ["created", "authorized"])
        .is("captured_at", null)
        .select(PAYMENT_COLUMNS)
        .maybeSingle();
      return parsePaymentRow(updated.data);
    },
  };
}

function webhookWritesAvailable(): boolean {
  return isSupabaseConfigured() && hasSupabaseSecretKey();
}

async function loadPaymentByColumn(
  column: "provider_order_id" | "provider_payment_id",
  value: string,
): Promise<WebhookPaymentRecord | null> {
  const identifier = value.trim();
  if (!identifier || !webhookWritesAvailable()) {
    return null;
  }
  const admin = createSupabaseAdminClient();
  const paymentResult = await admin
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("provider", PAYMENT_PROVIDER_RAZORPAY)
    .eq(column, identifier)
    .maybeSingle();
  const payment = parsePaymentRow(paymentResult.data);
  if (paymentResult.error || !payment) {
    return null;
  }
  const orderResult = await admin
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", payment.order_id)
    .maybeSingle();
  const order = parseOrderRow(orderResult.data);
  if (orderResult.error || !order || order.id !== payment.order_id) {
    return null;
  }
  return { payment, order };
}

function parseWebhookEventRow(value: unknown): PaymentWebhookEventRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = asString(row.id);
  const provider = asString(row.provider);
  const providerEventId = asString(row.provider_event_id);
  const eventType = asString(row.event_type);
  const createdAt = asString(row.created_at);
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : null;
  if (!id || !provider || !providerEventId || !eventType || !createdAt || !payload) {
    return null;
  }
  return {
    id,
    provider,
    provider_event_id: providerEventId,
    event_type: eventType,
    payload,
    processed: row.processed === true,
    processed_at: typeof row.processed_at === "string" ? row.processed_at : null,
    created_at: createdAt,
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
