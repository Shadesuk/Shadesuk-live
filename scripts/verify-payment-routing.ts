/**
 * Phase 6 payment routing. India/INR is Razorpay. Other supported markets stay PayPal.
 * The Razorpay amount is the locked INR total. Missing keys, FX, or an expired lock fail closed.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCheckoutQuoteLock, QUOTE_LOCK_TTL_MS } from "../src/lib/checkout-quote-lock";
import { buildIndiaCharge } from "../src/lib/payment/india-charge";
import { checkoutPaymentRail, resolvePaymentProvider } from "../src/lib/payment/resolve-provider";
import { assessRazorpayCapture } from "../src/lib/razorpay/assess";
import { indiaWebhookHttpStatus } from "../src/lib/razorpay/commit";
import { resolveRazorpayServerConfig } from "../src/lib/razorpay/config";
import { isRazorpayPaymentId } from "../src/lib/razorpay/ids";
import { createRazorpayOrder, razorpayOrderPayload } from "../src/lib/razorpay/order";
import { decideIndiaAttemptReuse, type IndiaOpenAttempt } from "../src/lib/razorpay/reuse";
import { indiaCheckoutWindow } from "../src/lib/razorpay/window";
import {
  razorpayCheckoutSignature,
  razorpayCheckoutSignatureMatches,
  razorpayWebhookSignatureMatches,
} from "../src/lib/razorpay/signature";
import { V1_SHIPPING_CATALOGUE, type ShippingCatalogue } from "../src/lib/shipping/options";
import { emptyCheckoutDraft, type PublicCheckoutDraft } from "../src/types/checkout";
import type { PendingPaymentLine } from "../src/lib/payment/pending-attempt";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function catalogueWith(zoneId: string, amountMinor: number): ShippingCatalogue {
  return {
    ...V1_SHIPPING_CATALOGUE,
    methods: [
      ...V1_SHIPPING_CATALOGUE.methods,
      {
        id: `${zoneId}-test`,
        zoneId,
        code: "standard",
        label: "Test delivery",
        estimatedDelivery: "2+ weeks",
        currency: "GBP",
        amountMinor,
        isActive: true,
      },
    ],
  };
}

function line(unitPriceMinor: number, quantity = 1, variantId = "variant-in"): PendingPaymentLine {
  return {
    productId: "11111111-1111-4111-8111-111111111111",
    productVariantId: variantId,
    sku: "FRAME-01-BLK",
    productName: "Frame 01",
    colourName: "Black",
    variantName: null,
    quantity,
    unitPriceMinor,
    lineTotalMinor: unitPriceMinor * quantity,
  };
}

function draftWith(lock: PublicCheckoutDraft["quoteLock"], country: string): PublicCheckoutDraft {
  return {
    ...emptyCheckoutDraft(),
    step: "review",
    email: "ada@shadesuk.example",
    firstName: "Ada",
    lastName: "Lovelace",
    line1: "10 Example Street",
    city: "Mumbai",
    postcode: "400001",
    country,
    addressEntry: "manual",
    quoteLock: lock,
  };
}

const indiaResolved = resolvePaymentProvider({ country: "IN" });
const indiaExplicit = resolvePaymentProvider({ country: "IN", currency: "INR" });
if (
  !indiaResolved.ok ||
  indiaResolved.provider !== "razorpay" ||
  !indiaExplicit.ok ||
  indiaExplicit.provider !== "razorpay" ||
  checkoutPaymentRail({ country: "IN", currency: "INR" }) !== "india"
) {
  throw new Error("India/INR must resolve to Razorpay.");
}
const gb = resolvePaymentProvider({ country: "GB", currency: "GBP" });
const de = resolvePaymentProvider({ country: "DE", currency: "EUR" });
if (!gb.ok || gb.provider !== "paypal" || !de.ok || de.provider !== "paypal") {
  throw new Error("Supported non-India markets must stay on PayPal.");
}
if (checkoutPaymentRail({ country: "GB" }) !== "paypal") {
  throw new Error("Great Britain must use the PayPal rail.");
}
const mismatched = resolvePaymentProvider({ country: "IN", currency: "GBP" });
const unknown = resolvePaymentProvider({ country: "JP", currency: "JPY" });
if (mismatched.ok || unknown.ok || checkoutPaymentRail({ country: "IN", currency: "GBP" }) !== "unavailable") {
  throw new Error("Unsupported country or currency pairs must fail closed.");
}

const india = createCheckoutQuoteLock({
  countryCode: "IN",
  lines: [{ variantId: "variant-in", quantity: 1, unitPriceMinor: 100 }],
  fx: { id: "fx-inr-1", version: 2, rate: "100" },
  catalogue: catalogueWith("india", 100),
});
if (!india || india.chargeTotalMinor !== 20000 || india.fxRateId !== "fx-inr-1") {
  throw new Error("India lock must freeze the INR total from the FX snapshot.");
}
const payload = razorpayOrderPayload(india, "receipt123");
if (
  !payload ||
  payload.amount !== india.chargeTotalMinor ||
  payload.currency !== "INR" ||
  payload.notes.fx_rate_id !== india.fxRateId ||
  payload.payment_capture !== 0
) {
  throw new Error("Razorpay order payload must use the locked INR total and FX rate.");
}

const orderSource = read("src/lib/razorpay/order.ts");
if (/amountMinor\?:/.test(orderSource) || /input\.currency/.test(orderSource)) {
  throw new Error("Razorpay order creation must not accept a client amount or currency.");
}
const commitSource = read("src/lib/razorpay/commit.ts");
if (commitSource.includes("createPayPalOrder") || commitSource.includes("initiatePendingPayPalPayment") || commitSource.includes("@/lib/paypal")) {
  throw new Error("India checkout must not fall back to PayPal.");
}
const actionsSource = read("src/app/(storefront)/checkout/payment-actions.ts");
if (!actionsSource.includes('"amount" in input') || !actionsSource.includes('"currency" in input')) {
  throw new Error("India start must reject a client amount and currency.");
}
if (actionsSource.includes("RAZORPAY_KEY_SECRET") || actionsSource.includes("RAZORPAY_WEBHOOK_SECRET")) {
  throw new Error("Payment actions must not name Razorpay secrets.");
}

const testConfig = {
  keyId: "rzp_test_routing",
  keySecret: "test-secret",
  webhookSecret: "test-webhook",
};

async function assertOrderCreate() {
  let sent = "";
  const created = await createRazorpayOrder({
    lock: india!,
    receipt: "receipt123",
    config: testConfig,
    fetchImpl: async (_url, init) => {
      sent = String(init?.body ?? "");
      return new Response(
        JSON.stringify({ id: "order_test", amount: india!.chargeTotalMinor, currency: "INR" }),
        { status: 200 },
      );
    },
  });
  if (!created.ok || created.order.amountMinor !== india!.chargeTotalMinor || !sent.includes('"amount":20000')) {
    throw new Error("Razorpay create must post the locked INR amount.");
  }
  const drifted = await createRazorpayOrder({
    lock: india!,
    receipt: "receipt123",
    config: testConfig,
    fetchImpl: async () =>
      new Response(JSON.stringify({ id: "order_test", amount: 1, currency: "INR" }), { status: 200 }),
  });
  if (drifted.ok) {
    throw new Error("A Razorpay amount that differs from the lock must fail.");
  }
}

const unpriced = buildIndiaCharge({
  draft: draftWith(india, "IN"),
  lines: [line(100)],
  now: india.frozenAt,
});
if (unpriced.ok || unpriced.reason !== "blocked") {
  throw new Error("Unpriced India shipping must fail closed.");
}
const expired = buildIndiaCharge({
  draft: draftWith(india, "IN"),
  lines: [line(100)],
  now: india.frozenAt + QUOTE_LOCK_TTL_MS,
});
if (expired.ok || expired.reason !== "expired") {
  throw new Error("An expired India lock must fail closed.");
}
const missingFx = createCheckoutQuoteLock({
  countryCode: "IN",
  lines: [{ variantId: "variant-in", quantity: 1, unitPriceMinor: 100 }],
  catalogue: catalogueWith("india", 100),
});
if (missingFx) {
  throw new Error("A missing FX rate must not create an India lock.");
}
const noFxCharge = buildIndiaCharge({
  draft: draftWith(null, "IN"),
  lines: [line(100)],
});
if (noFxCharge.ok || noFxCharge.reason !== "blocked") {
  throw new Error("India without an FX lock must not fall back to PayPal.");
}
const gbLock = createCheckoutQuoteLock({
  countryCode: "GB",
  lines: [{ variantId: "variant-in", quantity: 1, unitPriceMinor: 100 }],
});
const paypalFallback = buildIndiaCharge({
  draft: draftWith(gbLock, "GB"),
  lines: [line(100)],
});
if (paypalFallback.ok || paypalFallback.reason !== "blocked") {
  throw new Error("A PayPal lock must not start an India charge.");
}
const indiaChargeSource = read("src/lib/payment/india-charge.ts");
if (
  !indiaChargeSource.includes("amountMinor: lock.chargeTotalMinor") ||
  !indiaChargeSource.includes("locked.quantity !== line.quantity") ||
  !indiaChargeSource.includes("subtotal !== lock.baseSubtotalMinor") ||
  indiaChargeSource.includes("createPayPalOrder")
) {
  throw new Error("India charge must use the locked total and reject a mismatched bag.");
}

const secret = "test-secret";
const goodSig = razorpayCheckoutSignature("order_test", "pay_test", secret);
if (
  !razorpayCheckoutSignatureMatches({
    orderId: "order_test",
    paymentId: "pay_test",
    signature: goodSig,
    secret,
  }) ||
  razorpayCheckoutSignatureMatches({
    orderId: "order_test",
    paymentId: "pay_test",
    signature: goodSig.replace(/.$/, goodSig.endsWith("a") ? "b" : "a"),
    secret,
  })
) {
  throw new Error("Checkout success must use a constant-time HMAC over order_id|payment_id.");
}
const rawBody = '{"event":"payment.authorized","payload":{"payment":{"entity":{"id":"pay_test","order_id":"order_test"}}}}';
const rawSig = createHmac("sha256", "test-webhook").update(rawBody).digest("hex");
if (
  !razorpayWebhookSignatureMatches(rawBody, rawSig, "test-webhook") ||
  razorpayWebhookSignatureMatches(`${rawBody} `, rawSig, "test-webhook")
) {
  throw new Error("Webhook verification must use the raw body.");
}

const stored = {
  amountMinor: india.chargeTotalMinor,
  currency: "INR",
  fxRateId: india.fxRateId,
  frozenAt: india.frozenAt,
  status: "authorized",
  providerPaymentId: null,
};
if (
  assessRazorpayCapture({
    stored,
    returnedAmountMinor: india.chargeTotalMinor,
    returnedCurrency: "INR",
    incomingPaymentId: "pay_test",
  }) !== "capture"
) {
  throw new Error("A matching Razorpay payment must be allowed to capture after the lock clock.");
}
if (
  assessRazorpayCapture({
    stored: { ...stored, status: "captured", providerPaymentId: "pay_test" },
    returnedAmountMinor: india.chargeTotalMinor,
    returnedCurrency: "INR",
    incomingPaymentId: "pay_test",
  }) !== "duplicate"
) {
  throw new Error("The same payment id must capture once.");
}
if (
  assessRazorpayCapture({
    stored,
    returnedAmountMinor: india.chargeTotalMinor - 1,
    returnedCurrency: "INR",
    incomingPaymentId: "pay_test",
  }) !== "reject" ||
  assessRazorpayCapture({
    stored,
    returnedAmountMinor: india.chargeTotalMinor,
    returnedCurrency: "GBP",
    incomingPaymentId: "pay_test",
  }) !== "reject"
) {
  throw new Error("Amount and currency mismatches must reject capture.");
}
if (indiaWebhookHttpStatus({ status: "error", terminal: true }) !== 200) {
  throw new Error("A terminal India webhook failure must return 200 so Razorpay stops retrying.");
}
if (indiaWebhookHttpStatus({ status: "error", terminal: false }) !== 409) {
  throw new Error("A retryable India webhook failure must return 409.");
}
if (isRazorpayPaymentId("pay_../x") || isRazorpayPaymentId("pay_") || !isRazorpayPaymentId("pay_Abc123")) {
  throw new Error("Razorpay payment ids must match pay_ and letters or digits.");
}
if (!indiaCheckoutWindow(india.frozenAt, india.frozenAt).ok) {
  throw new Error("A fresh lock must leave a checkout.js window.");
}
if (indiaCheckoutWindow(india.frozenAt, india.frozenAt + QUOTE_LOCK_TTL_MS - 30_000).ok) {
  throw new Error("A lock with under a minute left must not open a new Razorpay order.");
}
const openAttempt: IndiaOpenAttempt = {
  paymentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  orderId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  orderReference: "SHU-INDIATEST0001",
  providerOrderId: "order_Test123",
  amountMinor: india.chargeTotalMinor,
  currency: "INR",
  frozenAt: india.frozenAt,
  userId: null,
  email: "ada@shadesuk.example",
  status: "created",
  lines: [{ variantId: "variant-in", quantity: 1 }],
};
if (
  decideIndiaAttemptReuse({
    open: openAttempt,
    ownerUserId: null,
    email: openAttempt.email,
    frozenAt: india.frozenAt,
    amountMinor: india.chargeTotalMinor,
    lines: openAttempt.lines,
  }) !== "reuse"
) {
  throw new Error("The same frozen quote must reuse the open India attempt.");
}
if (
  decideIndiaAttemptReuse({
    open: openAttempt,
    ownerUserId: null,
    email: openAttempt.email,
    frozenAt: india.frozenAt + 1,
    amountMinor: india.chargeTotalMinor,
    lines: openAttempt.lines,
  }) !== "close"
) {
  throw new Error("A different frozen quote must close the earlier open attempt.");
}
const priced = {
  status: "priced" as const,
  countryCode: "IN",
  zoneId: "india",
  options: [
    {
      methodId: "india-test",
      zoneId: "india",
      code: "standard",
      label: "Test delivery",
      estimatedDelivery: "2+ weeks",
      currency: "GBP" as const,
      amountMinor: 100,
    },
  ],
};
const samePrice = buildIndiaCharge({
  draft: draftWith(india, "IN"),
  lines: [line(100)],
  now: india.frozenAt,
  shippingQuote: priced,
});
if (!samePrice.ok || samePrice.charge.payment.amountMinor !== india.chargeTotalMinor) {
  throw new Error("A matching live total must charge the locked INR amount.");
}
const cheaper = buildIndiaCharge({
  draft: draftWith(india, "IN"),
  lines: [line(50)],
  now: india.frozenAt,
  shippingQuote: priced,
});
if (cheaper.ok || cheaper.reason !== "stale") {
  throw new Error("A lower live total must not charge the higher frozen INR amount.");
}

const missingKeys = resolveRazorpayServerConfig({} as NodeJS.ProcessEnv);
const liveKey = resolveRazorpayServerConfig({
  RAZORPAY_KEY_ID: "rzp_live_example",
  RAZORPAY_KEY_SECRET: "secret",
  RAZORPAY_WEBHOOK_SECRET: "hook",
} as unknown as NodeJS.ProcessEnv);
const testKey = resolveRazorpayServerConfig({
  RAZORPAY_KEY_ID: "rzp_test_example",
  RAZORPAY_KEY_SECRET: "secret",
  RAZORPAY_WEBHOOK_SECRET: "hook",
} as unknown as NodeJS.ProcessEnv);
if (missingKeys.ok || missingKeys.reason !== "missing" || liveKey.ok || liveKey.reason !== "live_key" || !testKey.ok) {
  throw new Error("Razorpay must fail closed without test keys and must reject live keys.");
}

for (const file of [
  "src/components/checkout/CheckoutPage.tsx",
  "src/components/checkout/CheckoutReview.tsx",
  "src/components/checkout/IndiaPayment.tsx",
  "src/app/(storefront)/checkout/page.tsx",
  "src/app/(storefront)/checkout/payment-actions.ts",
]) {
  const source = read(file);
  if (source.includes("RAZORPAY_KEY_SECRET") || source.includes("RAZORPAY_WEBHOOK_SECRET") || source.includes("NEXT_PUBLIC_RAZORPAY")) {
    throw new Error(`${file} must not leak Razorpay secrets.`);
  }
}
const pageSource = read("src/app/(storefront)/checkout/page.tsx").toLowerCase();
const checkoutPage = read("src/components/checkout/CheckoutPage.tsx").toLowerCase();
if (pageSource.includes("razorpay") || checkoutPage.includes("razorpay") || checkoutPage.includes("checkout.js")) {
  throw new Error("The checkout shell must not name Razorpay or load checkout.js.");
}
const review = read("src/components/checkout/CheckoutReview.tsx");
if (review.toLowerCase().includes("checkout.js") || !review.includes('paymentRail !== "india"') || !review.includes("PAYMENT_NEXT_BODY")) {
  throw new Error("India review must keep PayPal off that rail and leave checkout.js in its own file.");
}
if (!read("src/components/checkout/IndiaPayment.tsx").includes("https://checkout.razorpay.com/v1/checkout.js")) {
  throw new Error("India payment must load checkout.js only from its own component.");
}
if (!read(".env.example").includes("\nRAZORPAY_KEY_ID=") || read(".env.example").includes("NEXT_PUBLIC_RAZORPAY")) {
  throw new Error(".env.example must document server-only Razorpay test keys.");
}

assertOrderCreate()
  .then(() => {
    console.log("Payment routing OK: India/INR Razorpay, locked amount, fail closed, test keys only.");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
