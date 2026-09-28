/**
 * Static PayPal webhook asserts + in-memory handler tests.
 * Does not call live PayPal verify-webhook-signature (needs sandbox network + WEBHOOK_ID).
 * Skip network: inject verifySignature dependency.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  handlePayPalWebhook,
  PAYPAL_CHECKOUT_ORDER_APPROVED,
  PAYPAL_CHECKOUT_PAYMENT_APPROVAL_REVERSED,
  PAYPAL_PAYMENT_CAPTURE_COMPLETED,
  PAYPAL_PAYMENT_CAPTURE_DECLINED,
} from "../src/lib/payment/handle-webhook";
import type { PaymentWebhookStore, WebhookPaymentRecord } from "../src/lib/payment/webhook-store";
import type { PaymentRow } from "../src/contracts/payment/schema";
import type { OrderRow } from "../src/contracts/order/schema";
import { captureVerifiedPayment } from "../src/lib/payment/capture-verified";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (existsSync(resolve(root, "src/app/api/webhooks/razorpay"))) {
  throw new Error("Razorpay webhook route must be deleted (no ghost archive).");
}
if (!existsSync(resolve(root, "src/app/api/webhooks/paypal/route.ts"))) {
  throw new Error("Missing POST /api/webhooks/paypal route.");
}

const route = read("src/app/api/webhooks/paypal/route.ts");
if (!route.includes("export async function POST") || !route.includes("request.text()")) {
  throw new Error("PayPal webhook must POST and read raw body via request.text().");
}
if (!route.includes("paypal-transmission-id") || !route.includes("handlePayPalWebhook")) {
  throw new Error("PayPal webhook must pass transmission headers to the handler.");
}
if (route.includes("export async function GET") && !route.includes("methodNotAllowed")) {
  throw new Error("PayPal webhook GET must not process events.");
}

const handler = read("src/lib/payment/handle-webhook.ts");
if (!handler.includes("verifyPayPalWebhookSignature") || !handler.includes("captureVerifiedPayment")) {
  throw new Error("Handler must postback-verify then use captureVerifiedPayment.");
}
if (!handler.includes(PAYPAL_PAYMENT_CAPTURE_COMPLETED) || !handler.includes(PAYPAL_CHECKOUT_ORDER_APPROVED)) {
  throw new Error("Handler must recognize CAPTURE.COMPLETED and ORDER.APPROVED.");
}
if (handler.includes("checkout.razorpay") || handler.includes("RAZORPAY_")) {
  throw new Error("Handler must not retain Razorpay wiring.");
}

const verifySig = read("src/lib/paypal/verify-webhook-signature.ts");
if (!verifySig.includes("/v1/notifications/verify-webhook-signature")) {
  throw new Error("Webhook signature verify must use PayPal postback endpoint.");
}
if (verifySig.includes("downloadAndCache") || verifySig.includes("createVerify")) {
  throw new Error("Cert-download self-verify must not be the primary path.");
}

const PAYMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROVIDER_ORDER = "5O190127TN364715T";
const PROVIDER_PAYMENT = "8MC585209K746392H";
const EVENT_ID = "WH-TEST-CAPTURE-1";

function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: PAYMENT_ID,
    order_id: ORDER_ID,
    provider: "paypal",
    provider_order_id: PROVIDER_ORDER,
    provider_payment_id: null,
    amount_minor: 5365,
    currency: "GBP",
    status: "created",
    failure_reason: null,
    captured_at: null,
    created_at: "2026-09-22T12:00:00.000Z",
    updated_at: "2026-09-22T12:00:00.000Z",
    ...overrides,
  };
}

function orderRow(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: ORDER_ID,
    order_reference: "SHU-TESTWEBHOOK01",
    user_id: null,
    customer_email: "ada@shadesuk.example",
    customer_first_name: "Ada",
    customer_last_name: "Lovelace",
    status: "placed",
    payment_status: "created",
    currency: "GBP",
    subtotal_minor: 4900,
    shipping_minor: 465,
    total_minor: 5365,
    delivery_address: {},
    created_at: "2026-09-22T12:00:00.000Z",
    updated_at: "2026-09-22T12:00:00.000Z",
    ...overrides,
  };
}

function captureBody(eventType = PAYPAL_PAYMENT_CAPTURE_COMPLETED): string {
  return JSON.stringify({
    id: EVENT_ID,
    event_type: eventType,
    create_time: "2026-09-22T12:00:00Z",
    resource_type: "capture",
    resource: {
      id: PROVIDER_PAYMENT,
      status: "COMPLETED",
      amount: { value: "53.65", currency_code: "GBP" },
      custom_id: PAYMENT_ID,
      supplementary_data: { related_ids: { order_id: PROVIDER_ORDER } },
    },
  });
}

function createStore(record: WebhookPaymentRecord) {
  const events = new Map<string, { processed: boolean; eventType: string }>();
  let payment = { ...record.payment };
  const store: PaymentWebhookStore = {
    async insertUnprocessedEvent(input) {
      const existing = events.get(input.providerEventId);
      if (existing) {
        return {
          id: "evt-1",
          provider: "paypal",
          provider_event_id: input.providerEventId,
          event_type: existing.eventType,
          payload: {},
          processed: existing.processed,
          processed_at: existing.processed ? "2026-09-22T12:00:00.000Z" : null,
          created_at: "2026-09-22T12:00:00.000Z",
        };
      }
      events.set(input.providerEventId, { processed: false, eventType: input.eventType });
      return {
        id: "evt-1",
        provider: "paypal",
        provider_event_id: input.providerEventId,
        event_type: input.eventType,
        payload: {},
        processed: false,
        processed_at: null,
        created_at: "2026-09-22T12:00:00.000Z",
      };
    },
    async loadEvent(providerEventId) {
      const existing = events.get(providerEventId);
      if (!existing) {
        return null;
      }
      return {
        id: "evt-1",
        provider: "paypal",
        provider_event_id: providerEventId,
        event_type: existing.eventType,
        payload: {},
        processed: existing.processed,
        processed_at: existing.processed ? "2026-09-22T12:00:00.000Z" : null,
        created_at: "2026-09-22T12:00:00.000Z",
      };
    },
    async markEventProcessed(providerEventId) {
      const existing = events.get(providerEventId);
      if (!existing) {
        return null;
      }
      existing.processed = true;
      return {
        id: "evt-1",
        provider: "paypal",
        provider_event_id: providerEventId,
        event_type: existing.eventType,
        payload: {},
        processed: true,
        processed_at: "2026-09-22T12:00:00.000Z",
        created_at: "2026-09-22T12:00:00.000Z",
      };
    },
    async loadPaymentByProviderOrderId(providerOrderId) {
      if (payment.provider_order_id !== providerOrderId) {
        return null;
      }
      return { payment: { ...payment }, order: { ...record.order } };
    },
    async loadPaymentByProviderPaymentId(providerPaymentId) {
      if (payment.provider_payment_id !== providerPaymentId) {
        return null;
      }
      return { payment: { ...payment }, order: { ...record.order } };
    },
    async markPaymentFailed(input) {
      if (input.paymentId !== payment.id) {
        return null;
      }
      payment = {
        ...payment,
        status: "failed",
        failure_reason: input.reason,
        updated_at: new Date().toISOString(),
      };
      return { ...payment };
    },
  };
  return { store, getPayment: () => payment, events };
}

const headers = {
  transmissionId: "tx-1",
  transmissionTime: "2026-09-22T12:00:00Z",
  transmissionSig: "sig",
  certUrl: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
  authAlgo: "SHA256withRSA",
};

void (async () => {
  const memory = createStore({ payment: paymentRow(), order: orderRow() });
  let captured = false;
  const completed = await handlePayPalWebhook(
    { rawBody: captureBody(), ...headers },
    {
      webhookId: "WHID_TEST",
      store: memory.store,
      verifySignature: async () => ({ ok: true, verificationStatus: "SUCCESS" }),
      capture: async (verified) => {
        captured = true;
        if (verified.outcome === "already_captured") {
          return {
            outcome: "already_captured",
            paymentId: PAYMENT_ID,
            orderId: ORDER_ID,
            orderReference: "SHU-TESTWEBHOOK01",
          };
        }
        return {
          outcome: "captured",
          paymentId: PAYMENT_ID,
          orderId: ORDER_ID,
          orderReference: "SHU-TESTWEBHOOK01",
        };
      },
    },
  );
  if (completed.status !== 200 || !captured) {
    throw new Error("CAPTURE.COMPLETED must verify, capture, and return 200.");
  }
  if (!memory.events.get(EVENT_ID)?.processed) {
    throw new Error("Successful webhook must mark event processed.");
  }

  const badSig = await handlePayPalWebhook(
    { rawBody: captureBody(), ...headers },
    {
      webhookId: "WHID_TEST",
      store: createStore({ payment: paymentRow(), order: orderRow() }).store,
      verifySignature: async () => ({ ok: false, error: "fail" }),
    },
  );
  if (badSig.status !== 400) {
    throw new Error("Failed signature must reject with 400.");
  }

  const missingId = await handlePayPalWebhook(
    { rawBody: captureBody(), ...headers },
    {
      store: createStore({ payment: paymentRow(), order: orderRow() }).store,
      verifySignature: async () => ({ ok: true, verificationStatus: "SUCCESS" }),
    },
  );
  if (missingId.status !== 503) {
    throw new Error("Missing PAYPAL_WEBHOOK_ID must be retryable 503 (never skip verify).");
  }

  let captureCalled = false;
  const approved = await handlePayPalWebhook(
    {
      rawBody: JSON.stringify({
        id: "WH-APPROVED",
        event_type: PAYPAL_CHECKOUT_ORDER_APPROVED,
        resource: { id: PROVIDER_ORDER },
      }),
      ...headers,
    },
    {
      webhookId: "WHID_TEST",
      store: createStore({ payment: paymentRow(), order: orderRow() }).store,
      verifySignature: async () => ({ ok: true, verificationStatus: "SUCCESS" }),
      capture: async () => {
        captureCalled = true;
        return {
          outcome: "captured",
          paymentId: PAYMENT_ID,
          orderId: ORDER_ID,
          orderReference: "x",
        };
      },
    },
  );
  if (approved.status !== 200 || captureCalled) {
    throw new Error("CHECKOUT.ORDER.APPROVED must never app-capture.");
  }

  const logs: string[] = [];
  const reversed = await handlePayPalWebhook(
    {
      rawBody: JSON.stringify({
        id: "WH-REVERSED",
        event_type: PAYPAL_CHECKOUT_PAYMENT_APPROVAL_REVERSED,
        resource: { id: PROVIDER_ORDER },
      }),
      ...headers,
    },
    {
      webhookId: "WHID_TEST",
      store: createStore({ payment: paymentRow(), order: orderRow() }).store,
      verifySignature: async () => ({ ok: true, verificationStatus: "SUCCESS" }),
      log: (message) => {
        logs.push(message);
      },
    },
  );
  if (reversed.status !== 200 || !logs.includes("paypal_checkout_payment_approval_reversed")) {
    throw new Error("PAYMENT-APPROVAL.REVERSED must log and ack without capture.");
  }

  const declinedMem = createStore({ payment: paymentRow(), order: orderRow() });
  const declined = await handlePayPalWebhook(
    { rawBody: captureBody(PAYPAL_PAYMENT_CAPTURE_DECLINED), ...headers },
    {
      webhookId: "WHID_TEST",
      store: declinedMem.store,
      verifySignature: async () => ({ ok: true, verificationStatus: "SUCCESS" }),
    },
  );
  if (declined.status !== 200 || declinedMem.getPayment().status !== "failed") {
    throw new Error("CAPTURE.DECLINED must mark unpaid payment failed.");
  }

  void captureVerifiedPayment;
  console.log("verify-payment-webhook: ok");
  console.log(
    "verify-payment-webhook: note — live postback to PayPal skipped; inject verifySignature in tests. Sandbox: set PAYPAL_WEBHOOK_ID and POST real Dashboard events to /api/webhooks/paypal.",
  );
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
