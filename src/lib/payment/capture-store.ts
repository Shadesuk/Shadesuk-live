import "server-only";

import type { OrderItemRow, OrderRow } from "@/contracts/order/schema";
import type { PaymentRow } from "@/contracts/payment/schema";
import { PAYMENT_PROVIDER_RAZORPAY } from "@/contracts/payment/schema";
import { parseOrderItemRow, parseOrderRow } from "@/lib/order-rows";
import { parsePaymentRow } from "@/lib/payment/pending-store";
import { createSupabaseAdminClient, hasSupabaseSecretKey } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isUuid } from "@/lib/ids";

const ORDER_COLUMNS =
  "id, order_reference, user_id, customer_email, customer_first_name, customer_last_name, status, payment_status, currency, subtotal_minor, shipping_minor, total_minor, delivery_address, created_at, updated_at";

const ORDER_ITEM_COLUMNS =
  "id, order_id, product_id, product_variant_id, sku, product_name, colour_name, variant_name, quantity, unit_price_minor, line_total_minor, product_snapshot, created_at";

const PAYMENT_COLUMNS =
  "id, order_id, provider, provider_order_id, provider_payment_id, amount_minor, currency, status, failure_reason, captured_at, created_at, updated_at";

export type PaymentCaptureRecord = {
  payment: PaymentRow;
  order: OrderRow;
  items: OrderItemRow[];
};

export type CheckoutCartConversion = "converted" | "already_converted" | "missing";

export type PaymentCaptureStore = {
  loadByPaymentId: (paymentId: string) => Promise<PaymentCaptureRecord | null>;
  capturePayment: (input: {
    paymentId: string;
    providerPaymentId: string;
    providerOrderId: string;
    capturedAt: string;
  }) => Promise<PaymentRow | null>;
  markOrderPaymentCaptured: (orderId: string) => Promise<OrderRow | null>;
  loadVariantStock: (variantIds: readonly string[]) => Promise<Map<string, number>>;
  decrementVariantStock: (input: {
    variantId: string;
    quantity: number;
    expectedStock: number;
  }) => Promise<boolean>;
  convertActiveCheckoutCart: (input: {
    userId: string | null;
    sessionId: string | null;
  }) => Promise<CheckoutCartConversion>;
};

export function createSupabasePaymentCaptureStore(): PaymentCaptureStore {
  return {
    async loadByPaymentId(paymentId) {
      if (!isUuid(paymentId) || !isSupabaseConfigured() || !hasSupabaseSecretKey()) {
        return null;
      }
      const admin = createSupabaseAdminClient();
      const paymentResult = await admin
        .from("payments")
        .select(PAYMENT_COLUMNS)
        .eq("id", paymentId)
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

      const itemResult = await admin
        .from("order_items")
        .select(ORDER_ITEM_COLUMNS)
        .eq("order_id", order.id);
      if (itemResult.error || !Array.isArray(itemResult.data)) {
        return { payment, order, items: [] };
      }
      const items = itemResult.data
        .map(parseOrderItemRow)
        .filter((row): row is OrderItemRow => row !== null && row.order_id === order.id);

      return { payment, order, items };
    },

    async capturePayment(input) {
      if (!isUuid(input.paymentId) || !input.providerPaymentId.trim() || !input.providerOrderId.trim()) {
        return null;
      }
      const admin = createSupabaseAdminClient();
      const updated = await admin
        .from("payments")
        .update({
          status: "captured",
          captured_at: input.capturedAt,
          provider_payment_id: input.providerPaymentId.trim(),
          updated_at: input.capturedAt,
        })
        .eq("id", input.paymentId)
        .eq("provider", PAYMENT_PROVIDER_RAZORPAY)
        .eq("provider_order_id", input.providerOrderId.trim())
        .in("status", ["created", "authorized"])
        .is("captured_at", null)
        .or(`provider_payment_id.is.null,provider_payment_id.eq.${input.providerPaymentId.trim()}`)
        .select(PAYMENT_COLUMNS)
        .maybeSingle();
      return parsePaymentRow(updated.data);
    },

    async markOrderPaymentCaptured(orderId) {
      if (!isUuid(orderId)) {
        return null;
      }
      const admin = createSupabaseAdminClient();
      const now = new Date().toISOString();
      const updated = await admin
        .from("orders")
        .update({
          payment_status: "captured",
          updated_at: now,
        })
        .eq("id", orderId)
        .in("payment_status", ["created", "authorized"])
        .select(ORDER_COLUMNS)
        .maybeSingle();
      return parseOrderRow(updated.data);
    },

    async loadVariantStock(variantIds) {
      const stocks = new Map<string, number>();
      const ids = variantIds.filter((id) => isUuid(id));
      if (ids.length === 0) {
        return stocks;
      }
      const admin = createSupabaseAdminClient();
      const result = await admin.from("product_variants").select("id, stock_quantity").in("id", ids);
      if (result.error || !Array.isArray(result.data)) {
        return stocks;
      }
      for (const row of result.data) {
        if (
          row &&
          typeof row === "object" &&
          typeof row.id === "string" &&
          typeof row.stock_quantity === "number" &&
          Number.isInteger(row.stock_quantity)
        ) {
          stocks.set(row.id, row.stock_quantity);
        }
      }
      return stocks;
    },

    async decrementVariantStock(input) {
      if (!isUuid(input.variantId) || input.quantity < 1 || input.expectedStock < input.quantity) {
        return false;
      }
      const nextStock = input.expectedStock - input.quantity;
      const admin = createSupabaseAdminClient();
      const updated = await admin
        .from("product_variants")
        .update({
          stock_quantity: nextStock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.variantId)
        .eq("stock_quantity", input.expectedStock)
        .gte("stock_quantity", input.quantity)
        .select("id")
        .maybeSingle();
      return Boolean(updated.data);
    },

    async convertActiveCheckoutCart(input) {
      if (!isSupabaseConfigured() || !hasSupabaseSecretKey()) {
        return "missing";
      }
      const admin = createSupabaseAdminClient();
      const now = new Date().toISOString();

      if (input.userId && isUuid(input.userId)) {
        const updated = await admin
          .from("carts")
          .update({ status: "converted", updated_at: now })
          .eq("user_id", input.userId)
          .is("session_id", null)
          .eq("status", "active")
          .select("id")
          .maybeSingle();
        if (updated.data) {
          return "converted";
        }
        const existing = await admin
          .from("carts")
          .select("id")
          .eq("user_id", input.userId)
          .eq("status", "converted")
          .maybeSingle();
        return existing.data ? "already_converted" : "missing";
      }

      if (input.sessionId) {
        const updated = await admin
          .from("carts")
          .update({ status: "converted", updated_at: now })
          .eq("session_id", input.sessionId)
          .is("user_id", null)
          .eq("status", "active")
          .select("id")
          .maybeSingle();
        if (updated.data) {
          return "converted";
        }
        const existing = await admin
          .from("carts")
          .select("id")
          .eq("session_id", input.sessionId)
          .is("user_id", null)
          .eq("status", "converted")
          .maybeSingle();
        return existing.data ? "already_converted" : "missing";
      }

      return "missing";
    },
  };
}
