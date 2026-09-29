import "server-only";

import type { OrderRow } from "@/contracts/order/schema";
import { PAYMENT_PROVIDER_PAYPAL, type PaymentRow } from "@/contracts/payment/schema";
import { parseOrderRow } from "@/lib/order-rows";
import { parsePaymentRow } from "@/lib/payment/pending-store";
import { createSupabaseAdminClient, hasSupabaseSecretKey } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isUuid } from "@/lib/ids";

const ORDER_COLUMNS =
  "id, order_reference, user_id, customer_email, customer_first_name, customer_last_name, status, payment_status, currency, subtotal_minor, shipping_minor, total_minor, delivery_address, created_at, updated_at";

const PAYMENT_COLUMNS =
  "id, order_id, provider, provider_order_id, provider_payment_id, amount_minor, currency, status, failure_reason, captured_at, created_at, updated_at";

export type PaymentVerificationRecord = {
  payment: PaymentRow;
  order: OrderRow;
};

export type PaymentVerificationStore = {
  loadByPaymentId: (paymentId: string) => Promise<PaymentVerificationRecord | null>;
  attachProviderPaymentId: (paymentId: string, providerPaymentId: string) => Promise<PaymentRow | null>;
};

export async function findPaymentIdByPayPalOrderId(
  paypalOrderId: string,
): Promise<string | null> {
  const providerOrderId = paypalOrderId.trim();
  if (!providerOrderId || !isSupabaseConfigured() || !hasSupabaseSecretKey()) {
    return null;
  }
  const admin = createSupabaseAdminClient();
  const result = await admin
    .from("payments")
    .select("id")
    .eq("provider", PAYMENT_PROVIDER_PAYPAL)
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (result.error || !result.data || typeof result.data.id !== "string") {
    return null;
  }
  return isUuid(result.data.id) ? result.data.id : null;
}

export function createSupabasePaymentVerificationStore(): PaymentVerificationStore {
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
      return { payment, order };
    },

    async attachProviderPaymentId(paymentId, providerPaymentId) {
      if (!isUuid(paymentId) || !providerPaymentId.trim()) {
        return null;
      }
      const admin = createSupabaseAdminClient();
      const updated = await admin
        .from("payments")
        .update({
          provider_payment_id: providerPaymentId.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .eq("status", "created")
        .is("captured_at", null)
        .select(PAYMENT_COLUMNS)
        .maybeSingle();
      return parsePaymentRow(updated.data);
    },
  };
}
