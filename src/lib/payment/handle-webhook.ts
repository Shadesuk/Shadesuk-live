import "server-only";

import { PAYMENT_PROVIDER_RAZORPAY } from "@/contracts/payment/schema";
import { STORE_CURRENCY } from "@/contracts/money";
import {
  captureVerifiedRazorpayPayment,
  type CaptureVerifiedPaymentDependencies,
  type CaptureVerifiedPaymentResult,
  type ServerVerifiedRazorpayPayment,
} from "@/lib/payment/capture-verified";
import {
  createSupabaseRazorpayWebhookStore,
  type RazorpayWebhookStore,
  type WebhookPaymentRecord,
} from "@/lib/payment/webhook-store";
import { resolveRazorpayWebhookSecret } from "@/lib/razorpay/config";
import { razorpaySubunitToGbpMinor } from "@/lib/razorpay/amount";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay/verify-webhook-signature";

export const RAZORPAY_PAYMENT_CAPTURED_EVENT = "payment.captured";
export const RAZORPAY_PAYMENT_FAILED_EVENT = "payment.failed";

export type RazorpayWebhookHttpResult = {
  status: 200 | 400 | 503;
  body: { ok: boolean };
};

export type HandleRazorpayWebhookInput = {
  rawBody: string;
  signature: string;
  eventIdHeader?: string;
};

export type HandleRazorpayWebhookDependencies = {
  webhookSecret?: string;
  store?: RazorpayWebhookStore;
  capture?: (
    verified: ServerVerifiedRazorpayPayment,
    dependencies?: CaptureVerifiedPaymentDependencies,
  ) => Promise<CaptureVerifiedPaymentResult>;
  captureDependencies?: CaptureVerifiedPaymentDependencies;
};

/**
 * Recovers a Razorpay payment from a signed webhook.
 * Capture still goes through `captureVerifiedRazorpayPayment`.
 */
export async function handleRazorpayWebhook(
  input: HandleRazorpayWebhookInput,
  dependencies?: HandleRazorpayWebhookDependencies,
): Promise<RazorpayWebhookHttpResult> {
  const secret = resolveWebhookSecret(dependencies);
  if (!secret) {
    return retryable();
  }
  if (
    !verifyRazorpayWebhookSignature({
      rawBody: input.rawBody,
      signature: input.signature,
      webhookSecret: secret,
    })
  ) {
    return rejected();
  }

  const parsed = parseWebhookJson(input.rawBody);
  if (!parsed) {
    return rejected();
  }

  const eventType = asNonEmptyString(parsed.event);
  const paymentEntity = extractPaymentEntity(parsed);
  const providerEventId = resolveProviderEventId(parsed, input.eventIdHeader, paymentEntity);
  if (!eventType || !providerEventId) {
    return rejected();
  }

  const store = dependencies?.store ?? createSupabaseRazorpayWebhookStore();
  let event;
  try {
    event = await store.insertUnprocessedEvent({
      providerEventId,
      eventType,
      payload: sanitizeWebhookPayload(parsed, paymentEntity),
    });
  } catch {
    return retryable();
  }

  if (event.processed) {
    return acknowledged();
  }

  if (eventType !== RAZORPAY_PAYMENT_CAPTURED_EVENT && eventType !== RAZORPAY_PAYMENT_FAILED_EVENT) {
    return finishProcessed(store, providerEventId);
  }
  if (!paymentEntity) {
    return rejected();
  }

  const providerPaymentId = asNonEmptyString(paymentEntity.id);
  const providerOrderId = asNonEmptyString(paymentEntity.order_id);
  if (!providerPaymentId || !providerOrderId) {
    return rejected();
  }

  const resolved = await resolveInternalPayment(store, providerOrderId, providerPaymentId);
  if (!resolved) {
    return retryable();
  }
  if (resolved.payment.provider_order_id !== providerOrderId) {
    return rejected();
  }
  if (resolved.payment.provider !== PAYMENT_PROVIDER_RAZORPAY) {
    return rejected();
  }
  if (resolved.payment.currency !== STORE_CURRENCY || resolved.order.currency !== STORE_CURRENCY) {
    return rejected();
  }
  const webhookAmountMinor = razorpaySubunitToGbpMinor(paymentEntity.amount, paymentEntity.currency);
  if (webhookAmountMinor == null || webhookAmountMinor !== resolved.payment.amount_minor) {
    return rejected();
  }

  if (eventType === RAZORPAY_PAYMENT_FAILED_EVENT) {
    return handleFailedPayment(store, resolved, paymentEntity, providerEventId);
  }

  return handleCapturedPayment(
    store,
    resolved,
    providerPaymentId,
    providerOrderId,
    providerEventId,
    dependencies,
  );
}

async function handleCapturedPayment(
  store: RazorpayWebhookStore,
  resolved: WebhookPaymentRecord,
  providerPaymentId: string,
  providerOrderId: string,
  providerEventId: string,
  dependencies?: HandleRazorpayWebhookDependencies,
): Promise<RazorpayWebhookHttpResult> {
  if (resolved.payment.status === "failed" || resolved.payment.status === "cancelled") {
    return retryable();
  }

  const verified: ServerVerifiedRazorpayPayment =
    resolved.payment.status === "captured" || resolved.order.payment_status === "captured"
      ? {
          outcome: "already_captured",
          paymentId: resolved.payment.id,
          orderId: resolved.order.id,
        }
      : {
          outcome: "verified",
          paymentId: resolved.payment.id,
          orderId: resolved.order.id,
          orderReference: resolved.order.order_reference,
          providerOrderId,
          providerPaymentId,
          amountMinor: resolved.payment.amount_minor,
          currency: "GBP",
          paymentStatus: resolved.payment.status === "authorized" ? "authorized" : "created",
          orderPaymentStatus:
            resolved.order.payment_status === "authorized" ? "authorized" : "created",
        };

  const capture = dependencies?.capture ?? captureVerifiedRazorpayPayment;
  let captured: CaptureVerifiedPaymentResult;
  try {
    captured = await capture(verified, {
      ...dependencies?.captureDependencies,
      resolveCheckoutSessionId:
        dependencies?.captureDependencies?.resolveCheckoutSessionId ?? (async () => null),
    });
  } catch {
    return retryable();
  }

  if (captured.outcome === "captured" || captured.outcome === "already_captured") {
    return finishProcessed(store, providerEventId);
  }
  return retryable();
}

async function handleFailedPayment(
  store: RazorpayWebhookStore,
  resolved: WebhookPaymentRecord,
  paymentEntity: Record<string, unknown>,
  providerEventId: string,
): Promise<RazorpayWebhookHttpResult> {
  if (resolved.payment.status === "captured" || resolved.payment.captured_at) {
    return finishProcessed(store, providerEventId);
  }
  try {
    await store.markPaymentFailed({
      paymentId: resolved.payment.id,
      reason: safeFailureReason(paymentEntity),
    });
  } catch {
    return retryable();
  }
  return finishProcessed(store, providerEventId);
}

async function finishProcessed(
  store: RazorpayWebhookStore,
  providerEventId: string,
): Promise<RazorpayWebhookHttpResult> {
  try {
    const processed = await store.markEventProcessed(providerEventId);
    if (!processed?.processed) {
      return retryable();
    }
    return acknowledged();
  } catch {
    return retryable();
  }
}

async function resolveInternalPayment(
  store: RazorpayWebhookStore,
  providerOrderId: string,
  providerPaymentId: string,
): Promise<WebhookPaymentRecord | null> {
  const byOrder = await store.loadPaymentByProviderOrderId(providerOrderId);
  if (byOrder) {
    if (
      byOrder.payment.provider_payment_id &&
      byOrder.payment.provider_payment_id !== providerPaymentId
    ) {
      return null;
    }
    return byOrder;
  }
  return store.loadPaymentByProviderPaymentId(providerPaymentId);
}

function resolveWebhookSecret(dependencies?: HandleRazorpayWebhookDependencies): string {
  if (typeof dependencies?.webhookSecret === "string" && dependencies.webhookSecret) {
    return dependencies.webhookSecret;
  }
  const resolved = resolveRazorpayWebhookSecret();
  return resolved.ok ? resolved.webhookSecret : "";
}

function parseWebhookJson(rawBody: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(rawBody) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractPaymentEntity(parsed: Record<string, unknown>): Record<string, unknown> | null {
  const payload = parsed.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const payment = (payload as Record<string, unknown>).payment;
  if (!payment || typeof payment !== "object" || Array.isArray(payment)) {
    return null;
  }
  const entity = (payment as Record<string, unknown>).entity;
  if (entity && typeof entity === "object" && !Array.isArray(entity)) {
    return entity as Record<string, unknown>;
  }
  return payment as Record<string, unknown>;
}

function resolveProviderEventId(
  parsed: Record<string, unknown>,
  header: string | undefined,
  paymentEntity: Record<string, unknown> | null,
): string {
  const fromHeader = header?.trim() ?? "";
  if (fromHeader) {
    return fromHeader;
  }
  const fromBody = asNonEmptyString(parsed.id);
  if (fromBody) {
    return fromBody;
  }
  const eventType = asNonEmptyString(parsed.event) ?? "unknown";
  const paymentId = paymentEntity ? asNonEmptyString(paymentEntity.id) : "";
  const createdAt =
    typeof parsed.created_at === "number" || typeof parsed.created_at === "string"
      ? String(parsed.created_at)
      : "";
  if (!paymentId || !createdAt) {
    return "";
  }
  return `razorpay:${eventType}:${paymentId}:${createdAt}`;
}

function sanitizeWebhookPayload(
  parsed: Record<string, unknown>,
  paymentEntity: Record<string, unknown> | null,
): Record<string, unknown> {
  return {
    event: asNonEmptyString(parsed.event),
    created_at: parsed.created_at ?? null,
    payment: paymentEntity
      ? {
          id: asNonEmptyString(paymentEntity.id),
          order_id: asNonEmptyString(paymentEntity.order_id),
          amount: paymentEntity.amount ?? null,
          currency: asNonEmptyString(paymentEntity.currency),
          status: asNonEmptyString(paymentEntity.status),
          error_code: asNonEmptyString(paymentEntity.error_code),
          error_description: asNonEmptyString(paymentEntity.error_description),
        }
      : null,
  };
}

function safeFailureReason(paymentEntity: Record<string, unknown>): string {
  return (
    asNonEmptyString(paymentEntity.error_description) ||
    asNonEmptyString(paymentEntity.error_reason) ||
    asNonEmptyString(paymentEntity.error_code) ||
    "Razorpay payment failed"
  );
}

function asNonEmptyString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function acknowledged(): RazorpayWebhookHttpResult {
  return { status: 200, body: { ok: true } };
}

function rejected(): RazorpayWebhookHttpResult {
  return { status: 400, body: { ok: false } };
}

function retryable(): RazorpayWebhookHttpResult {
  return { status: 503, body: { ok: false } };
}
