import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { captureVerifiedRazorpayPayment } from "../src/lib/payment/capture-verified";
import type { PaymentCaptureStore } from "../src/lib/payment/capture-store";
import type { PaymentRow } from "../src/contracts/payment/schema";
import type { OrderItemRow, OrderRow } from "../src/contracts/order/schema";
import type { VerifyCheckoutResult } from "../src/lib/payment/verify-checkout";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

const PAYMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VARIANT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ITEM_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PROVIDER_ORDER = "order_capture_1";
const PROVIDER_PAYMENT = "pay_capture_1";

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
  if (source.includes("RAZORPAY_KEY_SECRET") || source.includes("checkout.js")) {
    throw new Error(`${file} must not verify signatures or load Checkout.js.`);
  }
}

const captureSource = read("src/lib/payment/capture-verified.ts");
if (captureSource.includes("verifyRazorpayCheckoutSignature") || captureSource.includes("razorpaySignature")) {
  throw new Error("Capture writer must not perform Checkout signature verification.");
}
if (captureSource.includes("dispatchOrderConfirmationEmail") || captureSource.includes("@/lib/email")) {
  throw new Error("Capture writer must not rebuild Resend.");
}
if (!captureSource.includes("onVerifiedPaymentCaptured")) {
  throw new Error("Capture writer must call the PR #46 capture hook after commit.");
}

const afterCaptured = read("src/lib/payment/after-captured.ts");
if (!afterCaptured.includes("dispatchOrderConfirmationEmail(orderId)")) {
  throw new Error("onVerifiedPaymentCaptured must call the PR #46 dispatcher.");
}
if (afterCaptured.includes("new Resend") || afterCaptured.includes("from \"resend\"")) {
  throw new Error("The capture hook must not construct Resend directly.");
}

const paymentActions = read("src/app/(storefront)/checkout/payment-actions.ts");
if (!paymentActions.includes("captureVerifiedRazorpayPayment")) {
  throw new Error("Verified Checkout callbacks must pass through the capture writer.");
}
if (paymentActions.includes("captureVerifiedRazorpayPayment({") && paymentActions.includes("razorpaySignature")) {
  const capturesRaw =
    /captureVerifiedRazorpayPayment\(\{\s*paymentId: input/.test(paymentActions);
  if (capturesRaw) {
    throw new Error("Capture writer must not receive raw client callback data.");
  }
}

const verifySource = read("src/lib/payment/verify-checkout.ts");
if (verifySource.includes("captureVerifiedRazorpayPayment") || verifySource.includes("stock_quantity")) {
  throw new Error("Verification must stay separate from capture and inventory.");
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
  overrides: Partial<Extract<VerifyCheckoutResult, { outcome: "verified" }>> = {},
): Extract<VerifyCheckoutResult, { outcome: "verified" }> {
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
  input: ServerVerifiedInput,
  hook?: { calls: number; fail?: boolean },
) {
  return captureVerifiedRazorpayPayment(input, {
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

type ServerVerifiedInput = Parameters<typeof captureVerifiedRazorpayPayment>[0];

void (async () => {
  const created = createMemory();
  const createdHook = { calls: 0 };
  const createdResult = await captureWith(created, verifiedInput(), createdHook);
  if (createdResult.outcome !== "captured") {
    throw new Error("created payment must capture.");
  }
  if (created.state.payment.status !== "captured" || !created.state.payment.captured_at) {
    throw new Error("First capture must persist payments.status=captured and captured_at.");
  }
  if (created.state.payment.provider_payment_id !== PROVIDER_PAYMENT) {
    throw new Error("First capture must persist the verified Razorpay payment id.");
  }
  if (created.state.order.payment_status !== "captured" || created.state.order.status !== "placed") {
    throw new Error("Order payment_status must become captured without changing fulfilment status.");
  }
  if (created.state.stocks.get(VARIANT_ID) !== 3 || created.state.decrementCalls !== 1) {
    throw new Error("First capture must decrement product_variants.stock_quantity once.");
  }
  if (created.state.cartStatus !== "converted" || created.state.convertCalls !== 1) {
    throw new Error("First capture must convert the active checkout cart once.");
  }
  if (createdHook.calls !== 1) {
    throw new Error("Successful capture must invoke onVerifiedPaymentCaptured exactly once.");
  }

  const authorized = createMemory({
    payment: paymentRow({ status: "authorized" }),
    order: orderRow({ payment_status: "authorized" }),
  });
  const authorizedResult = await captureWith(
    authorized,
    verifiedInput({ paymentStatus: "authorized", orderPaymentStatus: "authorized" }),
    { calls: 0 },
  );
  if (authorizedResult.outcome !== "captured" || authorized.state.payment.status !== "captured") {
    throw new Error("authorized payment must capture.");
  }

  const repeat = await captureWith(created, verifiedInput(), createdHook);
  if (repeat.outcome !== "already_captured") {
    throw new Error("Repeated capture must return already_captured.");
  }
  if (created.state.captureWrites !== 1) {
    throw new Error("Repeated capture must not write captured again.");
  }
  if (created.state.decrementCalls !== 1) {
    throw new Error("Captured payment must not decrement inventory twice.");
  }
  if (created.state.convertCalls !== 1) {
    throw new Error("Captured payment must not convert the cart twice.");
  }
  if (createdHook.calls !== 1) {
    throw new Error("already_captured must not invoke onVerifiedPaymentCaptured again.");
  }

  const failed = await captureWith(
    createMemory({ payment: paymentRow({ status: "failed" }), order: orderRow({ payment_status: "failed" }) }),
    verifiedInput(),
  );
  if (failed.outcome !== "rejected" || failed.reason !== "payment_failed") {
    throw new Error("failed payment cannot capture.");
  }

  const cancelled = await captureWith(
    createMemory({
      payment: paymentRow({ status: "cancelled" }),
      order: orderRow({ payment_status: "cancelled" }),
    }),
    verifiedInput(),
  );
  if (cancelled.outcome !== "rejected" || cancelled.reason !== "payment_cancelled") {
    throw new Error("cancelled payment cannot capture.");
  }

  const wrongPaymentId = await captureWith(
    createMemory({ payment: paymentRow({ provider_payment_id: "pay_other" }) }),
    verifiedInput(),
  );
  if (wrongPaymentId.outcome !== "rejected" || wrongPaymentId.reason !== "provider_payment_mismatch") {
    throw new Error("Wrong provider payment ID must be rejected.");
  }

  const wrongOrderId = await captureWith(createMemory(), verifiedInput({ providerOrderId: "order_other" }));
  if (wrongOrderId.outcome !== "rejected" || wrongOrderId.reason !== "provider_order_mismatch") {
    throw new Error("Wrong provider order ID must be rejected.");
  }

  const emailFail = createMemory();
  const emailHook = { calls: 0, fail: true };
  const emailResult = await captureWith(emailFail, verifiedInput(), emailHook);
  if (emailResult.outcome !== "captured") {
    throw new Error("Email hook failure must not make payment appear uncaptured.");
  }
  if (emailFail.state.payment.status !== "captured" || emailFail.state.order.payment_status !== "captured") {
    throw new Error("Email hook failure must leave payment and order captured.");
  }
  if (emailHook.calls !== 1) {
    throw new Error("Email hook must still be invoked after a successful capture commit.");
  }

  const clientAmount = createMemory();
  const clientResult = await captureWith(
    clientAmount,
    {
      ...verifiedInput(),
      amountMinor: 1,
      currency: "GBP",
    },
  );
  if (clientResult.outcome !== "captured") {
    throw new Error("Client amount must not prevent capture of the persisted payment.");
  }
  if (clientAmount.state.payment.amount_minor !== 5365 || clientAmount.state.payment.status !== "captured") {
    throw new Error("Client amount cannot influence capture; persisted amount_minor stays authoritative.");
  }

  const insufficient = await captureWith(createMemory({ stock: 0 }), verifiedInput());
  if (insufficient.outcome !== "rejected" || insufficient.reason !== "inventory_insufficient") {
    throw new Error("Insufficient inventory must reject before capture.");
  }

  const missingItems = await captureWith(createMemory({ items: [] }), verifiedInput());
  if (missingItems.outcome !== "rejected" || missingItems.reason !== "missing_order_items") {
    throw new Error("Missing order items must reject capture.");
  }

  const missingPayment = await captureVerifiedRazorpayPayment(verifiedInput(), {
    store: {
      ...createMemory().store,
      async loadByPaymentId() {
        return null;
      },
    },
    resolveCheckoutSessionId: async () => null,
    onVerifiedPaymentCaptured: async () => {
      throw new Error("missing payment must not notify.");
    },
  });
  if (missingPayment.outcome !== "rejected" || missingPayment.reason !== "unknown_payment") {
    throw new Error("Missing payment must reject capture.");
  }

  console.log("verify-payment-capture: ok");
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
