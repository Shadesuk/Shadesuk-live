import "server-only";

import { resolveRazorpayServerConfig } from "./config";
import { razorpayWebhookSignatureMatches } from "./signature";
import { indiaWebhookHttpStatus, settleIndiaPayment } from "./commit";
import { isRazorpayOrderId, isRazorpayPaymentId } from "./ids";

export type RazorpayWebhookResult = {
  status: number;
  body: { ok: boolean };
};

/**
 * Verifies the Razorpay webhook against the raw body.
 * Capture still goes through the amount check. A bad signature does not capture.
 */
export async function handleRazorpayWebhook(input: {
  rawBody: string;
  signature: string;
}): Promise<RazorpayWebhookResult> {
  const config = resolveRazorpayServerConfig();
  if (!config.ok) {
    return { status: 503, body: { ok: false } };
  }
  if (!razorpayWebhookSignatureMatches(input.rawBody, input.signature, config.config.webhookSecret)) {
    return { status: 400, body: { ok: false } };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody) as unknown;
  } catch {
    return { status: 400, body: { ok: false } };
  }
  const event = readPaymentEvent(parsed);
  if (!event) {
    return { status: 200, body: { ok: true } };
  }
  const settled = await settleIndiaPayment({
    providerOrderId: event.orderId,
    providerPaymentId: event.paymentId,
    config: config.config,
  });
  const status = indiaWebhookHttpStatus(settled);
  return { status, body: { ok: status === 200 } };
}

function readPaymentEvent(value: unknown): { orderId: string; paymentId: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const event = typeof record.event === "string" ? record.event : "";
  if (event !== "payment.authorized" && event !== "payment.captured") {
    return null;
  }
  const payload = record.payload;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const paymentWrap = (payload as Record<string, unknown>).payment;
  if (!paymentWrap || typeof paymentWrap !== "object") {
    return null;
  }
  const entity = (paymentWrap as Record<string, unknown>).entity;
  if (!entity || typeof entity !== "object") {
    return null;
  }
  const entityRecord = entity as Record<string, unknown>;
  const paymentId = typeof entityRecord.id === "string" ? entityRecord.id : "";
  const orderId = typeof entityRecord.order_id === "string" ? entityRecord.order_id : "";
  if (!isRazorpayPaymentId(paymentId) || !isRazorpayOrderId(orderId)) {
    return null;
  }
  return { orderId, paymentId };
}
