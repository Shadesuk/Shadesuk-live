/**
 * Static + in-memory PayPal client-return verify checks.
 * Does not call live PayPal APIs (no sandbox credentials required).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyPayPalClientReturn } from "../src/lib/paypal/verify-client-return";
import type { PaymentVerificationStore } from "../src/lib/payment/verification-store";
import type { PaymentRow } from "../src/contracts/payment/schema";
import type { OrderRow } from "../src/contracts/order/schema";
import { gbpMinorToPayPalValue, payPalValueToGbpMinor } from "../src/lib/paypal/amount";
import { isAlreadyCapturedError } from "../src/lib/paypal/capture-order";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (gbpMinorToPayPalValue(5365) !== "53.65") {
  throw new Error("GBP pence must format to two-decimal Money value.");
}
if (payPalValueToGbpMinor("53.65", "GBP") !== 5365) {
  throw new Error("PayPal Money value must parse to GBP pence.");
}
if (payPalValueToGbpMinor(53.65, "GBP") !== null) {
  throw new Error("Must not convert PayPal amounts through floats.");
}
if (payPalValueToGbpMinor("53.65", "USD") !== null) {
  throw new Error("Non-GBP PayPal amounts must be rejected.");
}

// PR Review HIGH: only documented issue ORDER_ALREADY_CAPTURED — never bare 422/409.
if (
  !isAlreadyCapturedError({
    name: "UNPROCESSABLE_ENTITY",
    details: [{ issue: "ORDER_ALREADY_CAPTURED", description: "Order already captured." }],
  })
) {
  throw new Error("ORDER_ALREADY_CAPTURED details.issue must mark already-captured.");
}
if (
  isAlreadyCapturedError({
    name: "UNPROCESSABLE_ENTITY",
    details: [{ issue: "CARD_EXPIRED", description: "The card is expired." }],
  }) ||
  isAlreadyCapturedError({
    name: "UNPROCESSABLE_ENTITY",
    details: [{ issue: "ORDER_NOT_APPROVED" }],
  }) ||
  isAlreadyCapturedError({ name: "UNPROCESSABLE_ENTITY", details: [] }) ||
  isAlreadyCapturedError(null)
) {
  throw new Error("Non-capture 422 bodies must not take the already-captured GET path.");
}
const captureSource = read("src/lib/paypal/capture-order.ts");
if (
  captureSource.includes("status === 422") ||
  captureSource.includes("status === 409") ||
  /status\s*===\s*422/.test(captureSource)
) {
  throw new Error("isAlreadyCapturedError must not blanket-match HTTP 422/409.");
}

const serverFiles = [
  "src/lib/paypal/verify-client-return.ts",
  "src/lib/paypal/capture-order.ts",
  "src/lib/paypal/fetch-order.ts",
  "src/lib/payment/verification-store.ts",
  "src/app/(storefront)/checkout/payment-actions.ts",
];
for (const file of serverFiles) {
  if (!existsSync(resolve(root, file))) {
    throw new Error(`Missing ${file}.`);
  }
  const source = read(file);
  if (!source.includes('import "server-only"') && !source.includes('"use server"')) {
    throw new Error(`${file} must be server-only.`);
  }
  if (
    source.includes("NEXT_PUBLIC_PAYPAL_CLIENT_SECRET") ||
    source.toLowerCase().includes("checkout.js") ||
    source.includes("@razorpay")
  ) {
    throw new Error(`${file} must not expose secrets or load Checkout.js/Razorpay.`);
  }
  if (source.includes('status: "captured"') && file.includes("verify-client-return")) {
    throw new Error("Client-return verify must not write captured status.");
  }
}

const verifySource = read("src/lib/paypal/verify-client-return.ts");
if (!verifySource.includes("capturePayPalOrder") || !verifySource.includes("fetchPayPalOrder")) {
  throw new Error("Client-return must server Capture then GET-reconcile if already captured.");
}
if (verifySource.includes("stock_quantity") || verifySource.includes('payment_status: "captured"')) {
  throw new Error("Verification must not capture app state or decrement inventory.");
}

const openButtons = read("src/lib/paypal/open-buttons.ts");
if (!openButtons.includes("web-sdk/v6/core") || !openButtons.includes("createInstance")) {
  throw new Error("Buttons helper must load PayPal JS SDK v6 core and createInstance.");
}
if (!openButtons.includes("orderId: providerOrderId") && !openButtons.includes("orderId:providerOrderId")) {
  if (!openButtons.includes("Promise.resolve({ orderId: providerOrderId })")) {
    throw new Error("Buttons createOrder must return the already-created provider order id.");
  }
}
if (
  /\bprocess\.env\.PAYPAL_CLIENT_SECRET\b/.test(openButtons) ||
  /\bPAYPAL_CLIENT_SECRET\s*=/.test(openButtons) ||
  openButtons.includes("amountMinor")
) {
  throw new Error("Buttons helper must not include secrets or invent client amounts.");
}

const PAYMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROVIDER_ORDER = "5O190127TN364715T";
const PROVIDER_PAYMENT = "8MC585209K746392H";

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
    order_reference: "SHU-TESTVERIFY01",
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

function createStore(payment: PaymentRow, order: OrderRow): PaymentVerificationStore {
  let attached: string | null = payment.provider_payment_id;
  return {
    async loadByPaymentId(paymentId) {
      if (paymentId !== payment.id) {
        return null;
      }
      return {
        payment: { ...payment, provider_payment_id: attached },
        order,
      };
    },
    async attachProviderPaymentId(paymentId, providerPaymentId) {
      if (paymentId !== payment.id) {
        return null;
      }
      attached = providerPaymentId;
      return { ...payment, provider_payment_id: attached };
    },
  };
}

void (async () => {
  const ok = await verifyPayPalClientReturn(
    { paymentId: PAYMENT_ID, paypalOrderId: PROVIDER_ORDER },
    {
      store: createStore(paymentRow(), orderRow()),
      captureOrder: async () => ({
        ok: true,
        capture: {
          providerOrderId: PROVIDER_ORDER,
          providerPaymentId: PROVIDER_PAYMENT,
          amountMinor: 5365,
          currency: "GBP",
          providerStatus: "COMPLETED",
          captureStatus: "COMPLETED",
        },
      }),
      fetchOrder: async () => {
        throw new Error("fetch should not run on successful capture");
      },
    },
  );
  if (ok.outcome !== "verified" || ok.providerPaymentId !== PROVIDER_PAYMENT) {
    throw new Error("Successful Capture must verify with capture id.");
  }

  const already = await verifyPayPalClientReturn(
    { paymentId: PAYMENT_ID, paypalOrderId: PROVIDER_ORDER },
    {
      store: createStore(paymentRow(), orderRow()),
      captureOrder: async () => ({
        ok: false,
        error: "ORDER_ALREADY_CAPTURED",
        alreadyCaptured: true,
      }),
      fetchOrder: async () => ({
        ok: true,
        order: {
          providerOrderId: PROVIDER_ORDER,
          providerStatus: "COMPLETED",
          amountMinor: 5365,
          currency: "GBP",
          customId: PAYMENT_ID,
          invoiceId: "SHU-TESTVERIFY01",
          providerPaymentId: PROVIDER_PAYMENT,
          captureStatus: "COMPLETED",
        },
      }),
    },
  );
  if (already.outcome !== "verified") {
    throw new Error("Already-captured PayPal order must GET-reconcile to verified.");
  }

  const mismatch = await verifyPayPalClientReturn(
    { paymentId: PAYMENT_ID, paypalOrderId: PROVIDER_ORDER },
    {
      store: createStore(paymentRow(), orderRow()),
      captureOrder: async () => ({
        ok: true,
        capture: {
          providerOrderId: PROVIDER_ORDER,
          providerPaymentId: PROVIDER_PAYMENT,
          amountMinor: 9999,
          currency: "GBP",
          providerStatus: "COMPLETED",
          captureStatus: "COMPLETED",
        },
      }),
    },
  );
  if (mismatch.outcome !== "rejected" || mismatch.reason !== "amount_mismatch") {
    throw new Error("Amount mismatch must reject before app capture.");
  }

  const wrongOrder = await verifyPayPalClientReturn(
    { paymentId: PAYMENT_ID, paypalOrderId: "OTHER_ORDER" },
    { store: createStore(paymentRow(), orderRow()) },
  );
  if (wrongOrder.outcome !== "rejected" || wrongOrder.reason !== "provider_order_mismatch") {
    throw new Error("Mismatched PayPal order id must reject.");
  }

  console.log("verify-payment-verification: ok");
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
