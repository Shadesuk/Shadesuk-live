/**
 * Phase 5 quote lock. GBP charge stays frozen. Localized amounts are stored
 * and are not sent to PayPal.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGuestCartSessionId } from "../src/contracts/cart/session";
import {
  CHECKOUT_DRAFT_COOKIE_MAX_LENGTH,
  decodeCheckoutDraftCookie,
  encodeCheckoutDraftCookie,
} from "../src/lib/checkout-draft";
import {
  checkoutQuoteFromLock,
  createCheckoutQuoteLock,
  inspectCheckoutQuoteLock,
  parseCheckoutQuoteLock,
  QUOTE_LOCK_TTL_MS,
  quoteLockForCountry,
  type CheckoutQuoteLock,
} from "../src/lib/checkout-quote-lock";
import { buildPendingPaymentAttempt, type PendingPaymentLine } from "../src/lib/payment/pending-attempt";
import { V1_SHIPPING_CATALOGUE, type ShippingCatalogue } from "../src/lib/shipping/options";
import { emptyCheckoutDraft, type PublicCheckoutDraft } from "../src/types/checkout";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function line(unitPriceMinor: number, quantity = 1, variantId = "22222222-2222-4222-8222-222222222222"): PendingPaymentLine {
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

function draftWith(lock: CheckoutQuoteLock | null, country = "GB"): PublicCheckoutDraft {
  return {
    ...emptyCheckoutDraft(),
    step: "review",
    email: "ada@shadesuk.example",
    firstName: "Ada",
    lastName: "Lovelace",
    line1: "10 Example Street",
    city: "London",
    postcode: "E1 6AN",
    country,
    addressEntry: "manual",
    quoteLock: lock,
  };
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

const gb = createCheckoutQuoteLock({
  countryCode: "GB",
  lines: [{ variantId: line(4900).productVariantId, quantity: 1, unitPriceMinor: 4900 }],
  fx: { id: "should-not-stick", version: 9, rate: "1.2" },
});
if (
  !gb ||
  gb.fxRateId !== null ||
  gb.fxVersion !== null ||
  gb.fxRate !== null ||
  gb.taxMinor !== 0 ||
  gb.discountMinor !== 0 ||
  gb.chargeCurrency !== "GBP" ||
  gb.paymentProvider !== "paypal" ||
  gb.baseSubtotalMinor !== 4900 ||
  gb.baseShippingMinor !== 465 ||
  gb.chargeSubtotalMinor !== 4900 ||
  gb.chargeShippingMinor !== 465 ||
  gb.chargeTotalMinor !== 5365 ||
  gb.chargeTotalMinor !== gb.chargeSubtotalMinor + gb.chargeShippingMinor
) {
  throw new Error("A GBP lock must be an identity freeze with tax and discount at zero.");
}

const increased = buildPendingPaymentAttempt({
  draft: draftWith(gb),
  lines: [line(5900)],
  createReference: () => "SHU-LOCKPRICE0001",
});
if (!increased.ok) {
  throw new Error("A matching lock must still be chargeable when the catalogue price rises.");
}
if (
  increased.attempt.quote.totalMinor !== 5365 ||
  increased.attempt.quote.subtotalMinor !== 4900 ||
  increased.attempt.quote.shippingMinor !== 465 ||
  increased.attempt.paypal.amountMinor !== 5365 ||
  increased.attempt.paypal.currency !== "GBP" ||
  increased.attempt.payment.currency !== "GBP" ||
  increased.attempt.items[0]?.unit_price_minor !== 4900
) {
  throw new Error("PayPal must charge the frozen GBP total when the catalogue price rises.");
}
const dropped = buildPendingPaymentAttempt({
  draft: draftWith(gb),
  lines: [line(1000)],
});
if (dropped.ok || dropped.reason !== "stale") {
  throw new Error("A lower live total must not be charged at the higher frozen amount.");
}

const resized = buildPendingPaymentAttempt({
  draft: draftWith(gb),
  lines: [line(4900, 2)],
});
if (resized.ok || resized.reason !== "stale") {
  throw new Error("A quantity change must invalidate the quote lock.");
}

const open = buildPendingPaymentAttempt({
  draft: draftWith(null),
  lines: [line(4900)],
  clientQuote: { totalMinor: 1, currency: "USD", shippingMinor: 0 },
  createReference: () => "SHU-NOLOCK000001",
});
if (!open.ok || open.attempt.quote.totalMinor !== 5365 || open.attempt.paypal.currency !== "GBP") {
  throw new Error("A checkout without a lock must keep the live GBP quote.");
}

if (quoteLockForCountry(gb, "DE")) {
  throw new Error("A country change must drop the previous lock.");
}

const europe = createCheckoutQuoteLock({
  countryCode: "DE",
  lines: [{ variantId: "variant-de", quantity: 1, unitPriceMinor: 100 }],
  fx: { id: "fx-eur-1", version: 4, rate: "1.005" },
  catalogue: catalogueWith("europe", 100),
});
if (
  !europe ||
  europe.chargeCurrency !== "EUR" ||
  europe.fxRateId !== "fx-eur-1" ||
  europe.fxVersion !== 4 ||
  europe.fxRate !== "1.005" ||
  europe.chargeSubtotalMinor !== 101 ||
  europe.chargeShippingMinor !== 101 ||
  europe.chargeTotalMinor !== 202 ||
  europe.paymentProvider !== "paypal" ||
  europe.baseSubtotalMinor + europe.baseShippingMinor !== 200
) {
  throw new Error("Localized subtotal and shipping must be converted separately, then added.");
}
const europeOnGb = buildPendingPaymentAttempt({
  draft: draftWith(europe, "GB"),
  lines: [line(100)],
});
if (europeOnGb.ok || europeOnGb.reason !== "stale") {
  throw new Error("A lock for another country must not be charged.");
}

if (createCheckoutQuoteLock({
  countryCode: "DE",
  lines: [{ variantId: "variant-de", quantity: 1, unitPriceMinor: 100 }],
  catalogue: catalogueWith("europe", 100),
})) {
  throw new Error("A missing FX rate must not invent a localized price.");
}

const india = createCheckoutQuoteLock({
  countryCode: "IN",
  lines: [{ variantId: "variant-in", quantity: 1, unitPriceMinor: 100 }],
  fx: { id: "fx-inr-1", version: 2, rate: "100" },
  catalogue: catalogueWith("india", 100),
});
if (!india || india.paymentProvider !== "razorpay" || india.fxRateId !== "fx-inr-1" || india.chargeTotalMinor !== 20000) {
  throw new Error("India must record Razorpay and the FX snapshot without charging.");
}
const razorpayOnGb = buildPendingPaymentAttempt({
  draft: draftWith({ ...gb, paymentProvider: "razorpay" }),
  lines: [line(4900)],
});
if (razorpayOnGb.ok || razorpayOnGb.reason !== "stale") {
  throw new Error("A Razorpay mapping must not start a PayPal attempt.");
}

const parsed = parseCheckoutQuoteLock(europe);
if (!parsed || parsed.chargeTotalMinor !== 202) {
  throw new Error("A quote lock must parse back to the same snapshot.");
}
const tampered = parseCheckoutQuoteLock({ ...europe, chargeTotalMinor: 201 });
if (tampered) {
  throw new Error("A lock whose charge total is not subtotal plus shipping must be rejected.");
}
if (checkoutQuoteFromLock(gb).totalMinor !== 5365) {
  throw new Error("Review must display the frozen GBP total.");
}

if (QUOTE_LOCK_TTL_MS !== 45 * 60 * 1000) {
  throw new Error("Quote locks must expire after 45 minutes.");
}
const frozenAt = 1_700_000_000_000;
const timed = createCheckoutQuoteLock({
  countryCode: "GB",
  lines: [{ variantId: line(4900).productVariantId, quantity: 1, unitPriceMinor: 4900 }],
  now: frozenAt,
});
if (!timed || timed.frozenAt !== frozenAt) {
  throw new Error("frozenAt must be set only when the lock is created.");
}
const stillHeld = buildPendingPaymentAttempt({
  draft: draftWith(timed),
  lines: [line(4900)],
  now: frozenAt + QUOTE_LOCK_TTL_MS - 1,
});
if (!stillHeld.ok || stillHeld.attempt.paypal.amountMinor !== 5365) {
  throw new Error("A lock inside 45 minutes must still charge the frozen GBP total.");
}
const expiredAttempt = buildPendingPaymentAttempt({
  draft: draftWith(timed),
  lines: [line(4900)],
  now: frozenAt + QUOTE_LOCK_TTL_MS,
});
if (expiredAttempt.ok || expiredAttempt.reason !== "expired") {
  throw new Error("An expired lock must not be charged.");
}
const expiredRead = inspectCheckoutQuoteLock(timed, frozenAt + QUOTE_LOCK_TTL_MS);
if (expiredRead.lock || !expiredRead.expired || parseCheckoutQuoteLock(timed, frozenAt + QUOTE_LOCK_TTL_MS)) {
  throw new Error("Reading an expired lock must drop it.");
}

const sessionId = createGuestCartSessionId();
const stepped = { ...draftWith(timed), step: "contact" as const, email: "later@example.com" };
const kept = encodeCheckoutDraftCookie(sessionId, stepped, frozenAt + 20 * 60 * 1000, "verify-quote-secret");
const readBack = decodeCheckoutDraftCookie(sessionId, kept, frozenAt + 20 * 60 * 1000, "verify-quote-secret");
if (readBack.quoteLock?.frozenAt !== frozenAt || readBack.email !== "later@example.com") {
  throw new Error("A step or contact write must keep the original frozenAt.");
}
const droppedDraft = decodeCheckoutDraftCookie(
  sessionId,
  kept,
  frozenAt + QUOTE_LOCK_TTL_MS,
  "verify-quote-secret",
);
if (droppedDraft.quoteLock || !droppedDraft.lockExpired || droppedDraft.step !== "address") {
  throw new Error("An expired lock must be dropped and return the shopper to delivery.");
}
const reviewStepped = { ...draftWith(timed), step: "review" as const, email: "later@example.com", country: "GB" };
const reviewKept = encodeCheckoutDraftCookie(
  sessionId,
  reviewStepped,
  frozenAt + 20 * 60 * 1000,
  "verify-quote-secret",
);
const reviewDropped = decodeCheckoutDraftCookie(
  sessionId,
  reviewKept,
  frozenAt + QUOTE_LOCK_TTL_MS,
  "verify-quote-secret",
);
if (reviewDropped.quoteLock || !reviewDropped.lockExpired || reviewDropped.step !== "review") {
  throw new Error("An expired GB review must stay on review so the shopper can update the total.");
}
const indiaReview = { ...draftWith(timed, "IN"), step: "review" as const, email: "later@example.com" };
const indiaKept = encodeCheckoutDraftCookie(sessionId, indiaReview, frozenAt + 20 * 60 * 1000, "verify-quote-secret");
const indiaDropped = decodeCheckoutDraftCookie(sessionId, indiaKept, frozenAt + QUOTE_LOCK_TTL_MS, "verify-quote-secret");
if (indiaDropped.quoteLock || !indiaDropped.lockExpired || indiaDropped.step !== "address") {
  throw new Error("An expired India review still returns to delivery.");
}
const stepWriteSource = read("src/services/checkout.ts");
const stepFn = stepWriteSource.slice(
  stepWriteSource.indexOf("export async function setCheckoutStep"),
  stepWriteSource.indexOf("export async function restartExpiredCheckout"),
);
if (!stepFn.includes("keepExpiredGbReview") || !stepFn.includes('normalizeCountry(current.country) === CHECKOUT_COUNTRY_GB')) {
  throw new Error("Opening review after a GB lock expires must not send the shopper back to delivery.");
}
const checkoutService = read("src/services/checkout.ts");
const contactWrite = checkoutService.slice(
  checkoutService.indexOf("export async function saveCheckoutContact"),
  checkoutService.indexOf("export async function saveCheckoutAddress"),
);
const stepWrite = checkoutService.slice(
  checkoutService.indexOf("export async function setCheckoutStep"),
  checkoutService.indexOf("export async function restartExpiredCheckout"),
);
if (contactWrite.includes("frozenAt") || stepWrite.includes("frozenAt")) {
  throw new Error("Contact and step writes must not refresh the quote lock clock.");
}

const huge = createCheckoutQuoteLock({
  countryCode: "GB",
  now: frozenAt,
  lines: Array.from({ length: 200 }, (_, index) => ({
    variantId: `${index}-${"v".repeat(80)}`,
    quantity: 1,
    unitPriceMinor: 10,
  })),
});
if (!huge) {
  throw new Error("A large bag must still produce a lock before the cookie cap.");
}
const packed = encodeCheckoutDraftCookie(sessionId, draftWith(huge), frozenAt, "verify-quote-secret");
if (!packed || packed.length > CHECKOUT_DRAFT_COOKIE_MAX_LENGTH) {
  throw new Error("An oversized quote lock must not be written into the cookie.");
}
const unpacked = decodeCheckoutDraftCookie(sessionId, packed, frozenAt, "verify-quote-secret");
if (unpacked.quoteLock || unpacked.email !== "ada@shadesuk.example") {
  throw new Error("An oversized lock must be dropped without wiping the delivery draft.");
}

const encoded = encodeCheckoutDraftCookie(sessionId, draftWith(gb), Date.now(), "verify-quote-secret");
const decoded = decodeCheckoutDraftCookie(sessionId, encoded, Date.now(), "verify-quote-secret");
if (!decoded.quoteLock || decoded.quoteLock.baseShippingMinor !== 465 || decoded.quoteLock.fxRateId !== null) {
  throw new Error("The signed draft must keep the quote lock.");
}

const draftCodec = read("src/lib/checkout-draft.ts");
if (draftCodec.includes("subtotal") || draftCodec.includes("shippingMinor") || draftCodec.includes("totalMinor")) {
  throw new Error("Checkout draft persistence must not name payable totals.");
}
if (!draftCodec.includes("inspectCheckoutQuoteLock") || !draftCodec.includes("CHECKOUT_DRAFT_COOKIE_MAX_LENGTH")) {
  throw new Error("The draft cookie must restore the quote lock and cap its size.");
}
if (!checkoutService.includes("countryChanged") || !checkoutService.includes("draft.quoteLock = null")) {
  throw new Error("A country change must clear the stored quote lock.");
}
if (!checkoutService.includes("freezeCheckoutQuoteLock")) {
  throw new Error("Saving a priced address must freeze the quote.");
}
const freezeSource = read("src/lib/checkout-quote-freeze.ts");
if (!freezeSource.includes("loadLatestFxRates")) {
  throw new Error("A non-GBP lock must read the stored FX row.");
}
const attemptSource = read("src/lib/payment/pending-attempt.ts");
if (!attemptSource.includes('currency: STORE_CURRENCY') || !attemptSource.includes("checkoutQuoteFromLock")) {
  throw new Error("Payment must keep GBP and use the locked base total.");
}
if (!attemptSource.includes("quoteLockExpired") || !attemptSource.includes("liveTotalUndercutsLock")) {
  throw new Error("Payment must reject an expired lock and a lower live total.");
}
const page = read("src/components/checkout/CheckoutPage.tsx");
if (!page.includes("CHECKOUT_PRICE_CHANGED") || !page.includes("liveCheaper")) {
  throw new Error("Review must show a lower live price.");
}
if (page.includes("CHECKOUT_LOCK_EXPIRED")) {
  throw new Error("An expired lock uses Review's Update total, not a second checkout banner.");
}
if (!page.includes("CHECKOUT_PRICE_CONFIRM") || !page.includes("hideQuoteStale={liveCheaper}")) {
  throw new Error("A lower live price must use one status line, not the stale quote copy as well.");
}

console.log("Quote lock OK: GBP freeze, separate localization, FX snapshot, country invalidation");
