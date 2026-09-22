import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyRazorpayCheckoutPayment } from "../src/lib/payment/verify-checkout";
import type { PaymentVerificationStore } from "../src/lib/payment/verification-store";
import type { PaymentRow } from "../src/contracts/payment/schema";
import type { OrderRow } from "../src/contracts/order/schema";
import type { FetchedRazorpayPayment } from "../src/lib/razorpay/fetch-payment";
import { razorpaySubunitToGbpMinor } from "../src/lib/razorpay/amount";
import { verifyRazorpayCheckoutSignature } from "../src/lib/razorpay/verify-signature";

const root = resolve(process.cwd());
const SECRET = "test_razorpay_key_secret";

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function sign(orderId: string, paymentId: string): string {
  return createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

if (razorpaySubunitToGbpMinor(5365, "GBP") !== 5365) {
  throw new Error("GBP Razorpay subunits must equal application minor units.");
}
if (razorpaySubunitToGbpMinor(53.65, "GBP") !== null) {
  throw new Error("Must not convert Razorpay amounts through floats.");
}
if (razorpaySubunitToGbpMinor(5365, "USD") !== null) {
  throw new Error("Non-GBP Razorpay amounts must be rejected.");
}

if (!verifyRazorpayCheckoutSignature({
  providerOrderId: "order_abc",
  providerPaymentId: "pay_abc",
  signature: sign("order_abc", "pay_abc"),
  keySecret: SECRET,
})) {
  throw new Error("Valid Checkout signature must verify.");
}
if (verifyRazorpayCheckoutSignature({
  providerOrderId: "order_abc",
  providerPaymentId: "pay_abc",
  signature: sign("order_abc", "pay_other"),
  keySecret: SECRET,
})) {
  throw new Error("Invalid Checkout signature must fail.");
}

const serverFiles = [
  "src/lib/payment/verify-checkout.ts",
  "src/lib/payment/verification-store.ts",
  "src/lib/razorpay/verify-signature.ts",
  "src/lib/razorpay/fetch-payment.ts",
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
  if (source.includes("NEXT_PUBLIC_RAZORPAY_KEY_SECRET") || source.includes("checkout.js")) {
    throw new Error(`${file} must not expose secrets or load Checkout.js.`);
  }
  if (source.includes('status: "captured"') && file.includes("verify-checkout")) {
    throw new Error("Verification must not write captured status.");
  }
}

const verifySource = read("src/lib/payment/verify-checkout.ts");
if (verifySource.includes("payment_status: \"captured\"") || verifySource.includes("stock_quantity")) {
  throw new Error("Verification must not capture or decrement inventory.");
}

const clientCheckout = read("src/lib/razorpay/open-checkout.ts");
if (!clientCheckout.includes("RAZORPAY_CHECKOUT_SCRIPT_SRC") || !clientCheckout.includes("order_id")) {
  throw new Error("Client Checkout helper must load official checkout.js and pass order_id.");
}
if (clientCheckout.includes("amount") && /amount\s*:/.test(clientCheckout)) {
  throw new Error("Client Checkout must not send a browser-calculated amount.");
}
if (clientCheckout.includes("RAZORPAY_KEY_SECRET")) {
  throw new Error("Checkout.js helper must not include the Razorpay secret.");
}

const PAYMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_PAYMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORDER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_ORDER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PROVIDER_ORDER = "order_foundation_1";
const PROVIDER_PAYMENT = "pay_foundation_1";

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

function fetched(overrides: Partial<FetchedRazorpayPayment> = {}): FetchedRazorpayPayment {
  return {
    providerPaymentId: PROVIDER_PAYMENT,
    providerOrderId: PROVIDER_ORDER,
    amountMinor: 5365,
    currency: "GBP",
    providerStatus: "authorized",
    ...overrides,
  };
}

function storeFor(record: { payment: PaymentRow; order: OrderRow } | null): PaymentVerificationStore {
  return {
    async loadByPaymentId(id) {
      if (!record || record.payment.id !== id) {
        return null;
      }
      return record;
    },
    async attachProviderPaymentId(id, providerPaymentId) {
      if (!record || record.payment.id !== id) {
        return null;
      }
      return { ...record.payment, provider_payment_id: providerPaymentId };
    },
  };
}

const validInput = {
  paymentId: PAYMENT_ID,
  razorpayPaymentId: PROVIDER_PAYMENT,
  razorpayOrderId: PROVIDER_ORDER,
  razorpaySignature: sign(PROVIDER_ORDER, PROVIDER_PAYMENT),
  amountMinor: 1,
  currency: "USD",
  total: 99,
  totalMinor: 1,
};

async function verifyWith(
  record: { payment: PaymentRow; order: OrderRow } | null,
  input = validInput,
  provider = fetched(),
) {
  return verifyRazorpayCheckoutPayment(input, {
    store: storeFor(record),
    keySecret: SECRET,
    fetchProviderPayment: async () => ({ ok: true, payment: provider }),
  });
}

void (async () => {
  const valid = await verifyWith({ payment: paymentRow(), order: orderRow() });
  if (valid.outcome !== "verified") {
    throw new Error("Valid signature and matching persisted amount must verify.");
  }
  if (valid.paymentStatus !== "created" || valid.orderPaymentStatus !== "created" || valid.amountMinor !== 5365) {
    throw new Error("Verified result must stay uncaptured and use persisted amount_minor.");
  }

  const badSig = await verifyWith({ payment: paymentRow(), order: orderRow() }, {
    ...validInput,
    razorpaySignature: sign(PROVIDER_ORDER, "pay_other"),
  });
  if (badSig.outcome !== "rejected" || badSig.reason !== "invalid_signature") {
    throw new Error("Invalid signature must be rejected.");
  }

  const wrongOrder = await verifyWith({ payment: paymentRow(), order: orderRow() }, {
    ...validInput,
    razorpayOrderId: "order_other",
    razorpaySignature: sign("order_other", PROVIDER_PAYMENT),
  });
  if (wrongOrder.outcome !== "rejected" || wrongOrder.reason !== "provider_order_mismatch") {
    throw new Error("Wrong Razorpay order id must be rejected.");
  }

  const wrongAmount = await verifyWith(
    { payment: paymentRow(), order: orderRow() },
    validInput,
    fetched({ amountMinor: 100 }),
  );
  if (wrongAmount.outcome !== "rejected" || wrongAmount.reason !== "amount_mismatch") {
    throw new Error("Provider amount must be compared to persisted payments.amount_minor.");
  }

  const wrongCurrency = await verifyWith(
    { payment: paymentRow(), order: orderRow() },
    validInput,
    { ...fetched(), currency: "INR" } as unknown as FetchedRazorpayPayment,
  );
  if (wrongCurrency.outcome !== "rejected" || wrongCurrency.reason !== "currency_mismatch") {
    throw new Error("Wrong currency must be rejected.");
  }

  const unknown = await verifyWith(null);
  if (unknown.outcome !== "rejected" || unknown.reason !== "unknown_payment") {
    throw new Error("Unknown internal payment must be rejected.");
  }

  const otherOrder = await verifyWith({
    payment: paymentRow({ order_id: OTHER_ORDER_ID }),
    order: orderRow(),
  });
  if (otherOrder.outcome !== "rejected" || otherOrder.reason !== "order_mismatch") {
    throw new Error("Payment belonging to another internal order must be rejected.");
  }

  const otherPaymentLookup = await verifyWith(
    { payment: paymentRow({ id: OTHER_PAYMENT_ID, order_id: OTHER_ORDER_ID }), order: orderRow({ id: OTHER_ORDER_ID }) },
    validInput,
  );
  if (otherPaymentLookup.outcome !== "rejected" || otherPaymentLookup.reason !== "unknown_payment") {
    throw new Error("Callback for a different internal payment id must not verify this row.");
  }

  const captured = await verifyWith({
    payment: paymentRow({ status: "captured", captured_at: "2026-09-22T13:00:00.000Z" }),
    order: orderRow({ payment_status: "captured" }),
  });
  if (captured.outcome !== "already_captured") {
    throw new Error("Already-captured payment must not be treated as a new verification.");
  }

  if (valid.amountMinor !== 5365 || valid.currency !== "GBP") {
    throw new Error("Client-provided amount/currency must not override the persisted payment.");
  }

  if (read("src/lib/payment/verify-checkout.ts").includes("captured_at:")) {
    throw new Error("Verification must not write captured_at.");
  }

  const providerDown = await verifyRazorpayCheckoutPayment(validInput, {
    store: storeFor({ payment: paymentRow(), order: orderRow() }),
    keySecret: SECRET,
    fetchProviderPayment: async () => ({ ok: false, error: "Razorpay unavailable" }),
  });
  if (providerDown.outcome !== "rejected" || providerDown.reason !== "provider_unavailable") {
    throw new Error("Razorpay API failure must reject without capturing.");
  }

  console.log("verify-payment-verification: ok");
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
