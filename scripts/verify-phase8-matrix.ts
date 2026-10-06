/**
 * Phase 8 acceptance matrix. Offline only.
 * Does not call PayPal, Razorpay, Postcodes.io, Geoapify, or Frankfurter.
 * Does not apply migrations or invent an international shipping price.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isGuestCartSessionId } from "../src/contracts/cart/session";
import { UK_SHIPPING_RATE_MINOR } from "../src/contracts/markets";
import { captureVerifiedPayment } from "../src/lib/payment/capture-verified";
import { closeCheckoutPaymentAttempt } from "../src/services/pending-payment";
import type { PendingPaymentStore } from "../src/lib/payment/pending-store";
import type { PaymentCaptureStore } from "../src/lib/payment/capture-store";
import type { PaymentRow } from "../src/contracts/payment/schema";
import type { OrderItemRow, OrderRow } from "../src/contracts/order/schema";
import {
  QUOTE_LOCK_TTL_MS,
  createCheckoutQuoteLock,
  inspectCheckoutQuoteLock,
  liveTotalUndercutsLock,
  quoteLockExpired,
  quoteLockForCountry,
} from "../src/lib/checkout-quote-lock";
import { authoritativeCheckoutQuote, quoteIsChargeable } from "../src/lib/checkout-quote";
import { getLocalizedPrice, multiplyMinorByRateHalfUp, parsePositiveDecimalRate } from "../src/contracts/pricing";
import { clientSuppliedCheckoutMoney } from "../src/lib/checkout-quote";
import { lookupUsesAutocomplete } from "../src/lib/checkout-validate";
import {
  formatChargeMinor,
  formatDisplayGbpMinor,
  formatDisplayMinor,
  displayMinorFromGbp,
  presentCheckoutAmount,
  presentCheckoutPartsTotal,
  sumPresentedCheckoutMinors,
} from "../src/lib/market/prices";
import { encodeCheckoutDraftCookie, decodeCheckoutDraftCookie } from "../src/lib/checkout-draft";
import { lookupAddresses, getAddressProvider } from "../src/lib/address-lookup";
import { postcodesIoAddressLookupProvider } from "../src/lib/address-providers/postcodes-io";
import { createGeoapifyProvider } from "../src/lib/address-providers/geoapify";
import { runFxRefresh } from "../src/lib/fx/refresh";
import { paypalAttemptSatisfiesChargeSnapshot } from "../src/lib/order-snapshot";
import { buildPendingPaymentAttempt, type PendingPaymentLine } from "../src/lib/payment/pending-attempt";
import { buildIndiaCharge } from "../src/lib/payment/india-charge";
import { checkoutPaymentRail, resolvePaymentProvider } from "../src/lib/payment/resolve-provider";
import { decideIndiaAttemptReuse } from "../src/lib/razorpay/reuse";
import { indiaWebhookHttpStatus } from "../src/lib/razorpay/commit";
import { handleRazorpayWebhook } from "../src/lib/razorpay/webhook";
import { razorpayWebhookSignatureMatches } from "../src/lib/razorpay/signature";
import {
  handlePayPalWebhook,
  PAYPAL_PAYMENT_CAPTURE_COMPLETED,
  PAYPAL_PAYMENT_CAPTURE_DECLINED,
} from "../src/lib/payment/handle-webhook";
import type { PaymentWebhookStore } from "../src/lib/payment/webhook-store";
import { resolveShippingOptions, V1_SHIPPING_CATALOGUE, type ShippingCatalogue } from "../src/lib/shipping/options";
import { emptyCheckoutDraft, type PublicCheckoutDraft } from "../src/types/checkout";
import { GET as paypalWebhookGet } from "../src/app/api/webhooks/paypal/route";
import { GET as razorpayWebhookGet } from "../src/app/api/webhooks/razorpay/route";

const root = resolve(process.cwd());

function standardRate(country: string): boolean {
  const resolved = resolveShippingOptions(country);
  return resolved.status === "priced" && resolved.options[0]?.amountMinor === 465;
}

type Result = "PASS" | "FAIL" | "BLOCKED";
type Row = { id: string; result: Result; detail: string };
const rows: Row[] = [];

function record(id: string, result: Result, detail: string) {
  rows.push({ id, result, detail });
}

function expect(id: string, ok: boolean, detail: string) {
  record(id, ok ? "PASS" : "FAIL", detail);
}

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function providerFor(country: string, currency?: string) {
  const resolved = resolvePaymentProvider({ country, currency });
  return resolved.ok ? resolved : null;
}

const PAYMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VARIANT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
/** Real guest cookie session ids are 64 hex characters. The HMAC key is separate. */
const SESSION_ID = "a".repeat(64);
const COOKIE_SECRET = "phase8-matrix-secret";
const NOW = 1_700_000_000_000;

function line(unitPriceMinor: number, variantId = VARIANT_ID): PendingPaymentLine {
  return {
    productId: "11111111-1111-4111-8111-111111111111",
    productVariantId: variantId,
    sku: "FRAME-01-BLK",
    productName: "Frame 01",
    colourName: "Black",
    variantName: null,
    quantity: 1,
    unitPriceMinor,
    lineTotalMinor: unitPriceMinor,
  };
}

function draft(lock: PublicCheckoutDraft["quoteLock"], country = "GB"): PublicCheckoutDraft {
  return {
    ...emptyCheckoutDraft(),
    step: "review",
    email: "ada@shadesuk.example",
    firstName: "Ada",
    lastName: "Lovelace",
    line1: "10 Example Street",
    city: "London",
    postcode: country === "GB" ? "E1 6AN" : "10115",
    country,
    addressEntry: "manual",
    quoteLock: lock,
  };
}

function pricedCatalogue(zoneId: string, amountMinor: number): ShippingCatalogue {
  return {
    ...V1_SHIPPING_CATALOGUE,
    methods: [
      ...V1_SHIPPING_CATALOGUE.methods,
      {
        id: `${zoneId}-matrix`,
        zoneId,
        code: "standard",
        label: "Matrix test delivery",
        estimatedDelivery: "2+ weeks",
        currency: "GBP",
        amountMinor,
        isActive: true,
      },
    ],
  };
}

void (async () => {
  const eurDisplay = presentCheckoutAmount({
    gbpMinor: 6500,
    chargeMinor: null,
    displayCurrency: "EUR",
    chargeCurrency: "EUR",
    rates: [{ currency: "EUR", rate: "1.1762" }],
    cents: true,
  });
  const eurShipping = presentCheckoutAmount({
    gbpMinor: 465,
    chargeMinor: null,
    displayCurrency: "EUR",
    chargeCurrency: "EUR",
    rates: [{ currency: "EUR", rate: "1.1762" }],
    cents: true,
  });
  const eurLocked = presentCheckoutAmount({
    gbpMinor: 6500,
    chargeMinor: 7645,
    displayCurrency: "EUR",
    chargeCurrency: "EUR",
    rates: [{ currency: "EUR", rate: "1.1762" }],
    cents: true,
  });
  const gbpShipping = presentCheckoutAmount({
    gbpMinor: 465,
    chargeMinor: null,
    displayCurrency: "GBP",
    chargeCurrency: "GBP",
    rates: [],
    cents: true,
  });
  const gbpBag = presentCheckoutAmount({
    gbpMinor: 6500,
    chargeMinor: null,
    displayCurrency: "GBP",
    chargeCurrency: "GBP",
    rates: [],
    cents: true,
  });
  const shopShipping = formatDisplayGbpMinor(465, "GBP", []);
  expect(
    "Display conversion",
    eurDisplay === formatChargeMinor(7645, "EUR") &&
      eurDisplay !== formatChargeMinor(6500, "EUR") &&
      !eurDisplay.includes("65.00") &&
      eurShipping === formatChargeMinor(547, "EUR") &&
      eurShipping !== formatChargeMinor(465, "EUR") &&
      !eurShipping.includes("4.65") &&
      eurLocked === formatChargeMinor(7645, "EUR"),
    "A checkout amount with no charge lock converts GBP through FX and keeps cents. A locked charge keeps its cents.",
  );
  expect(
    "Checkout GBP cents",
    gbpShipping === formatChargeMinor(465, "GBP") &&
      gbpShipping.includes("4.65") &&
      gbpShipping !== shopShipping &&
      gbpBag === formatChargeMinor(6500, "GBP") &&
      gbpBag.includes("65.00"),
    "Checkout GBP keeps exact pence. £4.65 shipping must not round to a whole pound.",
  );

  const ukShipping = resolveShippingOptions("GB");
  const ukLock = createCheckoutQuoteLock({
    countryCode: "GB",
    lines: [{ variantId: VARIANT_ID, quantity: 1, unitPriceMinor: 4900 }],
    now: NOW,
  });
  const ukAttempt = ukLock
    ? buildPendingPaymentAttempt({
        draft: draft(ukLock),
        lines: [line(4900)],
        now: NOW,
        createReference: () => "SHU-MATRIXUK0001",
      })
    : null;
  expect(
    "A UK offline path",
    ukShipping.status === "priced" &&
      ukShipping.options[0]?.amountMinor === UK_SHIPPING_RATE_MINOR &&
      ukShipping.options[0]?.amountMinor === 465 &&
      getAddressProvider("GB") === postcodesIoAddressLookupProvider &&
      providerFor("GB")?.provider === "paypal" &&
      ukLock?.chargeCurrency === "GBP" &&
      ukLock.paymentProvider === "paypal" &&
      ukAttempt?.ok === true &&
      ukAttempt.ok &&
      ukAttempt.attempt.payment.currency === "GBP" &&
      ukAttempt.attempt.payment.amount_minor === 5365 &&
      paypalAttemptSatisfiesChargeSnapshot(ukAttempt.attempt),
    "Postcodes.io provider, £4.65, GBP PayPal lock, snapshot checks. Live capture is a separate row.",
  );
  record(
    "A UK live capture",
    "BLOCKED",
    "No sandbox PayPal charge and no applied migrations in this run. Capture idempotency is covered offline under Concurrency.",
  );

  for (const country of ["DE", "AE", "IN"] as const) {
    const resolved = resolveShippingOptions(country);
    const quote = authoritativeCheckoutQuote({ subtotalMinor: 4900, country, shippingMinor: 9999, totalMinor: 1, currency: "EUR" });
    const rail = checkoutPaymentRail({ country });
    expect(
      `Standard shipping ${country}`,
      resolved.status === "priced" &&
        resolved.options[0]?.amountMinor === 465 &&
        quote.shippingMinor === 465 &&
        quote.shippingStatus === "priced" &&
        quoteIsChargeable(quote) &&
        quote.currency === "GBP" &&
        (country === "IN" ? rail === "india" : rail === "paypal"),
      `${country} uses £4.65. Client shipping and currency were ignored. Rail is ${rail}.`,
    );
  }
  const deProvider = getAddressProvider("DE");
  const aeProvider = getAddressProvider("AE");
  const inProvider = getAddressProvider("IN");
  expect(
    "B DE Geoapify / EUR / PayPal",
    deProvider !== null &&
      deProvider !== postcodesIoAddressLookupProvider &&
      providerFor("DE")?.provider === "paypal" &&
      providerFor("DE")?.currency === "EUR" &&
      createCheckoutQuoteLock({
        countryCode: "DE",
        lines: [{ variantId: VARIANT_ID, quantity: 1, unitPriceMinor: 4900 }],
        now: NOW,
      }) === null &&
      resolveShippingOptions("DE").status === "priced",
    "Mapping is Geoapify, EUR, PayPal. Shipping is £4.65. A EUR lock without an FX row is refused.",
  );
  record(
    "B DE full checkout",
    "BLOCKED",
    "Offline route is EUR on PayPal with £4.65 shipping. A live charge still needs an EUR fx_rates row and migration 20261005220000. No purchase was made.",
  );
  expect(
    "C AE Geoapify / USD / PayPal",
    aeProvider !== null &&
      aeProvider !== postcodesIoAddressLookupProvider &&
      providerFor("AE")?.provider === "paypal" &&
      providerFor("AE")?.currency === "USD" &&
      standardRate("AE") &&
      createCheckoutQuoteLock({
        countryCode: "AE",
        lines: [{ variantId: VARIANT_ID, quantity: 1, unitPriceMinor: 4900 }],
        now: NOW,
      }) === null,
    "Mapping is Geoapify, USD charge on PayPal, AED display. Shipping is £4.65. A USD lock without an FX row is refused.",
  );
  record(
    "C AE full checkout",
    "BLOCKED",
    "Offline route charges USD on PayPal and displays AED from the USD peg. A live charge still needs a USD fx_rates row and migration 20261005220000. No purchase was made.",
  );
  expect(
    "D IN Geoapify / INR / Razorpay",
    inProvider !== null &&
      checkoutPaymentRail({ country: "IN" }) === "india" &&
      providerFor("IN", "INR")?.provider === "razorpay" &&
      resolvePaymentProvider({ country: "IN", currency: "GBP" }).ok === false &&
      buildIndiaCharge({
        draft: draft(null, "IN"),
        lines: [line(4900)],
        now: NOW,
      }).ok === false,
    "India stays on Razorpay. Shipping is £4.65. A charge without an INR lock does not fall through to PayPal.",
  );
  record(
    "D IN full checkout",
    "BLOCKED",
    "Offline route is INR on Razorpay with £4.65 shipping. A live charge still needs an INR fx_rates row and migration 20261005220000. No purchase was made.",
  );

  const fxRefresh = await runFxRefresh({
    fetchBody: async () => {
      throw new Error("frankfurter down");
    },
    insert: async () => {
      throw new Error("insert must not run");
    },
    previous: [{ quoteCurrency: "EUR", rate: "1.1000", effectiveAt: "2026-10-01T00:00:00.000Z" }],
  });
  const ukWithoutFx = authoritativeCheckoutQuote({ subtotalMinor: 4900, country: "GB" });
  expect(
    "E FX failure",
    fxRefresh.ok === false &&
      fxRefresh.keptLastRates === true &&
      fxRefresh.inserted === 0 &&
      ukWithoutFx.shippingMinor === 465 &&
      quoteIsChargeable(ukWithoutFx) &&
      createCheckoutQuoteLock({
        countryCode: "DE",
        lines: [{ variantId: VARIANT_ID, quantity: 1, unitPriceMinor: 100 }],
        catalogue: pricedCatalogue("europe", 100),
        now: NOW,
      }) === null,
    "A failed refresh keeps the last rate and inserts nothing. UK checkout still prices £4.65. A non-GBP lock without an FX row is refused.",
  );
  record(
    "E live Frankfurter",
    "BLOCKED",
    "No Frankfurter call. Last-known-good behaviour is the offline refresh plan above.",
  );

  const ukLookupDown = await lookupAddresses("SW1A 1AA", {
    async search() {
      throw new Error("postcodes down");
    },
    async retrieve() {
      throw new Error("postcodes down");
    },
  });
  const geoMissing = await lookupAddresses(
    "Berlin Mitte",
    createGeoapifyProvider({ countryCode: "DE" }),
  );
  const addressUi = read("src/components/checkout/CheckoutAddress.tsx");
  const lookupUi = read("src/components/address/AddressLookup.tsx");
  const manualButton = lookupUi.indexOf("allowManual ?");
  const lookupError = lookupUi.indexOf('status === "error"');
  const ukPriced = resolveShippingOptions("GB").status === "priced";
  expect(
    "F lookup failure manual entry",
    ukLookupDown.status === "error" &&
      geoMissing.status === "unavailable" &&
      ukPriced &&
      addressUi.includes("allowManual={Boolean(priced)}") &&
      manualButton > lookupError &&
      lookupUi.includes("ENTER_ADDRESS_MANUALLY") &&
      resolveShippingOptions("DE").status === "priced" &&
      resolveShippingOptions("ZZ").status === "unsupported",
    "Supported countries keep manual entry when lookup fails. An unknown country is not priced. Geoapify without a key returns no address.",
  );
  record(
    "F live Geoapify",
    "BLOCKED",
    "No Geoapify or Postcodes.io network call. Manual entry is the priced-UK gate above.",
  );

  const deLock = createCheckoutQuoteLock({
    countryCode: "DE",
    lines: [{ variantId: VARIANT_ID, quantity: 1, unitPriceMinor: 100 }],
    fx: { id: "fx-eur", version: 1, rate: "1.1000" },
    catalogue: pricedCatalogue("europe", 100),
    now: NOW,
  });
  const checkoutService = read("src/services/checkout.ts");
  expect(
    "Edge country change",
    quoteLockForCountry(deLock, "GB") === null &&
      checkoutService.includes("draft.quoteLock = null") &&
      checkoutService.includes("checkoutQuoteFromCart(cart, draft.country)") &&
      standardRate("DE") &&
      providerFor("GB")?.currency === "GBP" &&
      providerFor("DE")?.currency === "EUR",
    "A country change drops the quote lock. Shipping, currency, and provider are resolved for the new country.",
  );

  expect(
    "Edge quote expiry",
    ukLock != null &&
      quoteLockExpired(ukLock, NOW + QUOTE_LOCK_TTL_MS) &&
      inspectCheckoutQuoteLock(ukLock, NOW + QUOTE_LOCK_TTL_MS).expired &&
      inspectCheckoutQuoteLock(ukLock, NOW + QUOTE_LOCK_TTL_MS).lock === null &&
      buildPendingPaymentAttempt({
        draft: draft(ukLock),
        lines: [line(4900)],
        now: NOW + QUOTE_LOCK_TTL_MS,
      }).ok === false,
    `A lock at ${QUOTE_LOCK_TTL_MS / 60000} minutes is refused and cannot start PayPal.`,
  );

  const cancelled = await captureOnce({
    payment: { status: "cancelled" },
    order: { payment_status: "cancelled" },
  });
  expect(
    "Edge payment cancel/fail",
    cancelled.outcome === "rejected" &&
      (cancelled.outcome === "rejected" ? cancelled.reason === "payment_cancelled" : false),
    "A cancelled payment is rejected before capture.",
  );
  const failedPayment = await captureOnce({
    payment: { status: "failed" },
    order: { payment_status: "failed" },
  });
  expect(
    "Edge payment failed",
    failedPayment.outcome === "rejected" && failedPayment.reason === "payment_failed",
    "A failed payment is rejected before capture.",
  );

  expect(
    "Edge unsupported country",
    resolveShippingOptions("ZZ").status === "unsupported" &&
      resolvePaymentProvider({ country: "ZZ" }).ok === false &&
      getAddressProvider("ZZ") === null &&
      resolveShippingOptions("JP").status === "priced" &&
      providerFor("JP")?.provider === "paypal" &&
      providerFor("JP")?.currency === "USD",
    "An unknown country has no zone, provider, or address lookup. Japan displays JPY and charges USD on PayPal.",
  );

  expect(
    "Edge unsupported currency",
    resolvePaymentProvider({ country: "GB", currency: "USD" }).ok === false &&
      resolvePaymentProvider({ country: "DE", currency: "GBP" }).ok === false &&
      resolvePaymentProvider({ country: "IN", currency: "EUR" }).ok === false,
    "A currency that is not the market currency is blocked before pay.",
  );

  const tamperedQuote = authoritativeCheckoutQuote({
    subtotalMinor: 4900,
    shippingMinor: 1,
    totalMinor: 1,
    currency: "EUR",
    country: "GB",
  });
  const tamperedAttempt = buildPendingPaymentAttempt({
    draft: draft(ukLock),
    lines: [line(4900)],
    clientQuote: { totalMinor: 1, currency: "EUR", shippingMinor: 1 },
    now: NOW,
  });
  const signed = encodeCheckoutDraftCookie(SESSION_ID, draft(ukLock), NOW, COOKIE_SECRET);
  const kept = decodeCheckoutDraftCookie(SESSION_ID, signed, NOW, COOKIE_SECRET);
  const flipped = signed.slice(0, -1) + (signed.endsWith("a") ? "b" : "a");
  const replayed = decodeCheckoutDraftCookie(SESSION_ID, flipped, NOW, COOKIE_SECRET);
  const editedLock = ukLock ? { ...ukLock, chargeTotalMinor: 1 } : null;
  const editedCookie = encodeCheckoutDraftCookie(SESSION_ID, draft(editedLock), NOW, COOKIE_SECRET);
  const edited = decodeCheckoutDraftCookie(SESSION_ID, editedCookie, NOW, COOKIE_SECRET);
  expect(
    "Audit tamper amount",
    isGuestCartSessionId(SESSION_ID) &&
      tamperedQuote.totalMinor === 5365 &&
      tamperedQuote.currency === "GBP" &&
      tamperedAttempt.ok === true &&
      tamperedAttempt.ok &&
      tamperedAttempt.attempt.payment.amount_minor === 5365 &&
      tamperedAttempt.attempt.payment.currency === "GBP" &&
      kept.quoteLock?.chargeTotalMinor === ukLock?.chargeTotalMinor &&
      kept.quoteLock?.frozenAt === NOW &&
      replayed.quoteLock === null &&
      edited.quoteLock === null &&
      editedCookie !== signed &&
      quoteLockExpired({ frozenAt: NOW }, NOW + QUOTE_LOCK_TTL_MS),
    "Client amount, currency, and total are ignored. A valid 64-hex session cookie keeps its lock. A flipped signature and an edited lock are dropped. A 45-minute-old lock is expired.",
  );

  const reuse = decideIndiaAttemptReuse({
    open: {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      orderReference: "SHU-MATRIXIN0001",
      providerOrderId: "order_MatrixReuse01",
      amountMinor: 20000,
      currency: "INR",
      frozenAt: NOW,
      userId: null,
      email: "ada@shadesuk.example",
      status: "created",
      lines: [{ variantId: VARIANT_ID, quantity: 1 }],
    },
    ownerUserId: null,
    email: "ada@shadesuk.example",
    frozenAt: NOW,
    amountMinor: 20000,
    lines: [{ variantId: VARIANT_ID, quantity: 1 }],
  });
  expect(
    "Audit India double-click",
    reuse === "reuse",
    "A second India start with the same owner, amount, and frozen quote reuses the Razorpay order.",
  );

  const concurrent = await concurrentCapture();
  expect(
    "Audit PayPal concurrent capture",
    concurrent.outcome === "already_captured" && concurrent.emails === 0 && concurrent.stockDecrements === 0,
    "When capture returns null because the other caller won, the second caller does not email or decrement stock.",
  );

  const paypalGet = await paypalWebhookGet();
  const razorpayGet = await razorpayWebhookGet();
  const badPaypal = await handlePayPalWebhook(
    {
      rawBody: "{}",
      transmissionId: "tx",
      transmissionTime: "2026-10-05T12:00:00Z",
      transmissionSig: "sig",
      certUrl: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT",
      authAlgo: "SHA256withRSA",
    },
    {
      webhookId: "WHID_TEST",
      verifySignature: async () => ({ ok: false, error: "bad signature" }),
    },
  );
  process.env.RAZORPAY_KEY_ID = "rzp_test_phase8matrix";
  process.env.RAZORPAY_KEY_SECRET = "test_secret_phase8";
  process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_phase8";
  const raw = JSON.stringify({ event: "payment.captured" });
  const badRazorpay = await handleRazorpayWebhook({ rawBody: raw, signature: "00" });
  const goodSig = razorpayWebhookSignatureMatches(raw, "00", "test_webhook_phase8");
  const declined = await declinedWebhook();
  const paypalRetry = await paypalTemporaryRetry();
  expect(
    "Audit webhooks",
    paypalGet.status === 405 &&
      razorpayGet.status === 405 &&
      badPaypal.status === 400 &&
      badRazorpay.status === 400 &&
      goodSig === false &&
      declined.status === 200 &&
      declined.failed === true &&
      paypalRetry === 503 &&
      indiaWebhookHttpStatus({ status: "error", terminal: true }) === 200 &&
      indiaWebhookHttpStatus({ status: "error", terminal: false }) === 409,
    "Bad signatures are 400. GET is 405. A PayPal decline is 200 and marks the payment failed. A PayPal capture whose payment row is not visible yet returns 503. India permanent errors are 200 and temporary errors are 409.",
  );

  const review = read("src/components/checkout/CheckoutReview.tsx");
  const reviewLine = review.slice(review.indexOf("function formatReviewLine"));
  expect(
    "Review lock currency",
    reviewLine.includes("lock.chargeCurrency === chargeCurrency") &&
      reviewLine.includes("lockMatchesRoute") &&
      reviewLine.includes("cents: displayCurrency === chargeCurrency"),
    "A Review line uses the locked charge only when that lock currency is the current route.",
  );
  const indiaUi = read("src/components/checkout/IndiaPayment.tsx");
  const indiaBranch = review.slice(review.indexOf("{india ? ("), review.indexOf("{payable ? ("));
  const paypalBranch = review.slice(review.indexOf("{payable ? ("));
  expect(
    "Audit routing",
    review.includes("paypalCurrency") &&
      review.includes("chargeDisclosure") &&
      review.includes("if (!slot || pending || !payable)") &&
      indiaBranch.includes("<IndiaPayment") &&
      !indiaBranch.includes("mountPayPalCheckout") &&
      !indiaBranch.includes("data-paypal-button") &&
      paypalBranch.includes("data-paypal-button") &&
      indiaUi.includes('configured === "unavailable"') &&
      resolveShippingOptions("DE").status === "priced" &&
      resolveShippingOptions("US").status === "priced" &&
      buildPendingPaymentAttempt({
        draft: draft(null, "DE"),
        lines: [line(4900)],
        now: NOW,
      }).ok === false &&
      buildPendingPaymentAttempt({
        draft: draft(null, "US"),
        lines: [line(4900)],
        now: NOW,
      }).ok === false,
    "The India branch renders IndiaPayment and does not mount PayPal. PayPal stays behind the payable gate. DE and US without an FX lock cannot start a payment attempt.",
  );

  const indiaNotice = read("src/components/checkout/IndiaCardPaymentNotice.tsx");
  const indiaCopy = read("src/lib/checkout-copy.ts");
  const indiaAvailability = read("src/lib/payment/india-card-availability.ts");
  const razorpayConfig = read("src/lib/razorpay/config.ts");
  const cartRoute = read("src/app/(storefront)/cart/page.tsx");
  const cartUi = read("src/components/cart/CartPage.tsx");
  const checkoutRoute = read("src/app/(storefront)/checkout/page.tsx");
  const checkoutUi = read("src/components/checkout/CheckoutPage.tsx");
  const unavailableUi = indiaUi.slice(
    indiaUi.indexOf('if (configured === "unavailable")'),
    indiaUi.indexOf("return (\n    <div>"),
  );
  const addressStep = checkoutUi.slice(
    checkoutUi.indexOf('{step === "address" && indiaCardNotice'),
    checkoutUi.indexOf("{step === \"contact\""),
  );
  const statusForStart = indiaUi.slice(indiaUi.indexOf("function statusForStart"));
  expect(
    "India card notice",
    indiaCopy.includes(
      "Card payment for India isn't available right now. Your bag is saved. Please try again shortly.",
    ) &&
      indiaCopy.includes("Prices have moved since you started. Update your total to continue.") &&
      indiaCopy.includes("A price in your bag has changed. Update your total to continue.") &&
      !checkoutUi.includes("CHECKOUT_LOCK_EXPIRED") &&
      indiaNotice.includes("INDIA_CARD_PAYMENT_UNAVAILABLE") &&
      indiaNotice.includes('role="status"') &&
      !indiaNotice.includes("InlineError") &&
      !indiaNotice.includes('role="alert"') &&
      indiaAvailability.includes("resolveRazorpayServerConfig().ok") &&
      !indiaAvailability.includes("INDIA_PAYMENTS") &&
      razorpayConfig.includes("rzp_test_") &&
      razorpayConfig.includes('reason: "live_key"') &&
      cartRoute.includes("indiaCardPaymentConfigured()") &&
      checkoutRoute.includes("indiaCardPaymentConfigured()") &&
      !checkoutRoute.toLowerCase().includes("razorpay") &&
      !checkoutUi.toLowerCase().includes("razorpay") &&
      cartUi.includes("IndiaCardPaymentNotice") &&
      cartUi.includes('normalizeCountry(country) === "IN"') &&
      checkoutUi.includes("IndiaCardPaymentNotice") &&
      addressStep.includes("<IndiaCardPaymentNotice />") &&
      indiaBranch.includes("!indiaCardPaymentReady") &&
      indiaBranch.includes("<IndiaCardPaymentNotice") &&
      indiaBranch.indexOf("<IndiaCardPaymentNotice") < indiaBranch.indexOf("<IndiaPayment") &&
      indiaBranch.includes("CHECKOUT_TOTAL_UPDATED") &&
      indiaBranch.includes("<QuoteHold") &&
      !indiaBranch.includes("CHECKOUT_QUOTE_STALE") &&
      !indiaBranch.includes("UPDATE_TOTAL") &&
      review.includes("supportedCountry(draft.country)?.name") &&
      !review.includes("UNITED_KINGDOM") &&
      unavailableUi.includes("<IndiaCardPaymentNotice") &&
      !unavailableUi.includes("CHECKOUT_QUOTE_STALE") &&
      !unavailableUi.includes("UPDATE_TOTAL") &&
      statusForStart.includes('status === "unavailable"') &&
      statusForStart.includes("INDIA_CARD_PAYMENT_UNAVAILABLE") &&
      statusForStart.indexOf('status === "unavailable"') < statusForStart.indexOf("return CHECKOUT_QUOTE_STALE"),
    "India card payment uses the server config check. Unavailable is a quiet notice on the bag, Delivery, and Review. A moved total still offers Update total. The test-key guard stays.",
  );

  const payableExpr = review.slice(review.indexOf("const payable ="), review.indexOf("const disclosure"));
  const paypalStart = review.slice(
    review.indexOf('if (started.status !== "ok")'),
    review.indexOf("paymentIdRef.current = started.paymentId"),
  );
  expect(
    "GB expired lock recovery",
    payableExpr.includes("!draft.lockExpired") &&
      payableExpr.includes('paypalCurrency === "GBP"') &&
      review.includes("function paypalQuoteMoved") &&
      paypalStart.includes("paypalQuoteMoved(started.status)") &&
      paypalStart.includes("setOfferTotalRefresh(true)") &&
      paypalStart.indexOf("setOfferTotalRefresh(true)") < paypalStart.indexOf("PAYMENT_START_ERROR") &&
      review.includes("<QuoteHold") &&
      review.includes("CHECKOUT_TOTAL_UPDATED") &&
      review.includes("UPDATE_TOTAL") &&
      review.includes("data-checkout-review") &&
      review.includes("if (!slot || pending || !payable)") &&
      review.includes("{payable ? (") &&
      review.slice(review.indexOf("{payable ? (")).includes("offerTotalRefresh") &&
      review.slice(review.indexOf("{payable ? (")).indexOf("offerTotalRefresh") <
        review.slice(review.indexOf("{payable ? (")).indexOf("data-paypal-button") &&
      review.includes("data-paypal-button"),
    "An expired GB lock is not a live PayPal button. Review keeps Update total, including when PayPal start returns expired or stale.",
  );

  const grants = read("supabase/migrations/20261005210000_customer_role_checkout_grants.sql");
  const snapshot = read("supabase/migrations/20261005200000_order_charge_snapshots.sql");
  const initial = read("supabase/migrations/20260914230750_initial_production_schema.sql");
  expect(
    "Audit database grants",
    grants.includes("revoke all on table public.fx_rates from public, anon, authenticated") &&
      grants.includes("drop policy if exists fx_rates_public_read") &&
      grants.includes("revoke all on table public.payments from public, anon, authenticated") &&
      grants.includes("drop policy if exists payments_admin_read on public.payments") &&
      initial.includes("public.payments") &&
      snapshot.includes("revoke all on table public.order_charge_snapshots from anon") &&
      snapshot.includes("revoke all on table public.order_charge_snapshots from authenticated") &&
      snapshot.includes("revoke all on table public.order_charge_snapshots from service_role") &&
      snapshot.includes("before update or delete") &&
      snapshot.includes("order_charge_snapshots are write-once") &&
      snapshot.includes("revoke all on function public.mark_paypal_payment_captured") &&
      snapshot.includes("revoke all on function public.mark_india_payment_captured") &&
      snapshot.includes("grant execute on function public.mark_paypal_payment_captured(uuid, text, text) to service_role") &&
      snapshot.includes("grant execute on function public.mark_india_payment_captured(uuid, uuid, text) to service_role"),
    "After this migration, anon and authenticated lose every privilege on fx_rates and payments. The unused payments admin read policy is dropped. Snapshot writes and capture functions stay service_role only.",
  );
  record(
    "Audit Supabase advisors",
    "BLOCKED",
    "Migrations are not applied in this run. Run Supabase advisors after Syed applies Phase 6, Phase 7, and this grant migration.",
  );

  const cheaperPaypal = buildPendingPaymentAttempt({
    draft: draft(ukLock),
    lines: [line(1000)],
    now: NOW,
  });
  const indiaLock = createCheckoutQuoteLock({
    countryCode: "IN",
    lines: [{ variantId: VARIANT_ID, quantity: 1, unitPriceMinor: 4900 }],
    fx: { id: "fx-inr", version: 2, rate: "100" },
    catalogue: pricedCatalogue("india", 465),
    now: NOW,
  });
  const cheaperIndia = indiaLock
    ? buildIndiaCharge({
        draft: draft(indiaLock, "IN"),
        lines: [line(1000)],
        now: NOW,
        shippingQuote: {
          status: "priced",
          countryCode: "IN",
          zoneId: "india",
          options: [
            {
              methodId: "india-matrix",
              zoneId: "india",
              code: "standard",
              label: "Matrix test delivery",
              estimatedDelivery: "2+ weeks",
              currency: "GBP",
              amountMinor: 465,
            },
          ],
        },
      })
    : null;
  expect(
    "Audit price drop",
    ukLock != null &&
      liveTotalUndercutsLock(ukLock, 1000 + 465) &&
      cheaperPaypal.ok === false &&
      indiaLock != null &&
      cheaperIndia?.ok === false &&
      cheaperIndia?.reason === "stale",
    "A lower live line price blocks PayPal. The same undercut blocks India. Production India shipping is the £4.65 standard rate.",
  );

  const inrRate = "127.32";
  const inrRates = [{ currency: "INR", rate: inrRate }];
  const inrLock = createCheckoutQuoteLock({
    countryCode: "IN",
    lines: [{ variantId: VARIANT_ID, quantity: 1, unitPriceMinor: 6599 }],
    fx: { id: "fx-inr-12732", version: 3, rate: inrRate },
    now: NOW,
  });
  const inrGrand = getLocalizedPrice({
    baseAmountMinor: 6599 + 465,
    baseCurrency: "GBP",
    targetCurrency: "INR",
    fxRate: inrRate,
    fxRateId: "fx-inr-12732",
    fxVersion: 3,
  });
  const inrShown = sumPresentedCheckoutMinors({
    parts: [{ gbpMinor: 6599 }, { gbpMinor: 465 }],
    displayCurrency: "INR",
    chargeCurrency: "INR",
    rates: inrRates,
  });
  const inrCharge = inrLock
    ? buildIndiaCharge({
        draft: draft(inrLock, "IN"),
        lines: [line(6599)],
        now: NOW,
        createReference: () => "SHU-MATRIXIN0001",
      })
    : null;
  const inrLockTotal = inrLock?.chargeTotalMinor ?? null;
  const inrGrandTotal = inrGrand.ok ? inrGrand.price.amountMinor : null;
  expect(
    "Charge line sum INR",
    inrLock != null &&
      inrGrand.ok &&
      inrLockTotal != null &&
      inrGrandTotal != null &&
      inrLockTotal !== inrGrandTotal &&
      inrLock.chargeSubtotalMinor === 840185 &&
      inrLock.chargeShippingMinor === 59204 &&
      inrLockTotal === 899389 &&
      inrLock.chargeTotalMinor === inrLock.chargeSubtotalMinor + inrLock.chargeShippingMinor &&
      inrGrandTotal === 899388 &&
      inrShown?.minor === 899389 &&
      presentCheckoutPartsTotal({
        parts: [{ gbpMinor: 6599 }, { gbpMinor: 465 }],
        displayCurrency: "INR",
        chargeCurrency: "INR",
        rates: inrRates,
      }) === formatChargeMinor(899389, "INR") &&
      inrCharge?.ok === true &&
      inrCharge.ok &&
      inrCharge.charge.payment.amountMinor === 899389,
    "£65.99 + £4.65 at 127.32 is ₹8993.89 (899389 paise). Converting £70.64 is 899388 and is not the charge.",
  );

  const diverged = divergentCharge("1.005", 465);
  const eurLock = diverged
    ? createCheckoutQuoteLock({
        countryCode: "FR",
        lines: [{ variantId: VARIANT_ID, quantity: 1, unitPriceMinor: diverged.subtotal }],
        fx: { id: "fx-eur-div", version: 1, rate: "1.005" },
        now: NOW,
      })
    : null;
  const usdLock = diverged
    ? createCheckoutQuoteLock({
        countryCode: "US",
        lines: [{ variantId: VARIANT_ID, quantity: 1, unitPriceMinor: diverged.subtotal }],
        fx: { id: "fx-usd-div", version: 1, rate: "1.005" },
        now: NOW,
      })
    : null;
  const eurAttempt = eurLock
    ? buildPendingPaymentAttempt({
        draft: draft(eurLock, "FR"),
        lines: [line(diverged?.subtotal ?? 0)],
        clientQuote: { totalMinor: 1, currency: "EUR", total: 0.01 },
        now: NOW,
        createReference: () => "SHU-MATRIXEU0001",
      })
    : null;
  const usdAttempt = usdLock
    ? buildPendingPaymentAttempt({
        draft: draft(usdLock, "US"),
        lines: [line(diverged?.subtotal ?? 0)],
        clientQuote: { totalMinor: 1, currency: "USD" },
        now: NOW,
        createReference: () => "SHU-MATRIXUS0001",
      })
    : null;
  expect(
    "Charge line sum EUR USD",
    diverged != null &&
      eurLock != null &&
      usdLock != null &&
      eurLock.chargeTotalMinor === diverged.summed &&
      usdLock.chargeTotalMinor === diverged.summed &&
      eurLock.chargeTotalMinor !== diverged.grand &&
      usdLock.chargeTotalMinor !== diverged.grand &&
      eurAttempt?.ok === true &&
      usdAttempt?.ok === true &&
      eurAttempt.ok &&
      usdAttempt.ok &&
      eurAttempt.attempt.payment.amount_minor === diverged.summed &&
      usdAttempt.attempt.payment.amount_minor === diverged.summed &&
      eurAttempt.attempt.paypal.amountMinor !== 1 &&
      usdAttempt.attempt.paypal.amountMinor !== 1,
    "Where convert-each-line and convert-total differ by a minor unit, EUR and USD charges use the line sum. A browser total is ignored.",
  );

  const aedRates = [{ currency: "USD", rate: "1.27" }];
  const aedGap = divergentDisplay("AED", aedRates, 465);
  const audRates = [{ currency: "AUD", rate: "1.92" }, { currency: "USD", rate: "1.27" }];
  const audSame = matchingDisplay("AUD", audRates, 465);
  expect(
    "Display line sum AED AUD",
    aedGap != null &&
      aedGap.summed !== aedGap.grand &&
      sumPresentedCheckoutMinors({
        parts: [{ gbpMinor: aedGap.subtotal }, { gbpMinor: 465 }],
        displayCurrency: "AED",
        chargeCurrency: "USD",
        rates: aedRates,
      })?.minor === aedGap.summed &&
      presentCheckoutPartsTotal({
        parts: [{ gbpMinor: aedGap.subtotal }, { gbpMinor: 465 }],
        displayCurrency: "AED",
        chargeCurrency: "USD",
        rates: aedRates,
      }) === formatDisplayMinor(aedGap.summed, "AED") &&
      audSame != null &&
      sumPresentedCheckoutMinors({
        parts: [{ gbpMinor: audSame.subtotal }, { gbpMinor: 465 }],
        displayCurrency: "AUD",
        chargeCurrency: "USD",
        rates: audRates,
      })?.minor === audSame.summed &&
      audSame.summed === audSame.grand,
    "AED review total is the sum of the rounded shown lines. AUD stays the sum when those lines already agree.",
  );

  const summarySource = read("src/components/checkout/CheckoutSummary.tsx");
  const refreshSource = read("src/services/checkout.ts");
  const refreshFn = refreshSource.slice(
    refreshSource.indexOf("export async function refreshCheckoutTotal"),
    refreshSource.indexOf("async function loadCheckout"),
  );
  const refreshAction = read("src/app/(storefront)/checkout/actions.ts");
  const refreshActionFn = refreshAction.slice(
    refreshAction.indexOf("export async function refreshCheckoutTotalAction"),
    refreshAction.indexOf("export async function restartCheckoutDraftAction"),
  );
  const checkoutPage = read("src/components/checkout/CheckoutPage.tsx");
  expect(
    "Update total guardrail",
    summarySource.includes("presentCheckoutPartsTotal") &&
      !summarySource.includes("money(quote.totalMinor") &&
      refreshFn.includes("closeCheckoutPaymentAttempt") &&
      refreshFn.indexOf("closeCheckoutPaymentAttempt") < refreshFn.indexOf("freezeSavedQuote") &&
      refreshFn.includes("clearInvalidPaymentAttemptCookie") &&
      refreshFn.includes("clearPaymentAttemptId") &&
      refreshFn.indexOf("clearPaymentAttemptId") < refreshFn.indexOf("freezeSavedQuote") &&
      refreshFn.includes('"cancelled"') &&
      refreshFn.includes("Checkout total refreshed.") &&
      refreshFn.includes("} catch {") &&
      refreshFn.indexOf("} catch {") < refreshFn.indexOf("freezeSavedQuote") &&
      refreshFn.includes("freezeSavedQuote") &&
      refreshFn.includes("quoteLock: frozen.lock") &&
      refreshFn.includes("lockExpired: false") &&
      !refreshFn.includes("frozenAt:") &&
      !refreshFn.includes("quoteLock.frozenAt") &&
      refreshActionFn.includes("clientSuppliedCheckoutMoney") &&
      clientSuppliedCheckoutMoney({ total: 344 }) &&
      clientSuppliedCheckoutMoney({ totalMinor: 1 }) &&
      clientSuppliedCheckoutMoney({ amountMinor: 1 }) &&
      clientSuppliedCheckoutMoney({ frozenAt: 1 }) &&
      !clientSuppliedCheckoutMoney({}) &&
      QUOTE_LOCK_TTL_MS === 45 * 60 * 1000 &&
      checkoutPage.includes("refreshCheckoutTotalAction()") &&
      checkoutPage.includes("current.line1.trim() && !next.line1.trim()") &&
      lookupUsesAutocomplete("FR") &&
      lookupUsesAutocomplete("US") &&
      lookupUsesAutocomplete("AU") &&
      !lookupUsesAutocomplete("GB"),
    "Update total freezes a new lock and rejects a browser amount. Delivery keeps a filled address. France autocompletes.",
  );

  const closeStore = read("src/lib/payment/pending-store.ts");
  const closeFn = closeStore.slice(
    closeStore.indexOf("async closeOpenAttempt"),
    closeStore.indexOf("export function parsePaymentRow"),
  );
  expect(
    "Cancel write stops refresh",
    closeFn.includes("if (paymentResult.error)") &&
      closeFn.includes("if (orderResult.error)") &&
      closeFn.includes('throw new Error("Payment attempt cancel failed.")') &&
      refreshFn.indexOf("} catch {") < refreshFn.indexOf("const frozen = await freezeSavedQuote") &&
      refreshFn.indexOf("clearInvalidPaymentAttemptCookie") < refreshFn.indexOf("const frozen = await freezeSavedQuote") &&
      refreshFn.indexOf("if (!closed)") < refreshFn.indexOf("const frozen = await freezeSavedQuote"),
    "A Supabase cancel error does not freeze a new lock. A bad attempt cookie is cleared and refresh continues.",
  );

  const refreshedCapture = await captureAfterRefreshCancel();
  expect(
    "Refresh cancels open attempt",
    refreshedCapture.closed &&
      refreshedCapture.outcome === "rejected" &&
      refreshedCapture.reason === "payment_cancelled",
    "Refreshing the total cancels this browser's open PayPal attempt. Capturing that old attempt is rejected.",
  );

  printRows();
  if (rows.some((row) => row.result === "FAIL")) {
    process.exitCode = 1;
  }
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

function divergentCharge(
  rateText: string,
  shippingMinor: number,
): { subtotal: number; summed: number; grand: number } | null {
  const rate = parsePositiveDecimalRate(rateText);
  if (!rate) {
    return null;
  }
  for (let subtotal = 1; subtotal <= 8000; subtotal += 1) {
    const part = multiplyMinorByRateHalfUp(subtotal, rate);
    const shipping = multiplyMinorByRateHalfUp(shippingMinor, rate);
    const grand = multiplyMinorByRateHalfUp(subtotal + shippingMinor, rate);
    if (part == null || shipping == null || grand == null) {
      continue;
    }
    const summed = part + shipping;
    if (summed !== grand) {
      return { subtotal, summed, grand };
    }
  }
  return null;
}

function divergentDisplay(
  currency: string,
  rates: readonly { currency: string; rate: string }[],
  shippingMinor: number,
): { subtotal: number; summed: number; grand: number } | null {
  for (let subtotal = 100; subtotal <= 20000; subtotal += 1) {
    const part = displayMinorFromGbp(subtotal, currency, rates);
    const shipping = displayMinorFromGbp(shippingMinor, currency, rates);
    const grand = displayMinorFromGbp(subtotal + shippingMinor, currency, rates);
    if (part == null || shipping == null || grand == null) {
      continue;
    }
    if (part + shipping !== grand) {
      return { subtotal, summed: part + shipping, grand };
    }
  }
  return null;
}

function matchingDisplay(
  currency: string,
  rates: readonly { currency: string; rate: string }[],
  shippingMinor: number,
): { subtotal: number; summed: number; grand: number } | null {
  for (let subtotal = 1000; subtotal <= 20000; subtotal += 50) {
    const part = displayMinorFromGbp(subtotal, currency, rates);
    const shipping = displayMinorFromGbp(shippingMinor, currency, rates);
    const grand = displayMinorFromGbp(subtotal + shippingMinor, currency, rates);
    if (part == null || shipping == null || grand == null) {
      continue;
    }
    if (part + shipping === grand && part > 0 && shipping > 0) {
      return { subtotal, summed: part + shipping, grand };
    }
  }
  return null;
}

function printRows() {
  const width = Math.max(...rows.map((row) => row.id.length));
  for (const row of rows) {
    console.log(`${row.result.padEnd(7)} ${row.id.padEnd(width)}  ${row.detail}`);
  }
}

async function captureAfterRefreshCancel(): Promise<{
  closed: boolean;
  outcome: string;
  reason?: string;
}> {
  const memory = memoryCapture();
  const pendingStore: PendingPaymentStore = {
    async insertAttempt() {
      throw new Error("Refresh must not insert a payment.");
    },
    async attachProviderOrderId() {
      throw new Error("Refresh must not attach a provider order.");
    },
    async markInitiationFailed() {
      throw new Error("Refresh must not fail initiation.");
    },
    async loadOpenAttempt() {
      return null;
    },
    async closeOpenAttempt(paymentId, status, reason) {
      if (paymentId !== memory.state.payment.id) {
        return;
      }
      memory.state.payment = {
        ...memory.state.payment,
        status,
        failure_reason: reason,
      };
      memory.state.order = { ...memory.state.order, payment_status: status };
    },
  };
  const closed = await closeCheckoutPaymentAttempt(
    PAYMENT_ID,
    "cancelled",
    "Checkout total refreshed.",
    { store: pendingStore, boundPaymentId: PAYMENT_ID },
  );
  const captured = await captureVerifiedPayment(verifiedInput(), {
    store: memory.store,
    resolveCheckoutSessionId: async () => null,
    onVerifiedPaymentCaptured: async () => undefined,
  });
  return {
    closed,
    outcome: captured.outcome,
    reason: captured.outcome === "rejected" ? captured.reason : undefined,
  };
}

async function captureOnce(input: {
  payment?: Partial<PaymentRow>;
  order?: Partial<OrderRow>;
}) {
  const memory = memoryCapture();
  memory.state.payment = { ...memory.state.payment, ...input.payment };
  memory.state.order = { ...memory.state.order, ...input.order };
  return captureVerifiedPayment(verifiedInput(), {
    store: memory.store,
    resolveCheckoutSessionId: async () => null,
    onVerifiedPaymentCaptured: async () => undefined,
  });
}

async function concurrentCapture() {
  const memory = memoryCapture();
  let emails = 0;
  memory.store.capturePayment = async () => {
    memory.state.payment = {
      ...memory.state.payment,
      status: "captured",
      captured_at: new Date().toISOString(),
      provider_payment_id: "8MC585209K746392H",
    };
    return null;
  };
  const outcome = await captureVerifiedPayment(verifiedInput(), {
    store: memory.store,
    resolveCheckoutSessionId: async () => null,
    onVerifiedPaymentCaptured: async () => {
      emails += 1;
    },
  });
  return { outcome: outcome.outcome, emails, stockDecrements: memory.state.decrementCalls };
}

async function paypalTemporaryRetry(): Promise<number> {
  const store: PaymentWebhookStore = {
    async insertUnprocessedEvent(input) {
      return {
        id: "evt-retry",
        provider: "paypal",
        provider_event_id: input.providerEventId,
        event_type: input.eventType,
        payload: {},
        processed: false,
        processed_at: null,
        created_at: "2026-10-05T12:00:00.000Z",
      };
    },
    async loadEvent() {
      return null;
    },
    async markEventProcessed() {
      return null;
    },
    async loadPaymentByProviderOrderId() {
      return null;
    },
    async loadPaymentByProviderPaymentId() {
      return null;
    },
    async markPaymentFailed() {
      return null;
    },
  };
  const body = JSON.stringify({
    id: "evt-retry",
    event_type: PAYPAL_PAYMENT_CAPTURE_COMPLETED,
    resource: {
      id: "8MC585209K746392H",
      amount: { value: "53.65", currency_code: "GBP" },
      supplementary_data: { related_ids: { order_id: "5O190127TN364715T" } },
    },
  });
  const result = await handlePayPalWebhook(
    {
      rawBody: body,
      transmissionId: "tx",
      transmissionTime: "2026-10-05T12:00:00.000Z",
      transmissionSig: "sig",
      certUrl: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT",
      authAlgo: "SHA256withRSA",
    },
    {
      webhookId: "WHID_TEST",
      store,
      verifySignature: async () => ({ ok: true, verificationStatus: "SUCCESS" }),
    },
  );
  return result.status;
}

async function declinedWebhook() {
  let failed = false;
  const store: PaymentWebhookStore = {
    async insertUnprocessedEvent(input) {
      return {
        id: "evt-1",
        provider: "paypal",
        provider_event_id: input.providerEventId,
        event_type: input.eventType,
        payload: {},
        processed: false,
        processed_at: null,
        created_at: "2026-10-05T12:00:00.000Z",
      };
    },
    async loadEvent() {
      return null;
    },
    async markEventProcessed(providerEventId) {
      return {
        id: "evt-1",
        provider: "paypal",
        provider_event_id: providerEventId,
        event_type: PAYPAL_PAYMENT_CAPTURE_DECLINED,
        payload: {},
        processed: true,
        processed_at: "2026-10-05T12:00:00.000Z",
        created_at: "2026-10-05T12:00:00.000Z",
      };
    },
    async loadPaymentByProviderOrderId() {
      return { payment: paymentRow(), order: orderRow() };
    },
    async loadPaymentByProviderPaymentId() {
      return null;
    },
    async markPaymentFailed() {
      failed = true;
      return { ...paymentRow(), status: "failed", failure_reason: "declined" };
    },
  };
  const body = JSON.stringify({
    id: "evt-declined",
    event_type: PAYPAL_PAYMENT_CAPTURE_DECLINED,
    resource: {
      id: "8MC585209K746392H",
      amount: { value: "53.65", currency_code: "GBP" },
      supplementary_data: { related_ids: { order_id: "5O190127TN364715T" } },
    },
  });
  const result = await handlePayPalWebhook(
    {
      rawBody: body,
      transmissionId: "tx",
      transmissionTime: "2026-10-05T12:00:00.000Z",
      transmissionSig: "sig",
      certUrl: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT",
      authAlgo: "SHA256withRSA",
    },
    {
      webhookId: "WHID_TEST",
      store,
      verifySignature: async () => ({ ok: true, verificationStatus: "SUCCESS" }),
    },
  );
  return { status: result.status, failed };
}

function verifiedInput() {
  return {
    outcome: "verified" as const,
    paymentId: PAYMENT_ID,
    orderId: ORDER_ID,
    orderReference: "SHU-MATRIXUK0001",
    providerOrderId: "5O190127TN364715T",
    providerPaymentId: "8MC585209K746392H",
    amountMinor: 5365,
    currency: "GBP" as const,
    paymentStatus: "created" as const,
    orderPaymentStatus: "created" as const,
  };
}

function paymentRow(): PaymentRow {
  return {
    id: PAYMENT_ID,
    order_id: ORDER_ID,
    provider: "paypal",
    provider_order_id: "5O190127TN364715T",
    provider_payment_id: null,
    amount_minor: 5365,
    currency: "GBP",
    status: "created",
    failure_reason: null,
    captured_at: null,
    created_at: "2026-10-05T12:00:00.000Z",
    updated_at: "2026-10-05T12:00:00.000Z",
  };
}

function orderRow(): OrderRow {
  return {
    id: ORDER_ID,
    order_reference: "SHU-MATRIXUK0001",
    user_id: null,
    customer_email: "ada@shadesuk.example",
    customer_first_name: "Ada",
    customer_last_name: "Lovelace",
    status: "checkout",
    payment_status: "created",
    currency: "GBP",
    subtotal_minor: 4900,
    shipping_minor: 465,
    total_minor: 5365,
    delivery_address: { country: "GB" },
    created_at: "2026-10-05T12:00:00.000Z",
    updated_at: "2026-10-05T12:00:00.000Z",
  };
}

function memoryCapture() {
  const state: {
    payment: PaymentRow;
    order: OrderRow;
    items: OrderItemRow[];
    decrementCalls: number;
  } = {
    payment: paymentRow(),
    order: orderRow(),
    items: [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
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
        created_at: "2026-10-05T12:00:00.000Z",
      },
    ],
    decrementCalls: 0,
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
      if (state.payment.status !== "created" && state.payment.status !== "authorized") {
        return null;
      }
      state.payment = {
        ...state.payment,
        status: "captured",
        captured_at: input.capturedAt,
        provider_payment_id: input.providerPaymentId,
      };
      return { ...state.payment };
    },
    async markOrderPaymentCaptured() {
      state.order = { ...state.order, payment_status: "captured" };
      return { ...state.order };
    },
    async loadVariantStock() {
      return new Map([[VARIANT_ID, 4]]);
    },
    async decrementVariantStock() {
      state.decrementCalls += 1;
      return true;
    },
    async convertActiveCheckoutCart() {
      return "converted";
    },
  };
  return { state, store };
}
