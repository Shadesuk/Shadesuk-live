import "server-only";

import { createSupabaseAdminClient, hasSupabaseSecretKey } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isUuid } from "@/lib/ids";
import type { IndiaCharge } from "@/lib/payment/india-charge";
import type { StoredRazorpayPayment } from "./assess";
import { isRazorpayOrderId, isRazorpayPaymentId } from "./ids";
import type { IndiaOpenAttempt } from "./reuse";

export type PersistedIndiaPayment = {
  orderId: string;
  paymentId: string;
  orderReference: string;
};

export function indiaPaymentWritesAvailable(): boolean {
  return isSupabaseConfigured() && hasSupabaseSecretKey();
}

export async function insertIndiaPayment(charge: IndiaCharge): Promise<PersistedIndiaPayment> {
  if (!indiaPaymentWritesAvailable()) {
    throw new Error("India payment writes are not configured.");
  }
  const admin = createSupabaseAdminClient();
  const result = await admin.rpc("insert_india_checkout_attempt", {
    p_payload: {
      provider: "razorpay",
      charge_currency: "INR",
      order_currency: charge.order.currency,
      order_reference: charge.order.order_reference,
      user_id: charge.order.user_id,
      customer_email: charge.order.customer_email,
      customer_first_name: charge.order.customer_first_name,
      customer_last_name: charge.order.customer_last_name,
      subtotal_minor: charge.order.subtotal_minor,
      shipping_minor: charge.order.shipping_minor,
      total_minor: charge.order.total_minor,
      delivery_address: charge.order.delivery_address,
      amount_minor: charge.payment.amountMinor,
      fx_rate_id: charge.payment.fxRateId,
      quote_frozen_at: new Date(charge.payment.frozenAt).toISOString(),
      items: charge.items.map((item) => ({
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        sku: item.sku,
        product_name: item.product_name,
        colour_name: item.colour_name,
        variant_name: item.variant_name,
        quantity: item.quantity,
        unit_price_minor: item.unit_price_minor,
        line_total_minor: item.line_total_minor,
        product_snapshot: item.product_snapshot,
      })),
    },
  });
  const row = rpcRow(result.data);
  if (result.error || row.status !== "created" || !isUuid(String(row.order_id)) || !isUuid(String(row.payment_id))) {
    throw new Error("Could not create the India payment.");
  }
  return {
    orderId: String(row.order_id),
    paymentId: String(row.payment_id),
    orderReference: String(row.order_reference),
  };
}

export async function loadOpenIndiaAttempt(paymentId: string): Promise<IndiaOpenAttempt | null> {
  if (!isUuid(paymentId) || !indiaPaymentWritesAvailable()) {
    return null;
  }
  const admin = createSupabaseAdminClient();
  const paymentResult = await admin
    .from("payments")
    .select("id, order_id, amount_minor, currency, status, fx_rate_id, quote_frozen_at, provider_order_id, captured_at")
    .eq("id", paymentId)
    .eq("provider", "razorpay")
    .maybeSingle();
  const payment = paymentResult.data;
  if (paymentResult.error || !payment || payment.captured_at || payment.status !== "created") {
    return null;
  }
  const orderResult = await admin
    .from("orders")
    .select("id, order_reference, currency, user_id, customer_email, payment_status, status")
    .eq("id", payment.order_id)
    .maybeSingle();
  const order = orderResult.data;
  if (
    orderResult.error ||
    !order ||
    order.currency !== "GBP" ||
    order.payment_status !== "created" ||
    order.status !== "checkout"
  ) {
    return null;
  }
  const itemResult = await admin
    .from("order_items")
    .select("product_variant_id, quantity")
    .eq("order_id", order.id);
  if (itemResult.error || !Array.isArray(itemResult.data)) {
    return null;
  }
  const frozenAt = payment.quote_frozen_at ? Date.parse(String(payment.quote_frozen_at)) : null;
  return {
    paymentId: String(payment.id),
    orderId: String(order.id),
    orderReference: String(order.order_reference),
    providerOrderId: payment.provider_order_id == null ? null : String(payment.provider_order_id),
    amountMinor: Number(payment.amount_minor),
    currency: String(payment.currency),
    frozenAt: frozenAt != null && Number.isFinite(frozenAt) ? frozenAt : null,
    userId: order.user_id == null ? null : String(order.user_id),
    email: String(order.customer_email),
    status: String(payment.status),
    lines: itemResult.data.map((item) => ({
      variantId: item.product_variant_id == null ? "" : String(item.product_variant_id),
      quantity: Number(item.quantity),
    })),
  };
}

export async function attachIndiaProviderOrder(paymentId: string, providerOrderId: string): Promise<void> {
  if (!isUuid(paymentId) || !isRazorpayOrderId(providerOrderId)) {
    throw new Error("India provider order id is not attachable.");
  }
  const admin = createSupabaseAdminClient();
  const updated = await admin
    .from("payments")
    .update({ provider_order_id: providerOrderId, updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("provider", "razorpay")
    .eq("status", "created")
    .is("captured_at", null)
    .select("id")
    .maybeSingle();
  if (!updated.data) {
    throw new Error("Could not attach the Razorpay order id.");
  }
}

export async function loadStoredIndiaPayment(providerOrderId: string): Promise<
  | (StoredRazorpayPayment & { paymentId: string; orderId: string; orderReference: string })
  | null
> {
  if (!isRazorpayOrderId(providerOrderId) || !indiaPaymentWritesAvailable()) {
    return null;
  }
  const admin = createSupabaseAdminClient();
  const paymentResult = await admin
    .from("payments")
    .select("id, order_id, amount_minor, currency, status, fx_rate_id, quote_frozen_at, provider_payment_id, captured_at")
    .eq("provider", "razorpay")
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  const row = paymentResult.data;
  if (paymentResult.error || !row) {
    return null;
  }
  const orderResult = await admin
    .from("orders")
    .select("id, order_reference, currency")
    .eq("id", row.order_id)
    .maybeSingle();
  if (orderResult.error || !orderResult.data || orderResult.data.currency !== "GBP") {
    return null;
  }
  const frozenAt = row.quote_frozen_at ? Date.parse(String(row.quote_frozen_at)) : null;
  return {
    paymentId: String(row.id),
    orderId: String(orderResult.data.id),
    orderReference: String(orderResult.data.order_reference),
    amountMinor: Number(row.amount_minor),
    currency: String(row.currency),
    fxRateId: row.fx_rate_id == null ? null : String(row.fx_rate_id),
    frozenAt: frozenAt != null && Number.isFinite(frozenAt) ? frozenAt : null,
    status: row.captured_at ? "captured" : String(row.status),
    providerPaymentId: row.provider_payment_id == null ? null : String(row.provider_payment_id),
  };
}

export async function markIndiaPaymentCaptured(input: {
  paymentId: string;
  orderId: string;
  providerPaymentId: string;
}): Promise<"captured" | "duplicate" | "rejected" | "error"> {
  if (!isUuid(input.paymentId) || !isUuid(input.orderId) || !isRazorpayPaymentId(input.providerPaymentId)) {
    return "rejected";
  }
  const admin = createSupabaseAdminClient();
  const result = await admin.rpc("mark_india_payment_captured", {
    p_payment_id: input.paymentId,
    p_order_id: input.orderId,
    p_provider_payment_id: input.providerPaymentId,
  });
  const status = rpcRow(result.data).status;
  if (result.error) {
    return "error";
  }
  if (status === "captured" || status === "duplicate" || status === "rejected") {
    return status;
  }
  return "rejected";
}

export async function markIndiaPaymentFailed(paymentId: string, reason: string): Promise<void> {
  if (!isUuid(paymentId) || !indiaPaymentWritesAvailable()) {
    return;
  }
  const admin = createSupabaseAdminClient();
  await admin.rpc("mark_india_payment_failed", {
    p_payment_id: paymentId,
    p_reason: reason.slice(0, 280),
  });
}

function rpcRow(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
