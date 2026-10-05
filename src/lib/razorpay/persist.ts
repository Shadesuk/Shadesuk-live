import "server-only";

import { createSupabaseAdminClient, hasSupabaseSecretKey } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isUuid } from "@/lib/ids";
import type { IndiaCharge } from "@/lib/payment/india-charge";
import type { StoredRazorpayPayment } from "./assess";

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
  const now = new Date().toISOString();
  const orderResult = await admin
    .from("orders")
    .insert({ ...charge.order, created_at: now, updated_at: now })
    .select("id, order_reference")
    .single();
  if (orderResult.error || !orderResult.data?.id) {
    throw new Error("Could not create the India order.");
  }
  const orderId = String(orderResult.data.id);
  const itemResult = await admin.from("order_items").insert(
    charge.items.map((item) => ({ ...item, order_id: orderId })),
  );
  if (itemResult.error) {
    throw new Error("Could not create India order items.");
  }
  const paymentResult = await admin
    .from("payments")
    .insert({
      order_id: orderId,
      provider: "razorpay",
      amount_minor: charge.payment.amountMinor,
      currency: "INR",
      status: "created",
      fx_rate_id: charge.payment.fxRateId,
      quote_frozen_at: new Date(charge.payment.frozenAt).toISOString(),
      provider_order_id: null,
      provider_payment_id: null,
      failure_reason: null,
      captured_at: null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (paymentResult.error || !paymentResult.data?.id) {
    throw new Error("Could not create the India payment.");
  }
  return {
    orderId,
    paymentId: String(paymentResult.data.id),
    orderReference: String(orderResult.data.order_reference),
  };
}

export async function attachIndiaProviderOrder(paymentId: string, providerOrderId: string): Promise<void> {
  if (!isUuid(paymentId) || !providerOrderId.startsWith("order_")) {
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
  if (!providerOrderId.startsWith("order_") || !indiaPaymentWritesAvailable()) {
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
}): Promise<"captured" | "duplicate" | "rejected"> {
  if (!isUuid(input.paymentId) || !isUuid(input.orderId) || !input.providerPaymentId.startsWith("pay_")) {
    return "rejected";
  }
  const admin = createSupabaseAdminClient();
  const capturedAt = new Date().toISOString();
  const updated = await admin
    .from("payments")
    .update({
      status: "captured",
      captured_at: capturedAt,
      provider_payment_id: input.providerPaymentId,
      updated_at: capturedAt,
    })
    .eq("id", input.paymentId)
    .eq("provider", "razorpay")
    .in("status", ["created", "authorized"])
    .is("captured_at", null)
    .select("id")
    .maybeSingle();
  if (!updated.data) {
    const existing = await admin
      .from("payments")
      .select("status, provider_payment_id, captured_at")
      .eq("id", input.paymentId)
      .eq("provider", "razorpay")
      .maybeSingle();
    if (
      existing.data?.captured_at &&
      existing.data.provider_payment_id === input.providerPaymentId
    ) {
      return "duplicate";
    }
    return "rejected";
  }
  const order = await admin
    .from("orders")
    .update({ payment_status: "captured", status: "placed", updated_at: capturedAt })
    .eq("id", input.orderId)
    .eq("currency", "GBP")
    .eq("payment_status", "created")
    .select("id")
    .maybeSingle();
  if (!order.data) {
    const placed = await admin
      .from("orders")
      .select("payment_status")
      .eq("id", input.orderId)
      .maybeSingle();
    if (placed.data?.payment_status === "captured") {
      return "duplicate";
    }
    return "rejected";
  }
  return "captured";
}

export async function markIndiaPaymentFailed(paymentId: string, reason: string): Promise<void> {
  if (!isUuid(paymentId)) {
    return;
  }
  const admin = createSupabaseAdminClient();
  await admin
    .from("payments")
    .update({
      status: "failed",
      failure_reason: reason.slice(0, 280),
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("provider", "razorpay")
    .eq("status", "created")
    .is("captured_at", null);
}
