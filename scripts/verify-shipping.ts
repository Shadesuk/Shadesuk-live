/**
 * Phase 4 shipping resolution. Uses the Phase 1 seed, not a live database.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UK_STANDARD_DELIVERY, ESTIMATED_DELIVERY_WINDOW } from "../src/lib/checkout-copy";
import { authoritativeCheckoutQuote, quoteIsChargeable, UK_STANDARD_DELIVERY_MINOR } from "../src/lib/checkout-quote";
import { V1_SHIPPING_METHODS } from "../src/contracts/markets";
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

for (const country of ["DE", "FR", "US", "AE", "SA", "IN", "JP", "AU"]) {
  const resolved = resolveShippingOptions(country);
  if (resolved.status !== "priced" || resolved.options[0]?.amountMinor !== 465) {
    throw new Error(`${country} must use the £4.65 standard rate.`);
  }
  const quote = authoritativeCheckoutQuote({ subtotalMinor: 4900, country, shippingMinor: 1, totalMinor: 1, currency: "USD" });
  if (quote.shippingStatus !== "priced" || quote.shippingMinor !== 465 || quote.totalMinor !== 5365 || quote.currency !== "GBP") {
    throw new Error(`${country} must ignore client shipping and stay on the GBP catalogue rate.`);
  }
  if (!quoteIsChargeable(quote)) {
    throw new Error(`${country} standard shipping must be chargeable.`);
  }
}

const migration = read("supabase/migrations/20261005160000_international_market_config.sql");
for (const method of V1_SHIPPING_METHODS) {
  if (
    !migration.includes(`'${method.id}'`) ||
    !migration.includes(`'${method.label}'`) ||
    !migration.includes(`'${method.estimatedDelivery}'`) ||
    !migration.includes(`('${method.id}', '${method.currency}', ${method.amountMinor})`)
  ) {
    throw new Error(`Shipping seed must match typed method ${method.id}.`);
  }
}
const checkoutService = read("src/services/checkout.ts");
if (!checkoutService.includes("checkoutQuoteFromCart(cart, draft.country)")) {
  throw new Error("Saving an address must recompute the quote for the new country.");
}
const summary = read("src/components/checkout/CheckoutSummary.tsx");
if (summary.includes("SHIPPING_UNAVAILABLE}") && summary.includes("totalValue")) {
  const totalBlock = summary.slice(summary.indexOf("totalValue"));
  if (totalBlock.includes("SHIPPING_UNAVAILABLE")) {
    throw new Error("Unavailable shipping must not replace the total.");
  }
}
const checkoutPage = read("src/components/checkout/CheckoutPage.tsx");
if (!checkoutPage.includes("checkoutQuoteFromCart(view, activeCountry)")) {
  throw new Error("The summary must follow the country selected on the delivery step.");
}

const unknown = resolveShippingOptions("ZZ");
if (unknown.status !== "unsupported") {
  throw new Error("An unknown country must not receive a shipping price.");
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
if (!address.includes("allowManual={Boolean(priced)}") || !address.includes("if (!priced)")) {
  throw new Error("Unpriced shipping must hide manual entry and must not force the form open.");
}
if (!address.includes("resolveShippingOptions") || !address.includes("SHIPPING_UNAVAILABLE")) {
  throw new Error("The delivery step must show seeded shipping or unavailable.");
}

console.log("Shipping OK: £4.65 for every supported country, unknown countries unsupported");
