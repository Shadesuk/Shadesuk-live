/**
 * Phase 4 shipping resolution. Uses the Phase 1 seed, not a live database.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UK_STANDARD_DELIVERY, ESTIMATED_DELIVERY_WINDOW } from "../src/lib/checkout-copy";
import { authoritativeCheckoutQuote, UK_STANDARD_DELIVERY_MINOR } from "../src/lib/checkout-quote";
import { resolveShippingOptions } from "../src/lib/shipping/options";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

const uk = resolveShippingOptions("GB");
if (uk.status !== "priced" || uk.options.length !== 1) {
  throw new Error("GB must resolve to the seeded UK method.");
}
const method = uk.options[0];
if (
  !method ||
  method.amountMinor !== 465 ||
  method.amountMinor !== UK_STANDARD_DELIVERY_MINOR ||
  method.label !== UK_STANDARD_DELIVERY ||
  method.estimatedDelivery !== ESTIMATED_DELIVERY_WINDOW ||
  method.currency !== "GBP" ||
  method.zoneId !== "uk"
) {
  throw new Error("UK shipping must stay £4.65 and 2+ weeks.");
}

for (const country of ["DE", "FR", "US", "AE", "SA", "IN"]) {
  const resolved = resolveShippingOptions(country);
  if (resolved.status !== "unavailable") {
    throw new Error(`${country} must stay unavailable until a rate is seeded.`);
  }
  const quote = authoritativeCheckoutQuote({ subtotalMinor: 4900, country, shippingMinor: 465 });
  if (quote.shippingStatus === "priced" || quote.shippingMinor !== 0) {
    throw new Error(`${country} must not be charged the UK shipping price.`);
  }
}

const japan = resolveShippingOptions("JP");
if (japan.status !== "unsupported") {
  throw new Error("An unknown country must not receive a shipping zone.");
}

const tampered = authoritativeCheckoutQuote({
  subtotalMinor: 4900,
  shippingMinor: 0,
  totalMinor: 1,
  currency: "USD",
});
if (tampered.shippingMinor !== 465 || tampered.totalMinor !== 5365 || tampered.shippingStatus !== "priced") {
  throw new Error("A UK quote must ignore client shipping and stay £4.65.");
}

const quoteSource = read("src/lib/checkout-quote.ts");
if (!quoteSource.includes("UK_STANDARD_DELIVERY_MINOR") || quoteSource.includes("geoapify")) {
  throw new Error("The checkout quote must keep the UK minor constant.");
}
const payment = read("src/lib/payment/pending-attempt.ts");
if (!payment.includes("validateDeliverableCheckoutAddress") || !payment.includes('reason: "blocked"')) {
  throw new Error("Payment must stay on the GB charge path.");
}
const address = read("src/components/checkout/CheckoutAddress.tsx");
if (!address.includes("resolveShippingOptions") || !address.includes("SHIPPING_UNAVAILABLE")) {
  throw new Error("The delivery step must show seeded shipping or unavailable.");
}

console.log("Shipping OK: UK 465, unpriced countries unavailable, payment stays GB-only");
