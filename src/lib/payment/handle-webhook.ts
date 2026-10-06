import "server-only";

import { PAYMENT_PROVIDER_PAYPAL } from "@/contracts/payment/schema";
import { STORE_CURRENCY } from "@/contracts/money";
import { isPayPalChargeCurrency } from "@/lib/payment/payment-route";
import { payPalValueToChargeMinor } from "@/lib/paypal/amount";
import {
  captureVerifiedPayment,
  type CaptureVerifiedPaymentDependencies,
  type CaptureVerifiedPaymentResult,
  type ServerVerifiedPayment,
} from "@/lib/payment/capture-verified";
import {
  createSupabasePaymentWebhookStore,
  type PaymentWebhookStore,
  type WebhookPaymentRecord,
} from "@/lib/payment/webhook-store";
import { resolvePayPalWebhookId } from "@/lib/paypal/config";
import {
  verifyPayPalWebhookSignature,
  type VerifyPayPalWebhookSignatureResult,
} from "@/lib/paypal/verify-webhook-signature";

/** App-capture only after signature + amount reconcile. */
export const PAYPAL_PAYMENT_CAPTURE_COMPLETED = "PAYMENT.CAPTURE.COMPLETED";
export const PAYPAL_PAYMENT_CAPTURE_DECLINED = "PAYMENT.CAPTURE.DECLINED";
export const PAYPAL_PAYMENT_CAPTURE_DENIED = "PAYMENT.CAPTURE.DENIED";
/** Buyer approved — funds not necessarily captured. Never app-capture. */
export const PAYPAL_CHECKOUT_ORDER_APPROVED = "CHECKOUT.ORDER.APPROVED";
/** Documented uncaptured-after-approve signal — log only. */
export const PAYPAL_CHECKOUT_PAYMENT_APPROVAL_REVERSED = "CHECKOUT.PAYMENT-APPROVAL.REVERSED";

export type PayPalWebhookHttpResult = {
  status: 200 | 400 | 503;
  body: { ok: boolean };
};

export type HandlePayPalWebhookInput = {
  rawBody: string;
  transmissionId: string;
  transmissionTime: string;
  transmissionSig: string;
  certUrl: string;
  authAlgo: string;
};

export type HandlePayPalWebhookDependencies = {
  webhookId?: string;
  store?: PaymentWebhookStore;
  verifySignature?: (
    input: Parameters<typeof verifyPayPalWebhookSignature>[0],
  ) => Promise<VerifyPayPalWebhookSignatureResult>;
  capture?: (
    verified: ServerVerifiedPayment,
    dependencies?: CaptureVerifiedPaymentDependencies,
  ) => Promise<CaptureVerifiedPaymentResult>;
  captureDependencies?: CaptureVerifiedPaymentDependencies;
  log?: (message: string, fields?: Record<string, unknown>) => void;
};

/**
 * Recovers a PayPal payment from a postback-verified webhook.
 * Capture still goes through `captureVerifiedPayment`.
 * Never skips signature verification on real traffic.
 */
export async function handlePayPalWebhook(
  input: HandlePayPalWebhookInput,
  dependencies?: HandlePayPalWebhookDependencies,
): Promise<PayPalWebhookHttpResult> {
  const webhookId = resolveWebhookId(dependencies);
  if (!webhookId) {
    return retryable();
  }

  const verify = dependencies?.verifySignature ?? verifyPayPalWebhookSignature;
  const verified = await verify({
    rawBody: input.rawBody,
    transmissionId: input.transmissionId,
    transmissionTime: input.transmissionTime,
    transmissionSig: input.transmissionSig,
    certUrl: input.certUrl,
    authAlgo: input.authAlgo,
    webhookId,
  });
  if (!verified.ok) {
    return rejected();
  }

  const parsed = parseWebhookJson(input.rawBody);
  if (!parsed) {
    return rejected();
  }

  const eventType = asNonEmptyString(parsed.event_type);
  const providerEventId = asNonEmptyString(parsed.id);
  if (!eventType || !providerEventId) {
    return rejected();
  }

  const store = dependencies?.store ?? createSupabasePaymentWebhookStore();
  const log = dependencies?.log ?? defaultLog;
  const resource = extractResource(parsed);

  let event;
  try {
    event = await store.insertUnprocessedEvent({
      providerEventId,
      eventType,
      payload: sanitizeWebhookPayload(parsed, resource),
    });
  } catch {
    return retryable();
  }

  if (event.processed) {
    return acknowledged();
  }

  if (eventType === PAYPAL_CHECKOUT_ORDER_APPROVED) {
    // Buyer approved only — do not app-capture.
    return finishProcessed(store, providerEventId);
  }

  if (eventType === PAYPAL_CHECKOUT_PAYMENT_APPROVAL_REVERSED) {
    log("paypal_checkout_payment_approval_reversed", {
      providerEventId,
      eventType,
      resourceId: resource ? asNonEmptyString(resource.id) : "",
      orderId: resource ? extractRelatedOrderId(resource) : "",
    });
    return finishProcessed(store, providerEventId);
  }

  if (
    eventType === PAYPAL_PAYMENT_CAPTURE_DECLINED ||
    eventType === PAYPAL_PAYMENT_CAPTURE_DENIED
  ) {
    return handleFailedCapture(store, resource, providerEventId, eventType);
  }

  if (eventType !== PAYPAL_PAYMENT_CAPTURE_COMPLETED) {
    return finishProcessed(store, providerEventId);
  }

  if (!resource) {
    return rejected();
  }

  const providerPaymentId = asNonEmptyString(resource.id);
  const providerOrderId = extractRelatedOrderId(resource);
  if (!providerPaymentId || !providerOrderId) {
    return rejected();
  }

  const amount = extractAmount(resource);
  if (!amount) {
    return rejected();
  }
  const webhookAmount = payPalValueToChargeMinor(amount.value, amount.currency_code);
  if (!webhookAmount) {
    return rejected();
  }

  const resolved = await resolveInternalPayment(store, providerOrderId, providerPaymentId);
  if (!resolved) {
    return retryable();
  }
  if (resolved.payment.provider_order_id !== providerOrderId) {
    return rejected();
  }
  if (resolved.payment.provider !== PAYMENT_PROVIDER_PAYPAL) {
    return rejected();
  }
  const chargeCurrency = resolved.payment.currency;
  if (resolved.order.currency !== STORE_CURRENCY || !isPayPalChargeCurrency(chargeCurrency)) {
    return rejected();
  }
  if (
    webhookAmount.currency !== chargeCurrency ||
    webhookAmount.amountMinor !== resolved.payment.amount_minor
  ) {
    return rejected();
  }
  if (chargeCurrency === STORE_CURRENCY && resolved.payment.amount_minor !== resolved.order.total_minor) {
    return rejected();
  }

  const customId = asNonEmptyString(resource.custom_id);
  if (customId && customId !== resolved.payment.id) {
    return rejected();
  }

  return handleCompletedCapture(
    store,
    resolved,
    providerPaymentId,
    providerOrderId,
    providerEventId,
    dependencies,
  );
}

async function handleCompletedCapture(
  store: PaymentWebhookStore,
  resolved: WebhookPaymentRecord,
  providerPaymentId: string,
  providerOrderId: string,
  providerEventId: string,
  dependencies?: HandlePayPalWebhookDependencies,
): Promise<PayPalWebhookHttpResult> {
  if (resolved.payment.status === "failed" || resolved.payment.status === "cancelled") {
    return retryable();
  }
  const chargeCurrency = resolved.payment.currency;
  if (!isPayPalChargeCurrency(chargeCurrency)) {
    return rejected();
  }

  const verified: ServerVerifiedPayment =
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
          currency: chargeCurrency,
          paymentStatus: resolved.payment.status === "authorized" ? "authorized" : "created",
          orderPaymentStatus:
            resolved.order.payment_status === "authorized" ? "authorized" : "created",
        };

  const capture = dependencies?.capture ?? captureVerifiedPayment;
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

async function handleFailedCapture(
  store: PaymentWebhookStore,
  resource: Record<string, unknown> | null,
  providerEventId: string,
  eventType: string,
): Promise<PayPalWebhookHttpResult> {
  if (!resource) {
    return finishProcessed(store, providerEventId);
  }
  const providerPaymentId = asNonEmptyString(resource.id);
  const providerOrderId = extractRelatedOrderId(resource);
  if (!providerPaymentId && !providerOrderId) {
    return finishProcessed(store, providerEventId);
  }

  const resolved = providerOrderId
    ? await store.loadPaymentByProviderOrderId(providerOrderId)
    : await store.loadPaymentByProviderPaymentId(providerPaymentId);
  if (!resolved) {
    // Unknown payment — ack to stop retries; nothing to fail.
    return finishProcessed(store, providerEventId);
  }
  if (resolved.payment.status === "captured" || resolved.payment.captured_at) {
    return finishProcessed(store, providerEventId);
  }
  try {
    await store.markPaymentFailed({
      paymentId: resolved.payment.id,
      reason: `PayPal ${eventType}`,
    });
  } catch {
    return retryable();
  }
  return finishProcessed(store, providerEventId);
}

async function finishProcessed(
  store: PaymentWebhookStore,
  providerEventId: string,
): Promise<PayPalWebhookHttpResult> {
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
  store: PaymentWebhookStore,
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

function resolveWebhookId(dependencies?: HandlePayPalWebhookDependencies): string {
  if (typeof dependencies?.webhookId === "string" && dependencies.webhookId.trim()) {
    return dependencies.webhookId.trim();
  }
  const resolved = resolvePayPalWebhookId();
  return resolved.ok ? resolved.webhookId : "";
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

function extractResource(parsed: Record<string, unknown>): Record<string, unknown> | null {
  const resource = parsed.resource;
  if (!resource || typeof resource !== "object" || Array.isArray(resource)) {
    return null;
  }
  return resource as Record<string, unknown>;
}

function extractRelatedOrderId(resource: Record<string, unknown>): string {
  const supplementary = resource.supplementary_data;
  if (supplementary && typeof supplementary === "object" && !Array.isArray(supplementary)) {
    const related = (supplementary as Record<string, unknown>).related_ids;
    if (related && typeof related === "object" && !Array.isArray(related)) {
      const orderId = asNonEmptyString((related as Record<string, unknown>).order_id);
      if (orderId) {
        return orderId;
      }
    }
  }
  // Some payloads expose order id via HATEOAS "up" link path — not used; require related_ids.
  return "";
}

function extractAmount(
  resource: Record<string, unknown>,
): { value: unknown; currency_code: unknown } | null {
  const amount = resource.amount;
  if (!amount || typeof amount !== "object" || Array.isArray(amount)) {
    return null;
  }
  const row = amount as Record<string, unknown>;
  return { value: row.value, currency_code: row.currency_code };
}

function sanitizeWebhookPayload(
  parsed: Record<string, unknown>,
  resource: Record<string, unknown> | null,
): Record<string, unknown> {
  const amount = resource ? extractAmount(resource) : null;
  return {
    id: asNonEmptyString(parsed.id),
    event_type: asNonEmptyString(parsed.event_type),
    create_time: asNonEmptyString(parsed.create_time) || null,
    resource_type: asNonEmptyString(parsed.resource_type) || null,
    resource: resource
      ? {
          id: asNonEmptyString(resource.id),
          status: asNonEmptyString(resource.status),
          custom_id: asNonEmptyString(resource.custom_id) || null,
          order_id: extractRelatedOrderId(resource) || null,
          amount: amount
            ? {
                value: typeof amount.value === "string" ? amount.value : null,
                currency_code:
                  typeof amount.currency_code === "string" ? amount.currency_code : null,
              }
            : null,
        }
      : null,
  };
}

function asNonEmptyString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function defaultLog(message: string, fields?: Record<string, unknown>): void {
  console.info(message, fields ?? {});
}

function acknowledged(): PayPalWebhookHttpResult {
  return { status: 200, body: { ok: true } };
}

function rejected(): PayPalWebhookHttpResult {
  return { status: 400, body: { ok: false } };
}

function retryable(): PayPalWebhookHttpResult {
  return { status: 503, body: { ok: false } };
}
