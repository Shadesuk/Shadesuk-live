/**
 * In-memory capture writer tests for PayPal provider lock.
 * No live PayPal network calls.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { captureVerifiedPayment } from "../src/lib/payment/capture-verified";
import type { PaymentCaptureStore } from "../src/lib/payment/capture-store";
import type { PaymentRow } from "../src/contracts/payment/schema";
import type { OrderItemRow, OrderRow } from "../src/contracts/order/schema";
import type { VerifyPayPalClientReturnResult } from "../src/lib/paypal/verify-client-return";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

const PAYMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VARIANT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ITEM_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PROVIDER_ORDER = "5O190127TN364715T";
const PROVIDER_PAYMENT = "8MC585209K746392H";

const serverFiles = [
  "src/lib/payment/capture-verified.ts",
  "src/lib/payment/capture-store.ts",
  "src/lib/payment/after-captured.ts",
];
for (const file of serverFiles) {
  if (!existsSync(resolve(root, file))) {
    throw new Error(`Missing ${file}.`);
  }
  const source = read(file);
  if (!source.includes('import "server-only"')) {
    throw new Error(`${file} must be server-only.`);
  }
  if (
    source.includes("PAYPAL_CLIENT_SECRET") ||
    source.toLowerCase().includes("checkout.js") ||
    source.includes("razorpay")
  ) {
    throw new Error(`${file} must not verify provider signatures or load Checkout.js/Razorpay.`);
  }
}

const captureSource = read("src/lib/payment/capture-verified.ts");
if (!captureSource.includes("captureVerifiedPayment") || !captureSource.includes("PAYMENT_PROVIDER_PAYPAL")) {
  throw new Error("Capture writer must be provider-neutral and lock on paypal.");
}
if (!captureSource.includes("onVerifiedPaymentCaptured")) {
  throw new Error("Capture writer must call the capture hook after commit.");
}
if (captureSource.includes("dispatchOrderConfirmationEmail") || captureSource.includes("@/lib/email")) {
  throw new Error("Capture writer must not rebuild Resend.");
}

const storeSource = read("src/lib/payment/capture-store.ts");
if (!storeSource.includes('PAYMENT_PROVIDER_PAYPAL') || !storeSource.includes('eq("provider"')) {
  throw new Error("Capture store must filter provider=paypal.");
}

const paymentActions = read("src/app/(storefront)/checkout/payment-actions.ts");
if (!paymentActions.includes("captureVerifiedPayment") || !paymentActions.includes("verifyPayPalClientReturn")) {
  throw new Error("Verified PayPal callbacks must pass through verify then capture writer.");
}

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
    order_reference: "SHU-TESTCAPTURE01",
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
    delivery_address: { first_name: "Ada", last_name: "Lovelace" },
    created_at: "2026-09-22T12:00:00.000Z",
    updated_at: "2026-09-22T12:00:00.000Z",
    ...overrides,
  };
}

function itemRow(overrides: Partial<OrderItemRow> = {}): OrderItemRow {
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
    ...overrides,
  };
}

function verifiedInput(
  overrides: Partial<Extract<VerifyPayPalClientReturnResult, { outcome: "verified" }>> = {},
): Extract<VerifyPayPalClientReturnResult, { outcome: "verified" }> {
  return {
    outcome: "verified",
    paymentId: PAYMENT_ID,
    orderId: ORDER_ID,
    orderReference: "SHU-TESTCAPTURE01",
    providerOrderId: PROVIDER_ORDER,
    providerPaymentId: PROVIDER_PAYMENT,
    amountMinor: 5365,
    currency: "GBP",
    paymentStatus: "created",
    orderPaymentStatus: "created",
    ...overrides,
  };
}

type MemoryState = {
  payment: PaymentRow;
  order: OrderRow;
  items: OrderItemRow[];
  stocks: Map<string, number>;
  cartStatus: "active" | "converted" | "missing";
  decrementCalls: number;
  convertCalls: number;
  captureWrites: number;
};

function createMemory(overrides: Partial<Omit<MemoryState, "stocks">> & { stock?: number } = {}) {
  const { stock, ...rest } = overrides;
  const state: MemoryState = {
    payment: paymentRow(),
    order: orderRow(),
    items: [itemRow()],
    stocks: new Map([[VARIANT_ID, stock ?? 4]]),
    cartStatus: "active",
    decrementCalls: 0,
    convertCalls: 0,
    captureWrites: 0,
    ...rest,
  };

  const store: PaymentCaptureStore = {
    async loadByPaymentId(id) {
      if (state.payment.id !== id) {
        return null;
      }
      return {
        payment: { ...state.payment },
        order: { ...state.order },
        items: state.items.map((item) => ({ ...item })),
      };
    },
    async capturePayment(input) {
      if (state.payment.id !== input.paymentId) {
        return null;
      }
      if (state.payment.status !== "created" && state.payment.status !== "authorized") {
        return null;
      }
      if (state.payment.captured_at) {
        return null;
      }
      if (state.payment.provider_order_id !== input.providerOrderId) {
        return null;
      }
      if (
        state.payment.provider_payment_id &&
        state.payment.provider_payment_id !== input.providerPaymentId
      ) {
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
      if (state.order.payment_status !== "created" && state.order.payment_status !== "authorized") {
        return { ...state.order };
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
        const value = state.stocks.get(id);
        if (value != null) {
          stocks.set(id, value);
        }
      }
      return stocks;
    },
    async decrementVariantStock(input) {
      state.decrementCalls += 1;
      const current = state.stocks.get(input.variantId);
      if (current == null || current !== input.expectedStock || current < input.quantity) {
        return false;
      }
      state.stocks.set(input.variantId, current - input.quantity);
      return true;
    },
    async convertActiveCheckoutCart() {
      state.convertCalls += 1;
      if (state.cartStatus === "missing") {
        return "missing";
      }
      if (state.cartStatus === "converted") {
        return "already_converted";
      }
      state.cartStatus = "converted";
      return "converted";
    },
  };

  return { state, store };
}

async function captureWith(
  memory: ReturnType<typeof createMemory>,
  input: Parameters<typeof captureVerifiedPayment>[0],
  hook?: { calls: number; fail?: boolean },
) {
  return captureVerifiedPayment(input, {
    store: memory.store,
    resolveCheckoutSessionId: async () => "guest-session-capture",
    onVerifiedPaymentCaptured: async () => {
      if (hook) {
        hook.calls += 1;
        if (hook.fail) {
          throw new Error("email dispatch failed");
        }
      }
    },
  });
}

void (async () => {
  const created = createMemory();
  const createdHook = { calls: 0 };
  const createdResult = await captureWith(created, verifiedInput(), createdHook);
  if (createdResult.outcome !== "captured") {
    throw new Error("created payment must capture.");
  }
  if (created.state.payment.provider_payment_id !== PROVIDER_PAYMENT) {
    throw new Error("First capture must persist the PayPal capture id.");
  }
  if (created.state.order.payment_status !== "captured") {
    throw new Error("Order payment_status must become captured.");
  }
  if (created.state.stocks.get(VARIANT_ID) !== 3 || created.state.decrementCalls !== 1) {
    throw new Error("First capture must decrement stock once.");
  }
  if (createdHook.calls !== 1) {
    throw new Error("Successful capture must invoke onVerifiedPaymentCaptured once.");
  }

  const repeat = await captureWith(created, verifiedInput(), createdHook);
  if (repeat.outcome !== "already_captured" || created.state.captureWrites !== 1 || createdHook.calls !== 1) {
    throw new Error("Repeated capture must return already_captured without rewriting.");
  }

  const concurrent = createMemory();
  const concurrentHook = { calls: 0 };
  let loads = 0;
  const loadCreated = concurrent.store.loadByPaymentId.bind(concurrent.store);
  concurrent.store.loadByPaymentId = async (id) => {
    loads += 1;
    return loadCreated(id);
  };
  concurrent.store.capturePayment = async () => {
    concurrent.state.payment = {
      ...concurrent.state.payment,
      status: "captured",
      captured_at: new Date().toISOString(),
      provider_payment_id: PROVIDER_PAYMENT,
    };
    concurrent.state.order = {
      ...concurrent.state.order,
      payment_status: "captured",
    };
    return null;
  };
  const duplicate = await captureWith(concurrent, verifiedInput(), concurrentHook);
  if (
    duplicate.outcome !== "already_captured" ||
    concurrentHook.calls !== 0 ||
    concurrent.state.decrementCalls !== 0 ||
    loads < 2
  ) {
    throw new Error("A concurrent duplicate capture must return already_captured without a second email.");
  }

  const wrongProvider = await captureWith(
    createMemory({ payment: paymentRow({ provider: "razorpay" }) }),
    verifiedInput(),
  );
  if (wrongProvider.outcome !== "rejected" || wrongProvider.reason !== "provider_mismatch") {
    throw new Error("Non-paypal provider rows must reject (historical razorpay untouched).");
  }

  const insufficient = await captureWith(createMemory({ stock: 0 }), verifiedInput());
  if (insufficient.outcome !== "rejected" || insufficient.reason !== "inventory_insufficient") {
    throw new Error("Insufficient inventory must reject before capture.");
  }

  console.log("verify-payment-capture: ok");
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
