/**
 * Phase 5 quote lock. GBP charge stays frozen. Localized amounts are stored
 * and are not sent to PayPal.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGuestCartSessionId } from "../src/contracts/cart/session";
import { decodeCheckoutDraftCookie, encodeCheckoutDraftCookie } from "../src/lib/checkout-draft";
import {
  checkoutQuoteFromLock,
  createCheckoutQuoteLock,
  parseCheckoutQuoteLock,
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

const changed = buildPendingPaymentAttempt({
  draft: draftWith(gb),
  lines: [line(1000)],
  createReference: () => "SHU-LOCKPRICE0001",
});
if (!changed.ok) {
  throw new Error("A matching lock must still be chargeable after the catalogue price changes.");
}
if (
  changed.attempt.quote.totalMinor !== 5365 ||
  changed.attempt.quote.subtotalMinor !== 4900 ||
  changed.attempt.quote.shippingMinor !== 465 ||
  changed.attempt.paypal.amountMinor !== 5365 ||
  changed.attempt.paypal.currency !== "GBP" ||
  changed.attempt.payment.currency !== "GBP" ||
  changed.attempt.items[0]?.unit_price_minor !== 4900
) {
  throw new Error("PayPal must charge the frozen GBP total, not the later catalogue price.");
}

const resized = buildPendingPaymentAttempt({
  draft: draftWith(gb),
  lines: [line(4900, 2)],
});
if (resized.ok || resized.reason !== "blocked") {
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
if (europeOnGb.ok || europeOnGb.reason !== "blocked") {
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
if (razorpayOnGb.ok || razorpayOnGb.reason !== "blocked") {
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

const sessionId = createGuestCartSessionId();
const encoded = encodeCheckoutDraftCookie(sessionId, draftWith(gb), Date.now(), "verify-quote-secret");
const decoded = decodeCheckoutDraftCookie(sessionId, encoded, Date.now(), "verify-quote-secret");
if (!decoded.quoteLock || decoded.quoteLock.baseShippingMinor !== 465 || decoded.quoteLock.fxRateId !== null) {
  throw new Error("The signed draft must keep the quote lock.");
}

const draftCodec = read("src/lib/checkout-draft.ts");
if (draftCodec.includes("subtotal") || draftCodec.includes("shippingMinor") || draftCodec.includes("totalMinor")) {
  throw new Error("Checkout draft persistence must not name payable totals.");
}
if (!draftCodec.includes("parseCheckoutQuoteLock")) {
  throw new Error("The draft cookie must restore the quote lock through its parser.");
}
const checkoutService = read("src/services/checkout.ts");
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

console.log("Quote lock OK: GBP freeze, separate localization, FX snapshot, country invalidation");
