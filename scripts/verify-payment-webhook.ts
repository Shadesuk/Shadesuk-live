import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { captureVerifiedRazorpayPayment } from "../src/lib/payment/capture-verified";
import { handleRazorpayWebhook } from "../src/lib/payment/handle-webhook";
import type { PaymentCaptureStore } from "../src/lib/payment/capture-store";
import type {
  PaymentWebhookEventRow,
  RazorpayWebhookStore,
  WebhookPaymentRecord,
} from "../src/lib/payment/webhook-store";
import type { PaymentRow } from "../src/contracts/payment/schema";
import type { OrderItemRow, OrderRow } from "../src/contracts/order/schema";
import { verifyRazorpayWebhookSignature } from "../src/lib/razorpay/verify-webhook-signature";
import { razorpaySubunitToGbpMinor } from "../src/lib/razorpay/amount";

const root = resolve(process.cwd());
const SECRET = "test_razorpay_webhook_secret";

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

const PAYMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VARIANT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ITEM_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PROVIDER_ORDER = "order_webhook_1";
const PROVIDER_PAYMENT = "pay_webhook_1";
const EVENT_ID = "evt_webhook_1";

const serverFiles = [
  "src/lib/payment/handle-webhook.ts",
  "src/lib/payment/webhook-store.ts",
  "src/lib/razorpay/verify-webhook-signature.ts",
  "src/app/api/webhooks/razorpay/route.ts",
];
for (const file of serverFiles) {
  if (!existsSync(resolve(root, file))) {
    throw new Error(`Missing ${file}.`);
  }
  const source = read(file);
  if (file.endsWith("route.ts")) {
    if (!source.includes("export async function POST") || source.includes("export async function GET")) {
      throw new Error("Webhook route must expose POST only.");
    }
  } else if (!source.includes('import "server-only"')) {
    throw new Error(`${file} must be server-only.`);
  }
  if (source.includes("RAZORPAY_KEY_SECRET") && file.includes("route.ts")) {
    throw new Error("Webhook route must not mention the Razorpay key secret.");
  }
  if (source.includes("NEXT_PUBLIC_RAZORPAY") || source.includes("checkout.js")) {
    throw new Error(`${file} must not expose secrets or load Checkout.js.`);
  }
}

const handlerSource = read("src/lib/payment/handle-webhook.ts");
if (!handlerSource.includes("captureVerifiedRazorpayPayment")) {
  throw new Error("Webhook must reuse the existing capture writer.");
}
if (handlerSource.includes('status: "captured"') || handlerSource.includes("stock_quantity")) {
  throw new Error("Webhook must not implement a second capture or inventory writer.");
}
if (handlerSource.includes("dispatchOrderConfirmationEmail") || handlerSource.includes("@/lib/email")) {
  throw new Error("Webhook must not rebuild Resend.");
}
if (!handlerSource.includes("request.text") && !read("src/app/api/webhooks/razorpay/route.ts").includes("request.text()")) {
  throw new Error("Webhook route must read the raw request body.");
}
if (read("src/app/api/webhooks/razorpay/route.ts").includes("JSON.stringify") && read("src/app/api/webhooks/razorpay/route.ts").includes("verifyRazorpayWebhookSignature")) {
  throw new Error("Do not reconstruct JSON before verifying the webhook signature.");
}

if (!verifyRazorpayWebhookSignature({
  rawBody: '{"event":"payment.captured"}',
  signature: createHmac("sha256", SECRET).update('{"event":"payment.captured"}').digest("hex"),
  webhookSecret: SECRET,
})) {
  throw new Error("Valid webhook signature must verify against the raw body.");
}
if (verifyRazorpayWebhookSignature({
  rawBody: '{"event":"payment.captured"}',
  signature: createHmac("sha256", SECRET).update('{"event":"payment.other"}').digest("hex"),
  webhookSecret: SECRET,
})) {
  throw new Error("Invalid webhook signature must fail.");
}
if (razorpaySubunitToGbpMinor(5365, "GBP") !== 5365) {
  throw new Error("Webhook amounts must compare GBP subunits to persisted minor units.");
}

function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: PAYMENT_ID,
    order_id: ORDER_ID,
    provider: "razorpay",
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
    delivery_address: { first_name: "Ada" },
    created_at: "2026-09-22T12:00:00.000Z",
    updated_at: "2026-09-22T12:00:00.000Z",
    ...overrides,
  };
}

function itemRow(): OrderItemRow {
  return {
    id: ITEM_ID,
    order_id: ORDER_ID,
    product_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    product_variant_id: VARIANT_ID,
    sku: "FRAME-01-BLK",
    product_name: "Frame 01",
    colour_name: "Black",
    variant_name: null,
    quantity: 1,
    unit_price_minor: 4900,
    line_total_minor: 4900,
    product_snapshot: null,
    created_at: "2026-09-22T12:00:00.000Z",
  };
}

type MemoryState = {
  payment: PaymentRow | null;
  order: OrderRow;
  items: OrderItemRow[];
  stocks: Map<string, number>;
  events: Map<string, PaymentWebhookEventRow>;
  decrementCalls: number;
  convertCalls: number;
  captureWrites: number;
  hookCalls: number;
  insertCalls: number;
  markProcessedCalls: number;
};

function createMemory(overrides: Partial<Pick<MemoryState, "payment" | "order">> & { stock?: number } = {}) {
  const state: MemoryState = {
    payment: overrides.payment === undefined ? paymentRow() : overrides.payment,
    order: overrides.order ?? orderRow(),
    items: [itemRow()],
    stocks: new Map([[VARIANT_ID, overrides.stock ?? 4]]),
    events: new Map(),
    decrementCalls: 0,
    convertCalls: 0,
    captureWrites: 0,
    hookCalls: 0,
    insertCalls: 0,
    markProcessedCalls: 0,
  };

  const captureStore: PaymentCaptureStore = {
    async loadByPaymentId(id) {
      if (!state.payment || state.payment.id !== id) {
        return null;
      }
      return {
        payment: { ...state.payment },
        order: { ...state.order },
        items: state.items.map((item) => ({ ...item })),
      };
    },
    async capturePayment(input) {
      if (!state.payment || state.payment.id !== input.paymentId) {
        return null;
      }
      if (state.payment.status !== "created" && state.payment.status !== "authorized") {
        return null;
      }
      if (state.payment.captured_at) {
        return null;
      }
      state.captureWrites += 1;
      state.payment = {
        ...state.payment,
        status: "captured",
        captured_at: input.capturedAt,
        provider_payment_id: input.providerPaymentId,
        updated_at: input.capturedAt,
      };
      return { ...state.payment };
    },
    async markOrderPaymentCaptured(orderId) {
      if (state.order.id !== orderId) {
        return null;
      }
      state.order = {
        ...state.order,
        payment_status: "captured",
        updated_at: new Date().toISOString(),
      };
      return { ...state.order };
    },
    async loadVariantStock(variantIds) {
      const stocks = new Map<string, number>();
      for (const id of variantIds) {
        const stock = state.stocks.get(id);
        if (stock != null) {
          stocks.set(id, stock);
        }
      }
      return stocks;
    },
    async decrementVariantStock(input) {
      state.decrementCalls += 1;
      const current = state.stocks.get(input.variantId);
      if (current == null || current < input.quantity) {
        return false;
      }
      state.stocks.set(input.variantId, current - input.quantity);
      return true;
    },
    async convertActiveCheckoutCart() {
      state.convertCalls += 1;
      return "converted";
    },
  };

  const webhookStore: RazorpayWebhookStore = {
    async insertUnprocessedEvent(input) {
      state.insertCalls += 1;
      const existing = state.events.get(input.providerEventId);
      if (existing) {
        return { ...existing };
      }
      const created: PaymentWebhookEventRow = {
        id: `wh_${state.events.size + 1}`,
        provider: "razorpay",
        provider_event_id: input.providerEventId,
        event_type: input.eventType,
        payload: input.payload,
        processed: false,
        processed_at: null,
        created_at: "2026-09-22T14:00:00.000Z",
      };
      state.events.set(input.providerEventId, created);
      return { ...created };
    },
    async loadEvent(providerEventId) {
      const event = state.events.get(providerEventId);
      return event ? { ...event } : null;
    },
    async markEventProcessed(providerEventId) {
      state.markProcessedCalls += 1;
      const event = state.events.get(providerEventId);
      if (!event) {
        return null;
      }
      const processed = {
        ...event,
        processed: true,
        processed_at: "2026-09-22T14:05:00.000Z",
      };
      state.events.set(providerEventId, processed);
      return { ...processed };
    },
    async loadPaymentByProviderOrderId(providerOrderId) {
      return recordIfMatch(state, "provider_order_id", providerOrderId);
    },
    async loadPaymentByProviderPaymentId(providerPaymentId) {
      return recordIfMatch(state, "provider_payment_id", providerPaymentId);
    },
    async markPaymentFailed(input) {
      if (!state.payment || state.payment.id !== input.paymentId) {
        return null;
      }
      if (state.payment.status === "captured" || state.payment.captured_at) {
        return null;
      }
      state.payment = {
        ...state.payment,
        status: "failed",
        failure_reason: input.reason,
        updated_at: new Date().toISOString(),
      };
      return { ...state.payment };
    },
  };

  return { state, captureStore, webhookStore };
}

function recordIfMatch(
  state: MemoryState,
  column: "provider_order_id" | "provider_payment_id",
  value: string,
): WebhookPaymentRecord | null {
  if (!state.payment || state.payment[column] !== value) {
    return null;
  }
  return { payment: { ...state.payment }, order: { ...state.order } };
}

function webhookBody(overrides: {
  event?: string;
  eventId?: string;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  error?: string;
} = {}): string {
  return JSON.stringify({
    id: overrides.eventId ?? EVENT_ID,
    event: overrides.event ?? "payment.captured",
    created_at: 1758556800,
    payload: {
      payment: {
        entity: {
          id: overrides.paymentId ?? PROVIDER_PAYMENT,
          order_id: overrides.orderId ?? PROVIDER_ORDER,
          amount: overrides.amount ?? 5365,
          currency: overrides.currency ?? "GBP",
          status: overrides.event === "payment.failed" ? "failed" : "captured",
          error_description: overrides.error ?? null,
        },
      },
    },
  });
}

function sign(rawBody: string): string {
  return createHmac("sha256", SECRET).update(rawBody).digest("hex");
}

async function postWebhook(
  memory: ReturnType<typeof createMemory>,
  rawBody: string,
  signature = sign(rawBody),
  captureImpl?: typeof captureVerifiedRazorpayPayment,
) {
  return handleRazorpayWebhook(
    { rawBody, signature },
    {
      webhookSecret: SECRET,
      store: memory.webhookStore,
      capture: captureImpl ?? captureVerifiedRazorpayPayment,
      captureDependencies: {
        store: memory.captureStore,
        resolveCheckoutSessionId: async () => null,
        onVerifiedPaymentCaptured: async () => {
          memory.state.hookCalls += 1;
        },
      },
    },
  );
}

void (async () => {
  const captured = createMemory();
  const capturedBody = webhookBody();
  const capturedResult = await postWebhook(captured, capturedBody);
  if (capturedResult.status !== 200 || capturedResult.body.ok !== true) {
    throw new Error("Valid payment.captured must be acknowledged.");
  }
  if (captured.state.payment?.status !== "captured" || captured.state.order.payment_status !== "captured") {
    throw new Error("Valid payment.captured must go through the capture writer.");
  }
  if (captured.state.decrementCalls !== 1 || captured.state.hookCalls !== 1) {
    throw new Error("First captured webhook must decrement inventory and notify once.");
  }
  if (!captured.state.events.get(EVENT_ID)?.processed) {
    throw new Error("Successful captured webhook must mark the event processed.");
  }

  const invalid = createMemory();
  const invalidResult = await postWebhook(invalid, capturedBody, sign('{"tampered":true}'));
  if (invalidResult.status !== 400 || invalid.state.insertCalls !== 0 || invalid.state.captureWrites !== 0) {
    throw new Error("Invalid webhook signature must be rejected without processing.");
  }

  const duplicate = await postWebhook(captured, capturedBody);
  if (duplicate.status !== 200) {
    throw new Error("Duplicate webhook event must be acknowledged.");
  }
  if (captured.state.captureWrites !== 1 || captured.state.decrementCalls !== 1 || captured.state.hookCalls !== 1) {
    throw new Error("Duplicate webhook must not recapture, decrement, or notify.");
  }

  const twice = createMemory();
  const twiceBody = webhookBody({ eventId: "evt_twice" });
  const first = await postWebhook(twice, twiceBody);
  const second = await postWebhook(twice, twiceBody);
  if (first.status !== 200 || second.status !== 200) {
    throw new Error("The same event arriving twice must be acknowledged both times.");
  }
  if (twice.state.captureWrites !== 1 || twice.state.hookCalls !== 1 || twice.state.decrementCalls !== 1) {
    throw new Error("The same event arriving twice must perform the business transition once.");
  }

  const webhookFirst = createMemory();
  const webhookFirstResult = await postWebhook(webhookFirst, webhookBody({ eventId: "evt_before" }));
  if (webhookFirstResult.status !== 200 || webhookFirst.state.payment?.status !== "captured") {
    throw new Error("Webhook before frontend capture must capture the order.");
  }
  const frontendAfter = await captureVerifiedRazorpayPayment(
    {
      outcome: "verified",
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      orderReference: "SHU-TESTWEBHOOK01",
      providerOrderId: PROVIDER_ORDER,
      providerPaymentId: PROVIDER_PAYMENT,
      amountMinor: 5365,
      currency: "GBP",
      paymentStatus: "created",
      orderPaymentStatus: "created",
    },
    {
      store: webhookFirst.captureStore,
      resolveCheckoutSessionId: async () => null,
      onVerifiedPaymentCaptured: async () => {
        webhookFirst.state.hookCalls += 1;
      },
    },
  );
  if (frontendAfter.outcome !== "already_captured") {
    throw new Error("Frontend capture after webhook must see already_captured.");
  }
  if (webhookFirst.state.decrementCalls !== 1 || webhookFirst.state.hookCalls !== 1) {
    throw new Error("Webhook-first race must not double side effects.");
  }

  const frontendFirst = createMemory();
  const frontendCapture = await captureVerifiedRazorpayPayment(
    {
      outcome: "verified",
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      orderReference: "SHU-TESTWEBHOOK01",
      providerOrderId: PROVIDER_ORDER,
      providerPaymentId: PROVIDER_PAYMENT,
      amountMinor: 5365,
      currency: "GBP",
      paymentStatus: "created",
      orderPaymentStatus: "created",
    },
    {
      store: frontendFirst.captureStore,
      resolveCheckoutSessionId: async () => null,
      onVerifiedPaymentCaptured: async () => {
        frontendFirst.state.hookCalls += 1;
      },
    },
  );
  if (frontendCapture.outcome !== "captured") {
    throw new Error("Frontend capture must succeed before the later webhook.");
  }
  const webhookAfter = await postWebhook(frontendFirst, webhookBody({ eventId: "evt_after" }));
  if (webhookAfter.status !== 200 || frontendFirst.state.payment?.status !== "captured") {
    throw new Error("Webhook after frontend capture must acknowledge already-captured payment.");
  }
  if (frontendFirst.state.decrementCalls !== 1 || frontendFirst.state.hookCalls !== 1) {
    throw new Error("Webhook after frontend capture must not double-decrement or notify twice.");
  }

  const browserClose = createMemory();
  const recovered = await postWebhook(browserClose, webhookBody({ eventId: "evt_browser_close" }));
  if (recovered.status !== 200 || browserClose.state.payment?.status !== "captured") {
    throw new Error("Browser-close recovery must capture from the webhook alone.");
  }

  const wrongOrder = createMemory();
  const wrongOrderResult = await postWebhook(
    wrongOrder,
    webhookBody({ eventId: "evt_wrong_order", orderId: "order_other" }),
  );
  if (wrongOrderResult.status !== 503 || wrongOrder.state.payment?.status === "captured") {
    throw new Error("Wrong provider order ID must not capture.");
  }

  const wrongAmount = createMemory();
  const wrongAmountResult = await postWebhook(
    wrongAmount,
    webhookBody({ eventId: "evt_wrong_amount", amount: 100 }),
  );
  if (wrongAmountResult.status !== 400 || wrongAmount.state.payment?.status === "captured") {
    throw new Error("Wrong webhook amount must not capture.");
  }
  if (wrongAmount.state.events.get("evt_wrong_amount")?.processed) {
    throw new Error("Wrong amount must not mark the webhook event processed.");
  }

  const wrongCurrency = createMemory();
  const wrongCurrencyResult = await postWebhook(
    wrongCurrency,
    webhookBody({ eventId: "evt_wrong_currency", currency: "INR" }),
  );
  if (wrongCurrencyResult.status !== 400 || wrongCurrency.state.payment?.status === "captured") {
    throw new Error("Wrong currency must not capture.");
  }

  const unknown = createMemory({ payment: null });
  const unknownResult = await postWebhook(unknown, webhookBody({ eventId: "evt_unknown" }));
  if (unknownResult.status !== 503 || unknown.state.captureWrites !== 0) {
    throw new Error("Unknown payment must be retryable and must not capture.");
  }

  const failed = createMemory();
  const failedResult = await postWebhook(
    failed,
    webhookBody({ event: "payment.failed", eventId: "evt_failed", error: "card_declined" }),
  );
  if (failedResult.status !== 200 || failed.state.payment?.status !== "failed") {
    throw new Error("payment.failed must mark an eligible payment failed.");
  }
  if (failed.state.captureWrites !== 0 || failed.state.decrementCalls !== 0 || failed.state.hookCalls !== 0) {
    throw new Error("payment.failed must not capture, decrement, or email.");
  }
  if (failed.state.order.payment_status === "captured") {
    throw new Error("payment.failed must not mark the order captured.");
  }

  const failedThenCapture = await postWebhook(
    failed,
    webhookBody({ eventId: "evt_failed_then_capture" }),
  );
  if (failedThenCapture.status !== 503 || failed.state.payment?.status !== "failed") {
    throw new Error("Failed payment cannot become captured.");
  }

  const alreadyCaptured = createMemory({
    payment: paymentRow({
      status: "captured",
      captured_at: "2026-09-22T13:00:00.000Z",
      provider_payment_id: PROVIDER_PAYMENT,
    }),
    order: orderRow({ payment_status: "captured" }),
  });
  const failedAfterCapture = await postWebhook(
    alreadyCaptured,
    webhookBody({ event: "payment.failed", eventId: "evt_failed_after_capture" }),
  );
  if (failedAfterCapture.status !== 200 || alreadyCaptured.state.payment?.status !== "captured") {
    throw new Error("Already captured payment cannot be downgraded by a failed event.");
  }

  const processingFail = createMemory();
  const processingFailResult = await postWebhook(
    processingFail,
    webhookBody({ eventId: "evt_write_fail" }),
    sign(webhookBody({ eventId: "evt_write_fail" })),
    async () => {
      throw new Error("capture write failed");
    },
  );
  if (processingFailResult.status !== 503) {
    throw new Error("Failed processing must be retryable.");
  }
  if (processingFail.state.events.get("evt_write_fail")?.processed) {
    throw new Error("Failed processing must not mark the webhook event processed.");
  }
  if (processingFail.state.markProcessedCalls !== 0) {
    throw new Error("Failed processing must not call markEventProcessed.");
  }

  if (read("src/lib/payment/capture-verified.ts").includes("handleRazorpayWebhook")) {
    throw new Error("Capture writer must stay independent of the webhook route.");
  }

  console.log("verify-payment-webhook: ok");
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
