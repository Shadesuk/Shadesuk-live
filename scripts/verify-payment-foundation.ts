import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PAYMENT_ATTEMPT_IDEMPOTENCY,
  PAYMENT_CURRENCY,
  PAYMENT_PROVIDER_PAYPAL,
  isPaymentProviderPaypal,
} from "../src/contracts/payment/schema";
import { STORE_CURRENCY } from "../src/contracts/money";
import { UK_STANDARD_DELIVERY_MINOR } from "../src/lib/checkout-quote";
import {
  buildPendingPaymentAttempt,
  quotePendingPaymentLines,
  type PendingPaymentLine,
} from "../src/lib/payment/pending-attempt";
import {
  checkoutAttemptOwnerMatches,
  paymentAttemptBoundToCookie,
} from "../src/lib/payment/attempt-binding";
import { commitPendingPayPalPayment } from "../src/lib/payment/initiate";
import {
  closeCheckoutPaymentAttempt,
  initiatePendingPayPalPayment,
} from "../src/services/pending-payment";
import type { PublicCart } from "../src/types/cart";
import { gbpMinorToPayPalValue, payPalValueToGbpMinor } from "../src/lib/paypal/amount";
import { PAYPAL_ORDERS_PREFER_RETURN_REPRESENTATION } from "../src/lib/paypal/client";
import { parseCreatedOrder } from "../src/lib/paypal/create-order";
import { redactPayPalSecrets } from "../src/lib/paypal/errors";
import { emptyCheckoutDraft, type PublicCheckoutDraft } from "../src/types/checkout";
import type { PaymentRow } from "../src/contracts/payment/schema";
import type { OrderItemRow, OrderRow } from "../src/contracts/order/schema";
import type { PendingPaymentStore } from "../src/lib/payment/pending-store";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

/** Real secret reads/assignments — not prose that says "never CLIENT_SECRET". */
function embedsPayPalSecret(source: string): boolean {
  return (
    /\bprocess\.env\.PAYPAL_CLIENT_SECRET\b/.test(source) ||
    /\bprocess\.env\.PAYPAL_WEBHOOK_ID\b/.test(source) ||
    /\bNEXT_PUBLIC_PAYPAL_CLIENT_SECRET\b/.test(source) ||
    /\bNEXT_PUBLIC_PAYPAL_WEBHOOK_ID\b/.test(source) ||
    /\bNEXT_PUBLIC_PAYPAL_WEBHOOK_SECRET\b/.test(source) ||
    /\bPAYPAL_CLIENT_SECRET\s*=/.test(source)
  );
}

if (PAYMENT_PROVIDER_PAYPAL !== "paypal" || !isPaymentProviderPaypal("paypal")) {
  throw new Error("Production payment provider must be paypal.");
}
if (PAYMENT_CURRENCY !== STORE_CURRENCY || STORE_CURRENCY !== "GBP") {
  throw new Error("Payment currency must stay GBP.");
}
if (PAYMENT_ATTEMPT_IDEMPOTENCY.mechanism !== "none") {
  throw new Error("Do not invent a payment-attempt idempotency cookie in this foundation.");
}

// Prefer return=representation on paypalFetchJson (create + GET + capture via shared client).
if (PAYPAL_ORDERS_PREFER_RETURN_REPRESENTATION !== "return=representation") {
  throw new Error("PayPal Orders Prefer must be return=representation.");
}
const clientSource = read("src/lib/paypal/client.ts");
if (
  !clientSource.includes("Prefer: PAYPAL_ORDERS_PREFER_RETURN_REPRESENTATION") ||
  !clientSource.includes('PAYPAL_ORDERS_PREFER_RETURN_REPRESENTATION = "return=representation"')
) {
  throw new Error("paypalFetchJson must send Prefer: return=representation.");
}

const parseExpected = {
  amountMinor: 5365,
  currency: "GBP" as const,
  customId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  invoiceId: "SHU-TESTREF0001",
};
const parsedFull = parseCreatedOrder(
  {
    id: "5O190127TN364715T",
    status: "CREATED",
    purchase_units: [
      {
        amount: { currency_code: "GBP", value: "53.65" },
        custom_id: parseExpected.customId,
        invoice_id: parseExpected.invoiceId,
      },
    ],
  },
  parseExpected,
);
if (!parsedFull.ok || parsedFull.order.amountMinor !== 5365) {
  throw new Error("parseCreatedOrder must accept a full Orders representation.");
}
const parsedMissing = parseCreatedOrder(
  { id: "5O190127TN364715T", status: "CREATED" },
  parseExpected,
);
if (parsedMissing.ok || parsedMissing.error !== "PayPal order is missing purchase_units.") {
  throw new Error("parseCreatedOrder must reject responses without purchase_units.");
}
const paymentActions = read("src/app/(storefront)/checkout/payment-actions.ts");
if (
  !paymentActions.includes("verifyPayPalClientReturn") ||
  !paymentActions.includes("captureVerifiedPayment")
) {
  throw new Error("Checkout must still verify then captureVerifiedPayment (no Prefer bypass).");
}

const envExample = read(".env.example");
for (const name of [
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_MODE",
] as const) {
  if (!envExample.includes(`${name}=`)) {
    throw new Error(`.env.example must document ${name}.`);
  }
}
if (
  envExample.includes("NEXT_PUBLIC_PAYPAL_CLIENT_SECRET=") ||
  envExample.includes("NEXT_PUBLIC_PAYPAL_WEBHOOK_ID=") ||
  envExample.includes("NEXT_PUBLIC_PAYPAL_WEBHOOK_SECRET=")
) {
  throw new Error("PayPal secrets must never use a NEXT_PUBLIC_ prefix.");
}
if (envExample.includes("\nRAZORPAY_KEY_ID=") || envExample.includes("\nRAZORPAY_KEY_SECRET=")) {
  throw new Error("Active Razorpay env keys must stay retired (commented) in .env.example.");
}

if (existsSync(resolve(root, "src/lib/razorpay"))) {
  throw new Error("src/lib/razorpay must be deleted.");
}
if (read("package.json").includes('"razorpay"')) {
  throw new Error("npm razorpay dependency must be removed.");
}

const serverFiles = [
  "src/lib/paypal/config.ts",
  "src/lib/paypal/client.ts",
  "src/lib/paypal/create-order.ts",
  "src/lib/paypal/errors.ts",
  "src/lib/paypal/amount.ts",
  "src/lib/payment/pending-store.ts",
  "src/lib/payment/initiate.ts",
  "src/services/pending-payment.ts",
];
for (const file of serverFiles) {
  const path = resolve(root, file);
  if (!existsSync(path)) {
    throw new Error(`Missing payment foundation file ${file}.`);
  }
  const source = read(file);
  if (!source.includes('import "server-only"') && !file.includes("amount.ts")) {
    // amount.ts is pure and client-safe for formatting helpers only
    if (!file.endsWith("amount.ts")) {
      throw new Error(`${file} must be marked server-only.`);
    }
  }
  // Server modules may read PAYPAL_CLIENT_SECRET; only flag Checkout.js / Razorpay leftovers.
  if (source.toLowerCase().includes("checkout.js") || source.includes("@razorpay")) {
    throw new Error(`${file} must not load Checkout.js / Razorpay.`);
  }
}

const configSource = read("src/lib/paypal/config.ts");
if (!configSource.includes("PAYPAL_CLIENT_ID") || !configSource.includes("PAYPAL_CLIENT_SECRET")) {
  throw new Error("PayPal config must read CLIENT_ID and CLIENT_SECRET.");
}
if (!configSource.includes("PAYPAL_WEBHOOK_ID") || !configSource.includes("PAYPAL_MODE")) {
  throw new Error("PayPal config must resolve WEBHOOK_ID and MODE.");
}

const createOrderSource = read("src/lib/paypal/create-order.ts");
if (!createOrderSource.includes("createPayPalOrder") || !createOrderSource.includes("amountMinor")) {
  throw new Error("PayPal adapter must create an order from amountMinor.");
}
if (!createOrderSource.includes("custom_id") || !createOrderSource.includes("invoice_id")) {
  throw new Error("PayPal create-order must map custom_id and invoice_id.");
}
if (createOrderSource.includes("totalMinor?:") && createOrderSource.includes("input.total")) {
  throw new Error("PayPal adapter must not accept a client total.");
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
if (stubSource.includes("createPayPalOrder") || stubSource.includes("initiatePendingPayPalPayment")) {
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
    embedsPayPalSecret(source) ||
    source.toLowerCase().includes("checkout.js") ||
    source.includes("razorpay")
  ) {
    throw new Error(`${file} must not contain PayPal secrets, Razorpay, or Checkout.js.`);
  }
}

if (!redactPayPalSecrets("Bearer A21AATESTTOKENVALUE1234567890").includes("[redacted]")) {
  throw new Error("PayPal errors must redact secrets.");
}

if (gbpMinorToPayPalValue(5365) !== "53.65" || payPalValueToGbpMinor("53.65", "GBP") !== 5365) {
  throw new Error("GBP pence ↔ PayPal Money value must use exact two fractional digits.");
}
if (payPalValueToGbpMinor("53.65", "USD") !== null || payPalValueToGbpMinor("53.6", "GBP") !== null) {
  throw new Error("PayPal amount helper must reject non-GBP and non-two-decimal values.");
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
  built.attempt.order.status !== "checkout" ||
  built.attempt.payment.status !== "created"
) {
  throw new Error("Pending order must start as an unpaid checkout attempt, not a placed order.");
}
if (
  built.attempt.payment.amount_minor !== built.attempt.quote.totalMinor ||
  built.attempt.paypal.amountMinor !== built.attempt.quote.totalMinor ||
  built.attempt.paypal.currency !== "GBP" ||
  built.attempt.payment.provider !== "paypal"
) {
  throw new Error("PayPal amount must be the same authoritative quote total.");
}
if (built.attempt.order.total_minor !== 5365) {
  throw new Error("Order totals must match the server quote, not the client total.");
}

async function verifyInitiationFlow(): Promise<void> {
  let paypalAmount: number | null = null;
  let paypalCurrency: string | null = null;
  let expectedInvoiceId: string | null = null;
  const writes: Array<"order" | "items" | "payment" | "attach" | "fail"> = [];

  const memoryStore: PendingPaymentStore = {
    async insertAttempt(input) {
      writes.push("order", "items", "payment");
      expectedInvoiceId = input.order.order_reference;
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
        provider: "paypal",
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
    async loadOpenAttempt() {
      return null;
    },
    async closeOpenAttempt() {
      writes.push("fail");
    },
  };

  const initiated = await commitPendingPayPalPayment({
    draft,
    lines,
    userId: null,
    store: memoryStore,
    createProviderOrder: async (input) => {
      paypalAmount = input.amountMinor;
      paypalCurrency = input.currency;
      if (input.amountMinor !== 5365 || input.currency !== "GBP") {
        throw new Error("PayPal create must receive the authoritative GBP amount.");
      }
      if (input.customId !== "cccccccc-cccc-4ccc-8ccc-cccccccccccc") {
        throw new Error("PayPal custom_id must be payments.id.");
      }
      if (!expectedInvoiceId || input.invoiceId !== expectedInvoiceId) {
        throw new Error("PayPal invoice_id must be order_reference.");
      }
      if (input.invoiceId.length > 127) {
        throw new Error("PayPal invoice_id must stay ≤ 127 characters (fail closed).");
      }
      return {
        ok: true,
        order: {
          providerOrderId: "5O190127TN364715T",
          amountMinor: input.amountMinor,
          currency: input.currency,
          providerStatus: "CREATED",
          customId: input.customId,
          invoiceId: input.invoiceId,
        },
      };
    },
  });

  if (initiated.status !== "ok") {
    throw new Error("Injected initiation must succeed.");
  }
  if (paypalAmount !== 5365 || paypalCurrency !== "GBP") {
    throw new Error("PayPal order creation must receive the authoritative amount in GBP.");
  }
  if (
    initiated.paymentStatus !== "created" ||
    initiated.orderPaymentStatus !== "created" ||
    initiated.orderStatus !== "checkout" ||
    initiated.amountMinor !== 5365 ||
    initiated.currency !== "GBP"
  ) {
    throw new Error("Successful initiation must remain an unpaid checkout attempt.");
  }
  if (writes.includes("fail")) {
    throw new Error("Successful initiation must not capture or mark payment failed.");
  }
  if (read("src/lib/payment/initiate.ts").includes('paymentStatus: "captured"')) {
    throw new Error("Initiation result must not report a captured payment.");
  }

  const failedProvider = await commitPendingPayPalPayment({
    draft,
    lines,
    userId: null,
    store: memoryStore,
    createProviderOrder: async () => ({ ok: false, error: "PayPal unavailable" }),
  });
  if (failedProvider.status !== "provider_failed") {
    throw new Error("PayPal failure must not report a successful initiation.");
  }
}

const USER_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const USER_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const ATTEMPT_PAYMENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_PAYMENT_ID = "abababab-abab-4aba-8aba-abababababab";

if (!paymentAttemptBoundToCookie(ATTEMPT_PAYMENT_ID, ATTEMPT_PAYMENT_ID)) {
  throw new Error("A payment id must match the attempt cookie to be bound.");
}
if (
  paymentAttemptBoundToCookie(OTHER_PAYMENT_ID, ATTEMPT_PAYMENT_ID) ||
  paymentAttemptBoundToCookie(ATTEMPT_PAYMENT_ID, null) ||
  paymentAttemptBoundToCookie(ATTEMPT_PAYMENT_ID, "") ||
  paymentAttemptBoundToCookie("not-a-uuid", ATTEMPT_PAYMENT_ID)
) {
  throw new Error("Cancel must reject a payment id that is not the attempt cookie.");
}
if (
  !checkoutAttemptOwnerMatches(null, null) ||
  !checkoutAttemptOwnerMatches(USER_A, USER_A)
) {
  throw new Error("Reuse must allow a guest guest-attempt and the signed-in owner.");
}
if (
  checkoutAttemptOwnerMatches(USER_A, null) ||
  checkoutAttemptOwnerMatches(null, USER_A) ||
  checkoutAttemptOwnerMatches(USER_B, USER_A) ||
  checkoutAttemptOwnerMatches(USER_A, "")
) {
  throw new Error("Reuse must reject another user's attempt, including guest versus account.");
}

function openAttempt(userId: string | null, totalMinor = 5365): {
  order: OrderRow;
  items: OrderItemRow[];
  payment: PaymentRow;
} {
  const now = new Date().toISOString();
  return {
    order: {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      order_reference: "SHU-OPENATTEMPT1",
      user_id: userId,
      customer_email: "ada@shadesuk.example",
      customer_first_name: "Ada",
      customer_last_name: "Lovelace",
      status: "checkout",
      payment_status: "created",
      currency: "GBP",
      subtotal_minor: 4900,
      shipping_minor: UK_STANDARD_DELIVERY_MINOR,
      total_minor: totalMinor,
      delivery_address: { postcode: "E1 6AN" },
      created_at: now,
      updated_at: now,
    },
    items: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0",
        order_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        product_id: lines[0].productId,
        product_variant_id: lines[0].productVariantId,
        sku: lines[0].sku,
        product_name: lines[0].productName,
        colour_name: lines[0].colourName,
        variant_name: lines[0].variantName,
        quantity: lines[0].quantity,
        unit_price_minor: lines[0].unitPriceMinor,
        line_total_minor: lines[0].lineTotalMinor,
        product_snapshot: {},
        created_at: now,
      },
    ],
    payment: {
      id: ATTEMPT_PAYMENT_ID,
      order_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      provider: "paypal",
      provider_order_id: "5O190127TN364715T",
      provider_payment_id: null,
      amount_minor: totalMinor,
      currency: "GBP",
      status: "created",
      failure_reason: null,
      captured_at: null,
      created_at: now,
      updated_at: now,
    },
  };
}

const bindingCart: PublicCart = {
  items: [
    {
      id: "item-1",
      productId: lines[0].productId,
      slug: "frame-01",
      name: "Frame 01",
      href: "/products/frame-01",
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
};

async function verifyAttemptBinding(): Promise<void> {
  const closed: Array<{ paymentId: string; status: string }> = [];
  const closingStore: PendingPaymentStore = {
    async insertAttempt() {
      throw new Error("Cancel must not insert.");
    },
    async attachProviderOrderId() {
      throw new Error("Cancel must not attach.");
    },
    async markInitiationFailed() {
      throw new Error("Cancel must not mark initiation failed.");
    },
    async loadOpenAttempt() {
      return null;
    },
    async closeOpenAttempt(paymentId, status) {
      closed.push({ paymentId, status });
    },
  };

  const foreign = await closeCheckoutPaymentAttempt(
    OTHER_PAYMENT_ID,
    "cancelled",
    "Buyer cancelled PayPal.",
    { store: closingStore, boundPaymentId: ATTEMPT_PAYMENT_ID },
  );
  const missingCookie = await closeCheckoutPaymentAttempt(
    ATTEMPT_PAYMENT_ID,
    "failed",
    "PayPal declined the instrument.",
    { store: closingStore, boundPaymentId: null },
  );
  if (foreign || missingCookie || closed.length !== 0) {
    throw new Error("Cancel and decline must not close an attempt the cookie does not name.");
  }
  const boundCloses: Array<{ paymentId: string; status: string }> = [];
  closingStore.closeOpenAttempt = async (paymentId, status) => {
    boundCloses.push({ paymentId, status });
  };
  const cancelled = await closeCheckoutPaymentAttempt(
    ATTEMPT_PAYMENT_ID,
    "cancelled",
    "Buyer cancelled PayPal.",
    { store: closingStore, boundPaymentId: ATTEMPT_PAYMENT_ID },
  );
  const declined = await closeCheckoutPaymentAttempt(
    ATTEMPT_PAYMENT_ID,
    "failed",
    "PayPal declined the instrument.",
    { store: closingStore, boundPaymentId: ATTEMPT_PAYMENT_ID },
  );
  if (
    !cancelled ||
    !declined ||
    boundCloses.length !== 2 ||
    boundCloses[0]?.status !== "cancelled" ||
    boundCloses[1]?.status !== "failed" ||
    boundCloses.some((row) => row.paymentId !== ATTEMPT_PAYMENT_ID)
  ) {
    throw new Error("Cancel and decline must close only the cookie-bound attempt.");
  }

  async function reuse(userId: string | null, ownerId: string | null, totalMinor = 5365) {
    const closes: string[] = [];
    let created = false;
    const open = openAttempt(ownerId, totalMinor);
    const store: PendingPaymentStore = {
      async insertAttempt(input) {
        created = true;
        const now = new Date().toISOString();
        return {
          order: {
            ...open.order,
            id: "11111111-1111-4111-8111-111111111112",
            user_id: input.order.user_id,
            order_reference: input.order.order_reference,
            total_minor: input.order.total_minor,
            created_at: now,
            updated_at: now,
          },
          items: open.items,
          payment: {
            ...open.payment,
            id: "12121212-1212-4121-8121-121212121212",
            provider_order_id: null,
            amount_minor: input.payment.amount_minor,
            created_at: now,
            updated_at: now,
          },
        };
      },
      async attachProviderOrderId(paymentId, providerOrderId) {
        return {
          ...open.payment,
          id: paymentId,
          provider_order_id: providerOrderId,
        };
      },
      async markInitiationFailed() {
        throw new Error("Owner mismatch must not fail the other attempt.");
      },
      async loadOpenAttempt() {
        return open;
      },
      async closeOpenAttempt(paymentId) {
        closes.push(paymentId);
      },
    };
    const result = await initiatePendingPayPalPayment({
      cart: bindingCart,
      draft,
      userId,
      loadLines: async () => lines,
      store,
      readAttemptId: async () => ATTEMPT_PAYMENT_ID,
      createProviderOrder: async (input) => ({
        ok: true,
        order: {
          providerOrderId: "NEWPAYPALORDERID01",
          amountMinor: input.amountMinor,
          currency: input.currency,
          providerStatus: "CREATED",
          customId: input.customId,
          invoiceId: input.invoiceId,
        },
      }),
    });
    return { result, closes, created };
  }

  const sameGuest = await reuse(null, null);
  if (
    sameGuest.result.status !== "ok" ||
    sameGuest.result.paymentId !== ATTEMPT_PAYMENT_ID ||
    sameGuest.created ||
    sameGuest.closes.length !== 0
  ) {
    throw new Error("A guest must reuse their own guest attempt.");
  }

  const sameUser = await reuse(USER_A, USER_A);
  if (
    sameUser.result.status !== "ok" ||
    sameUser.result.paymentId !== ATTEMPT_PAYMENT_ID ||
    sameUser.created ||
    sameUser.closes.length !== 0
  ) {
    throw new Error("A signed-in shopper must reuse only their own attempt.");
  }

  const guestOnUser = await reuse(null, USER_A);
  const userOnGuest = await reuse(USER_A, null);
  const userOnOther = await reuse(USER_A, USER_B);
  for (const crossed of [guestOnUser, userOnGuest, userOnOther]) {
    if (
      crossed.result.status !== "ok" ||
      crossed.result.paymentId === ATTEMPT_PAYMENT_ID ||
      !crossed.created ||
      crossed.closes.length !== 0
    ) {
      throw new Error("A shopper must not reuse or close another user's open attempt.");
    }
  }

  const changedQuote = await reuse(USER_A, USER_A, 1);
  if (
    changedQuote.closes.length !== 1 ||
    changedQuote.closes[0] !== ATTEMPT_PAYMENT_ID ||
    !changedQuote.created
  ) {
    throw new Error("A changed quote may close only the same shopper's open attempt.");
  }

  if (!read("src/app/(storefront)/checkout/payment-actions.ts").includes("if (!closed)")) {
    throw new Error("Cancel and decline actions must reject an unbound payment id.");
  }
}

void verifyInitiationFlow()
  .then(() => verifyAttemptBinding())
  .then(() => {
    console.log("verify-payment-foundation: ok");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
