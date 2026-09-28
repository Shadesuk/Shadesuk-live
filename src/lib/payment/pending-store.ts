import "server-only";

import { parseOrderItemRow, parseOrderRow } from "@/lib/order-rows";
import type { OrderItemRow, OrderRow } from "@/contracts/order/schema";
import { PAYMENT_PROVIDER_PAYPAL, type PaymentRow } from "@/contracts/payment/schema";
import { isSchemaPaymentStatus } from "@/contracts/payment/schema";
import { STORE_CURRENCY } from "@/contracts/money";
import { createSupabaseAdminClient, hasSupabaseSecretKey } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  PendingOrderInsert,
  PendingOrderItemInsert,
  PendingPaymentInsert,
} from "./pending-attempt";

const ORDER_COLUMNS =
  "id, order_reference, user_id, customer_email, customer_first_name, customer_last_name, status, payment_status, currency, subtotal_minor, shipping_minor, total_minor, delivery_address, created_at, updated_at";

const ORDER_ITEM_COLUMNS =
  "id, order_id, product_id, product_variant_id, sku, product_name, colour_name, variant_name, quantity, unit_price_minor, line_total_minor, product_snapshot, created_at";

const PAYMENT_COLUMNS =
  "id, order_id, provider, provider_order_id, provider_payment_id, amount_minor, currency, status, failure_reason, captured_at, created_at, updated_at";

export type PersistedPendingPayment = {
  order: OrderRow;
  items: OrderItemRow[];
  payment: PaymentRow;
};

export type PendingPaymentStore = {
  insertAttempt: (input: {
    order: PendingOrderInsert;
    items: PendingOrderItemInsert[];
    payment: PendingPaymentInsert;
  }) => Promise<PersistedPendingPayment>;
  attachProviderOrderId: (paymentId: string, providerOrderId: string) => Promise<PaymentRow>;
  markInitiationFailed: (paymentId: string, reason: string) => Promise<void>;
  loadOpenAttempt: (paymentId: string) => Promise<PersistedPendingPayment | null>;
  closeOpenAttempt: (
    paymentId: string,
    status: "cancelled" | "failed",
    reason: string,
  ) => Promise<void>;
};

export function pendingPaymentWritesAvailable(): boolean {
  return isSupabaseConfigured() && hasSupabaseSecretKey();
}

export function createSupabasePendingPaymentStore(): PendingPaymentStore {
  return {
    async insertAttempt(input) {
      if (!pendingPaymentWritesAvailable()) {
        throw new Error("Pending payment writes are not configured.");
      }
      const admin = createSupabaseAdminClient();
      const now = new Date().toISOString();

      const orderResult = await admin
        .from("orders")
        .insert({
          ...input.order,
          created_at: now,
          updated_at: now,
        })
        .select(ORDER_COLUMNS)
        .single();
      const order = parseOrderRow(orderResult.data);
      if (orderResult.error || !order) {
        throw new Error("Could not create the pending order.");
      }
      if (order.payment_status !== "created" || order.status !== "checkout") {
        throw new Error("Pending order was not created as an unpaid checkout attempt.");
      }

      const itemResult = await admin
        .from("order_items")
        .insert(
          input.items.map((item) => ({
            ...item,
            order_id: order.id,
          })),
        )
        .select(ORDER_ITEM_COLUMNS);
      if (itemResult.error || !Array.isArray(itemResult.data)) {
        throw new Error("Could not create pending order items.");
      }
      const items = itemResult.data
        .map(parseOrderItemRow)
        .filter((row): row is OrderItemRow => row !== null && row.order_id === order.id);
      if (items.length !== input.items.length) {
        throw new Error("Could not create pending order items.");
      }

      const paymentResult = await admin
        .from("payments")
        .insert({
          order_id: order.id,
          provider: input.payment.provider,
          amount_minor: input.payment.amount_minor,
          currency: input.payment.currency,
          status: input.payment.status,
          provider_order_id: null,
          provider_payment_id: null,
          failure_reason: null,
          captured_at: null,
          created_at: now,
          updated_at: now,
        })
        .select(PAYMENT_COLUMNS)
        .single();
      const payment = parsePaymentRow(paymentResult.data);
      if (paymentResult.error || !payment || payment.order_id !== order.id) {
        throw new Error("Could not create the pending payment.");
      }
      if (payment.status !== "created" || payment.captured_at) {
        throw new Error("Pending payment must start as created and uncaptured.");
      }

      return { order, items, payment };
    },

    async attachProviderOrderId(paymentId, providerOrderId) {
      const admin = createSupabaseAdminClient();
      const updated = await admin
        .from("payments")
        .update({
          provider_order_id: providerOrderId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .eq("status", "created")
        .is("captured_at", null)
        .select(PAYMENT_COLUMNS)
        .single();
      const payment = parsePaymentRow(updated.data);
      if (updated.error || !payment) {
        throw new Error("Could not attach the PayPal order id.");
      }
      return payment;
    },

    async markInitiationFailed(paymentId, reason) {
      await this.closeOpenAttempt(paymentId, "failed", reason);
    },

    async loadOpenAttempt(paymentId) {
      if (!pendingPaymentWritesAvailable()) {
        return null;
      }
      const admin = createSupabaseAdminClient();
      const paymentResult = await admin
        .from("payments")
        .select(PAYMENT_COLUMNS)
        .eq("id", paymentId)
        .maybeSingle();
      const payment = parsePaymentRow(paymentResult.data);
      if (paymentResult.error || !payment || payment.captured_at) {
        return null;
      }
      if (
        payment.status !== "created" ||
        payment.provider !== PAYMENT_PROVIDER_PAYPAL ||
        !payment.provider_order_id
      ) {
        return null;
      }
      const orderResult = await admin
        .from("orders")
        .select(ORDER_COLUMNS)
        .eq("id", payment.order_id)
        .maybeSingle();
      const order = parseOrderRow(orderResult.data);
      if (
        orderResult.error ||
        !order ||
        order.id !== payment.order_id ||
        order.payment_status !== "created" ||
        (order.status !== "checkout" && order.status !== "placed")
      ) {
        return null;
      }
      const itemResult = await admin
        .from("order_items")
        .select(ORDER_ITEM_COLUMNS)
        .eq("order_id", order.id);
      if (itemResult.error || !Array.isArray(itemResult.data)) {
        return null;
      }
      const items = itemResult.data
        .map(parseOrderItemRow)
        .filter((row): row is OrderItemRow => row !== null && row.order_id === order.id);
      return { order, items, payment };
    },

    async closeOpenAttempt(paymentId, status, reason) {
      if (!pendingPaymentWritesAvailable()) {
        return;
      }
      const admin = createSupabaseAdminClient();
      const now = new Date().toISOString();
      const paymentResult = await admin
        .from("payments")
        .update({
          status,
          failure_reason: reason.slice(0, 280),
          updated_at: now,
        })
        .eq("id", paymentId)
        .in("status", ["created", "authorized"])
        .is("captured_at", null)
        .select("order_id")
        .maybeSingle();
      const orderId =
        paymentResult.data &&
        typeof paymentResult.data === "object" &&
        "order_id" in paymentResult.data &&
        typeof paymentResult.data.order_id === "string"
          ? paymentResult.data.order_id
          : null;
      if (!orderId) {
        return;
      }
      await admin
        .from("orders")
        .update({
          payment_status: status,
          updated_at: now,
        })
        .eq("id", orderId)
        .in("payment_status", ["created", "authorized"]);
    },
  };
}

export function parsePaymentRow(value: unknown): PaymentRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (!isSchemaPaymentStatus(row.status) || row.currency !== STORE_CURRENCY) {
    return null;
  }
  const id = asString(row.id);
  const orderId = asString(row.order_id);
  const provider = asString(row.provider);
  const amountMinor = asInteger(row.amount_minor);
  const createdAt = asString(row.created_at);
  const updatedAt = asString(row.updated_at);
  if (!id || !orderId || !provider || amountMinor == null || !createdAt || !updatedAt) {
    return null;
  }
  return {
    id,
    order_id: orderId,
    provider,
    provider_order_id: asString(row.provider_order_id),
    provider_payment_id: asString(row.provider_payment_id),
    amount_minor: amountMinor,
    currency: STORE_CURRENCY,
    status: row.status,
    failure_reason: typeof row.failure_reason === "string" ? row.failure_reason : null,
    captured_at: typeof row.captured_at === "string" ? row.captured_at : null,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
