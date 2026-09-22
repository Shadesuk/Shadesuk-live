import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PAYMENT_ATTEMPT_IDEMPOTENCY,
  PAYMENT_CURRENCY,
  PAYMENT_PROVIDER_RAZORPAY,
  isPaymentProviderRazorpay,
} from "../src/contracts/payment/schema";
import { STORE_CURRENCY } from "../src/contracts/money";
import { UK_STANDARD_DELIVERY_MINOR } from "../src/lib/checkout-quote";
import {
  buildPendingPaymentAttempt,
  quotePendingPaymentLines,
  type PendingPaymentLine,
} from "../src/lib/payment/pending-attempt";
import { initiatePendingRazorpayPayment } from "../src/services/pending-payment";
import { redactRazorpaySecrets } from "../src/lib/razorpay/errors";
import { emptyCheckoutDraft, type PublicCheckoutDraft } from "../src/types/checkout";
import type { PaymentRow } from "../src/contracts/payment/schema";
import type { OrderItemRow, OrderRow } from "../src/contracts/order/schema";
import type { PendingPaymentStore } from "../src/lib/payment/pending-store";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (PAYMENT_PROVIDER_RAZORPAY !== "razorpay" || !isPaymentProviderRazorpay("razorpay")) {
  throw new Error("Production payment provider must be razorpay.");
}
if (PAYMENT_CURRENCY !== STORE_CURRENCY || STORE_CURRENCY !== "GBP") {
  throw new Error("Payment currency must stay GBP.");
}
if (PAYMENT_ATTEMPT_IDEMPOTENCY.mechanism !== "none") {
  throw new Error("Do not invent a payment-attempt idempotency cookie in this foundation.");
}

const envExample = read(".env.example");
for (const name of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"] as const) {
  if (!envExample.includes(`${name}=`)) {
    throw new Error(`.env.example must document ${name}.`);
  }
}
if (envExample.includes("NEXT_PUBLIC_RAZORPAY_KEY_SECRET") || envExample.includes("NEXT_PUBLIC_RAZORPAY_WEBHOOK")) {
  throw new Error("Razorpay secrets must never use a NEXT_PUBLIC_ prefix.");
}

const serverFiles = [
  "src/lib/razorpay/config.ts",
  "src/lib/razorpay/client.ts",
  "src/lib/razorpay/create-order.ts",
  "src/lib/razorpay/errors.ts",
  "src/lib/payment/pending-store.ts",
  "src/services/pending-payment.ts",
];
for (const file of serverFiles) {
  const path = resolve(root, file);
  if (!existsSync(path)) {
    throw new Error(`Missing payment foundation file ${file}.`);
  }
  const source = read(file);
  if (!source.includes('import "server-only"')) {
    throw new Error(`${file} must be marked server-only.`);
  }
  if (source.includes("NEXT_PUBLIC_RAZORPAY")) {
    throw new Error(`${file} must not expose Razorpay via NEXT_PUBLIC_.`);
  }
  if (source.includes("checkout.js") || source.includes("@razorpay/checkout")) {
    throw new Error(`${file} must not load Checkout.js.`);
  }
}

const configSource = read("src/lib/razorpay/config.ts");
if (!configSource.includes("RAZORPAY_KEY_ID") || !configSource.includes("RAZORPAY_KEY_SECRET")) {
  throw new Error("Razorpay config must read KEY_ID and KEY_SECRET.");
}
if (!configSource.includes("RAZORPAY_WEBHOOK_SECRET")) {
  throw new Error("Razorpay config must resolve WEBHOOK_SECRET for later webhook use.");
}

const createOrderSource = read("src/lib/razorpay/create-order.ts");
if (!createOrderSource.includes("createRazorpayOrder") || !createOrderSource.includes("amountMinor")) {
  throw new Error("Razorpay adapter must create an order from amountMinor.");
}
if (createOrderSource.includes("totalMinor?:") && createOrderSource.includes("input.total")) {
  throw new Error("Razorpay adapter must not accept a client total.");
}

const serviceSource = read("src/services/pending-payment.ts");
if (
  !serviceSource.includes("authoritativeCheckoutQuote") &&
  !read("src/lib/payment/pending-attempt.ts").includes("authoritativeCheckoutQuote")
) {
  throw new Error("Pending payment must use authoritativeCheckoutQuote.");
}
if (
  serviceSource.includes('payment_status: "captured"') ||
  serviceSource.includes('status: "captured"') ||
  serviceSource.includes("stock_quantity")
) {
  throw new Error("Payment foundation must not capture payment or deduct inventory.");
}

const stubSource = read("src/contracts/payment/stub.ts");
if (stubSource.includes("createRazorpayOrder") || stubSource.includes("initiatePendingRazorpayPayment")) {
  throw new Error("The payment stub must not become the production charge writer.");
}

const clientSurfaces = [
  "src/components/checkout/CheckoutPage.tsx",
  "src/components/checkout/CheckoutReview.tsx",
  "src/components/payment/PaymentMethods.tsx",
  "src/app/(storefront)/checkout/page.tsx",
];
for (const file of clientSurfaces) {
  const source = read(file);
  if (
    source.includes("RAZORPAY_KEY_SECRET") ||
    source.includes("RAZORPAY_WEBHOOK_SECRET") ||
    source.toLowerCase().includes("checkout.js")
  ) {
    throw new Error(`${file} must not contain Razorpay secrets or Checkout.js.`);
  }
}

if (!redactRazorpaySecrets("key_secret: rzp_test_abc123").includes("[redacted]")) {
  throw new Error("Razorpay errors must redact secrets.");
}

const lines: PendingPaymentLine[] = [
  {
    productId: "11111111-1111-4111-8111-111111111111",
    productVariantId: "22222222-2222-4222-8222-222222222222",
    sku: "FRAME-01-BLK",
    productName: "Frame 01",
    colourName: "Black",
    variantName: null,
    quantity: 1,
    unitPriceMinor: 4900,
    lineTotalMinor: 4900,
  },
];

const clientOverrideQuote = quotePendingPaymentLines(lines, {
  subtotalMinor: 1,
  shippingMinor: 0,
  totalMinor: 1,
  currency: "USD",
  subtotal: 99,
  shipping: 0,
  total: 1,
});
if (clientOverrideQuote.currency !== "GBP") {
  throw new Error("Client currency must not override GBP.");
}
if (clientOverrideQuote.shippingMinor !== UK_STANDARD_DELIVERY_MINOR) {
  throw new Error("Client shipping must not override the server quote.");
}
if (clientOverrideQuote.subtotalMinor !== 4900 || clientOverrideQuote.totalMinor !== 4900 + UK_STANDARD_DELIVERY_MINOR) {
  throw new Error("Authoritative quote must use line totals plus £4.65 shipping.");
}

const draft: PublicCheckoutDraft = {
  ...emptyCheckoutDraft(),
  step: "review",
  email: "ada@shadesuk.example",
  firstName: "Ada",
  lastName: "Lovelace",
  line1: "10 Example Street",
  city: "London",
  postcode: "E1 6AN",
  country: "GB",
  addressEntry: "manual",
};

const built = buildPendingPaymentAttempt({
  draft,
  lines,
  clientQuote: { totalMinor: 1, currency: "USD", shippingMinor: 0 },
  createReference: () => "SHU-TESTREF0001",
});
if (!built.ok) {
  throw new Error("Valid checkout draft and live lines must build a pending attempt.");
}
if (built.attempt.quote.totalMinor !== 5365 || built.attempt.quote.currency !== "GBP") {
  throw new Error("Pending attempt quote must be the authoritative GBP total.");
}
if (
  built.attempt.order.payment_status !== "created" ||
  built.attempt.order.status !== "placed" ||
  built.attempt.payment.status !== "created"
) {
  throw new Error("Pending order and payment must start as created / placed.");
}
if (
  built.attempt.payment.amount_minor !== built.attempt.quote.totalMinor ||
  built.attempt.razorpay.amountMinor !== built.attempt.quote.totalMinor ||
  built.attempt.razorpay.currency !== "GBP" ||
  built.attempt.payment.provider !== "razorpay"
) {
  throw new Error("Razorpay amount must be the same authoritative quote total.");
}
if (built.attempt.order.total_minor !== 5365) {
  throw new Error("Order totals must match the server quote, not the client total.");
}

let razorpayAmount: number | null = null;
let razorpayCurrency: string | null = null;
const writes: Array<"order" | "items" | "payment" | "attach" | "fail"> = [];

const memoryStore: PendingPaymentStore = {
  async insertAttempt(input) {
    writes.push("order", "items", "payment");
    const now = "2026-09-22T12:00:00.000Z";
    const order: OrderRow = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      order_reference: input.order.order_reference,
      user_id: input.order.user_id,
      customer_email: input.order.customer_email,
      customer_first_name: input.order.customer_first_name,
      customer_last_name: input.order.customer_last_name,
      status: input.order.status,
      payment_status: input.order.payment_status,
      currency: "GBP",
      subtotal_minor: input.order.subtotal_minor,
      shipping_minor: input.order.shipping_minor,
      total_minor: input.order.total_minor,
      delivery_address: input.order.delivery_address,
      created_at: now,
      updated_at: now,
    };
    const items: OrderItemRow[] = input.items.map((item, index) => ({
      id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
      order_id: order.id,
      product_id: item.product_id,
      product_variant_id: item.product_variant_id,
      sku: item.sku,
      product_name: item.product_name,
      colour_name: item.colour_name,
      variant_name: item.variant_name,
      quantity: item.quantity,
      unit_price_minor: item.unit_price_minor,
      line_total_minor: item.line_total_minor,
      product_snapshot: item.product_snapshot,
      created_at: now,
    }));
    const payment: PaymentRow = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      order_id: order.id,
      provider: input.payment.provider,
      provider_order_id: null,
      provider_payment_id: null,
      amount_minor: input.payment.amount_minor,
      currency: "GBP",
      status: input.payment.status,
      failure_reason: null,
      captured_at: null,
      created_at: now,
      updated_at: now,
    };
    if (payment.status !== "created" || order.payment_status !== "created" || payment.captured_at) {
      throw new Error("Memory store must persist the unpaid created state.");
    }
    return { order, items, payment };
  },
  async attachProviderOrderId(paymentId, providerOrderId) {
    writes.push("attach");
    return {
      id: paymentId,
      order_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      provider: "razorpay",
      provider_order_id: providerOrderId,
      provider_payment_id: null,
      amount_minor: 5365,
      currency: "GBP",
      status: "created",
      failure_reason: null,
      captured_at: null,
      created_at: "2026-09-22T12:00:00.000Z",
      updated_at: "2026-09-22T12:00:00.000Z",
    };
  },
  async markInitiationFailed() {
    writes.push("fail");
  },
};

const initiated = await initiatePendingRazorpayPayment({
  cart: {
    items: [
      {
        id: "line-1",
        productId: lines[0]!.productId,
        slug: "frame-01",
        name: "Frame 01",
        href: "/product/frame-01",
        colourName: "Black",
        quantity: 1,
        unitPrice: 49,
        lineTotal: 49,
        currency: "GBP",
      },
    ],
    itemCount: 1,
    subtotal: 49,
    currency: "GBP",
    issues: [],
  },
  draft,
  userId: null,
  loadLines: async () => lines,
  store: memoryStore,
  createProviderOrder: async (input) => {
    razorpayAmount = input.amountMinor;
    razorpayCurrency = input.currency;
    if (input.amountMinor !== 5365 || input.currency !== "GBP") {
      throw new Error("Razorpay create must receive the authoritative GBP amount.");
    }
    return {
      ok: true,
      order: {
        providerOrderId: "order_test_foundation",
        amountMinor: input.amountMinor,
        currency: input.currency,
        receipt: input.receipt,
        providerStatus: "created",
      },
    };
  },
});

if (initiated.status !== "ok") {
  throw new Error("Injected initiation must succeed.");
}
if (razorpayAmount !== 5365 || razorpayCurrency !== "GBP") {
  throw new Error("Razorpay order creation must receive the authoritative amount in GBP.");
}
if (
  initiated.paymentStatus !== "created" ||
  initiated.orderPaymentStatus !== "created" ||
  initiated.orderStatus !== "placed" ||
  initiated.amountMinor !== 5365 ||
  initiated.currency !== "GBP"
) {
  throw new Error("Successful initiation must remain created/placed and uncaptured.");
}
if (writes.includes("fail") || initiated.paymentStatus === "captured") {
  throw new Error("Successful initiation must not capture or mark payment failed.");
}

const failedProvider = await initiatePendingRazorpayPayment({
  cart: {
    items: [
      {
        id: "line-1",
        productId: lines[0]!.productId,
        slug: "frame-01",
        name: "Frame 01",
        href: "/product/frame-01",
        colourName: "Black",
        quantity: 1,
        unitPrice: 49,
        lineTotal: 49,
        currency: "GBP",
      },
    ],
    itemCount: 1,
    subtotal: 49,
    currency: "GBP",
    issues: [],
  },
  draft,
  userId: null,
  loadLines: async () => lines,
  store: memoryStore,
  createProviderOrder: async () => ({ ok: false, error: "Razorpay unavailable" }),
});
if (failedProvider.status !== "provider_failed") {
  throw new Error("Razorpay failure must not report a successful initiation.");
}

console.log("verify-payment-foundation: ok");
