/**
 * Phase 1 market configuration.
 * Checks the typed seed against the migration and confirms checkout,
 * PayPal, and the £4.65 quote were not rewired.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UK_STANDARD_DELIVERY_MINOR } from "../src/lib/checkout-quote";
import { ESTIMATED_DELIVERY_WINDOW, UK_STANDARD_DELIVERY } from "../src/lib/checkout-copy";
import { STORE_CURRENCY } from "../src/contracts/money";
import { PAYMENT_PROVIDER_PAYPAL } from "../src/contracts/payment/schema";
import {
  CATALOGUE_BASE_CURRENCY,
  UK_SHIPPING_ESTIMATED_DELIVERY,
  UK_SHIPPING_METHOD_LABEL,
  UK_SHIPPING_RATE_MINOR,
  V1_COUNTRIES,
  V1_CURRENCIES,
  V1_MARKETS,
  V1_SHIPPING_METHODS,
  V1_SHIPPING_ZONES,
  configuredShippingRate,
  marketIdForCountry,
  resolveConfiguredPaymentProvider,
  unpricedShippingZoneIds,
} from "../src/contracts/markets";

const root = resolve(process.cwd());
const migrationPath = "supabase/migrations/20261005160000_international_market_config.sql";

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (STORE_CURRENCY !== "GBP" || CATALOGUE_BASE_CURRENCY !== "GBP") {
  throw new Error("Catalogue base currency must stay GBP.");
}
if (PAYMENT_PROVIDER_PAYPAL !== "paypal") {
  throw new Error("Live payment provider constant must stay paypal.");
}
if (UK_STANDARD_DELIVERY_MINOR !== 465 || UK_SHIPPING_RATE_MINOR !== 465) {
  throw new Error("UK configured shipping must stay 465 pence.");
}
if (UK_SHIPPING_RATE_MINOR !== UK_STANDARD_DELIVERY_MINOR) {
  throw new Error("Market seed must match the existing UK checkout shipping constant.");
}
if (UK_SHIPPING_METHOD_LABEL !== UK_STANDARD_DELIVERY) {
  throw new Error("UK method label must match existing checkout copy.");
}
if (UK_SHIPPING_ESTIMATED_DELIVERY !== ESTIMATED_DELIVERY_WINDOW) {
  throw new Error("UK estimated delivery must match existing checkout copy.");
}

const baseCurrencies = V1_CURRENCIES.filter((currency) => currency.isCatalogueBase);
if (baseCurrencies.length !== 1 || baseCurrencies[0]?.code !== "GBP") {
  throw new Error("Exactly one catalogue base currency, GBP, is allowed.");
}
for (const currency of V1_CURRENCIES) {
  if (currency.minorUnitExponent !== 2) {
    throw new Error(`${currency.code} must use a minor-unit exponent of 2 in V1.`);
  }
}

if (resolveConfiguredPaymentProvider({ marketId: "india", currency: "INR" }) !== "razorpay") {
  throw new Error("India/INR must map to razorpay.");
}
for (const marketId of ["uk", "europe", "usa", "gcc"] as const) {
  const market = V1_MARKETS.find((row) => row.id === marketId);
  if (!market || resolveConfiguredPaymentProvider({ marketId, currency: market.currency }) !== "paypal") {
    throw new Error(`${marketId} must map to paypal.`);
  }
}
if (resolveConfiguredPaymentProvider({ marketId: "india", currency: "GBP" }) !== null) {
  throw new Error("India must not resolve a provider for a non-INR currency.");
}
if (resolveConfiguredPaymentProvider({ marketId: "uk", currency: "EUR" }) !== null) {
  throw new Error("UK must not resolve a provider for a non-GBP currency.");
}
if (resolveConfiguredPaymentProvider({ marketId: "unsupported", currency: "USD" }) !== null) {
  throw new Error("Unknown markets must not invent a payment provider.");
}

if (marketIdForCountry("gb") !== "uk" || marketIdForCountry("IN") !== "india") {
  throw new Error("Country codes must resolve to their V1 market.");
}
if (marketIdForCountry("JP") !== null) {
  throw new Error("Unseeded countries must stay unsupported.");
}

const ukRate = configuredShippingRate("uk");
if (
  !ukRate ||
  ukRate.amountMinor !== 465 ||
  ukRate.currency !== "GBP" ||
  ukRate.label !== "UK Standard Delivery" ||
  ukRate.estimatedDelivery !== "2+ weeks"
) {
  throw new Error("UK zone must expose the existing 465 pence method.");
}
if (V1_SHIPPING_METHODS.length !== 1) {
  throw new Error("Only the UK shipping method may be seeded in Phase 1.");
}
const unpriced = unpricedShippingZoneIds();
for (const zoneId of ["europe", "usa", "gcc", "india"] as const) {
  if (configuredShippingRate(zoneId) !== null || !unpriced.includes(zoneId)) {
    throw new Error(`${zoneId} must exist as a zone without an invented price.`);
  }
}
if (unpriced.includes("uk")) {
  throw new Error("UK zone must stay priced.");
}

const quoteSource = read("src/lib/checkout-quote.ts");
if (!quoteSource.includes("UK_STANDARD_DELIVERY_MINOR = 465")) {
  throw new Error("authoritativeCheckoutQuote shipping constant must stay 465.");
}
if (quoteSource.includes("resolveConfiguredPaymentProvider") || quoteSource.includes("fx_rates")) {
  throw new Error("Checkout quote must not read market config or FX in Phase 1.");
}

const checkoutFiles = [
  "src/components/checkout/CheckoutPage.tsx",
  "src/components/checkout/CheckoutReview.tsx",
  "src/services/checkout.ts",
  "src/lib/payment/pending-attempt.ts",
  "src/lib/payment/initiate.ts",
  "src/app/(storefront)/checkout/payment-actions.ts",
];
for (const file of checkoutFiles) {
  const source = read(file);
  if (source.includes("@/contracts/markets") || source.includes("contracts/markets")) {
    throw new Error(`${file} must not import market config in Phase 1.`);
  }
}

const migration = read(migrationPath);
if (migration.includes("alter table public.orders") || migration.includes("alter table public.payments")) {
  throw new Error("Phase 1 migration must not alter orders or payments.");
}
if (migration.includes("alter table public.carts") || migration.includes("alter table public.product_variants")) {
  throw new Error("Phase 1 migration must not alter carts or product variants.");
}
if (migration.toLowerCase().includes("orders_total_matches_components")) {
  throw new Error("Phase 1 migration must not touch the order total constraint.");
}
if (/drop\s+constraint\s+orders_currency_gbp/i.test(migration)) {
  throw new Error("Phase 1 migration must not drop orders_currency_gbp.");
}
for (const name of [
  "payments_currency_gbp",
  "carts_currency_gbp",
  "product_variants_currency_gbp",
] as const) {
  if (migration.includes(name)) {
    throw new Error(`Phase 1 migration must not mention ${name}.`);
  }
}
if (
  /api\.frankfurter\.app/i.test(migration) ||
  /geoapify\.com/i.test(migration) ||
  migration.includes("net.http") ||
  migration.includes("extensions.http")
) {
  throw new Error("Phase 1 migration must not call an FX or address provider.");
}
if (migration.includes("src/lib/razorpay") || migration.includes("@razorpay") || migration.includes("checkout.razorpay")) {
  throw new Error("Phase 1 migration must not install a Razorpay adapter.");
}
if (!migration.includes("fx_rates is append-only") || !migration.includes("before update or delete on public.fx_rates")) {
  throw new Error("FX rates must be append-only.");
}
if (
  !migration.includes("constraint fx_rates_rate_positive check (") ||
  !migration.includes("rate > 0") ||
  !migration.includes("rate <> 'NaN'::numeric")
) {
  throw new Error("FX rates must reject non-positive and NaN rates.");
}
if (!migration.includes("insert into public.shipping_rates (method_id, currency_code, amount_minor)")) {
  throw new Error("UK shipping rate seed is missing.");
}
if (!migration.includes("('uk-standard', 'GBP', 465)")) {
  throw new Error("UK shipping rate seed must be 465 GBP pence.");
}

const rateInserts = migration.match(/insert into public\.shipping_rates[\s\S]*?;/g) ?? [];
if (rateInserts.length !== 1 || !rateInserts[0]?.includes("465")) {
  throw new Error("Exactly one shipping rate seed is allowed.");
}
if (/\b(eur|usd|inr)\b[\s\S]{0,40}\d{2,}/i.test(rateInserts[0] ?? "")) {
  throw new Error("Shipping rate seed must not invent a non-GBP price.");
}

for (const market of V1_MARKETS) {
  const row = `('${market.id}', '${market.currency}', '${market.paymentProvider}')`;
  if (!migration.includes(row)) {
    throw new Error(`Migration is missing payment mapping ${row}.`);
  }
}
for (const country of V1_COUNTRIES) {
  if (!migration.includes(`'${country.code}'`)) {
    throw new Error(`Migration is missing country ${country.code}.`);
  }
}
for (const zone of V1_SHIPPING_ZONES) {
  if (!migration.includes(`'${zone.id}', '${zone.marketId}'`)) {
    throw new Error(`Migration is missing shipping zone ${zone.id}.`);
  }
}
if (!migration.includes("grant select on table public.fx_rates to anon, authenticated")) {
  throw new Error("FX reads must be available without the service role.");
}
if (!migration.includes("revoke update, delete, truncate on table public.fx_rates")) {
  throw new Error("FX history must revoke update and delete.");
}
if (migration.includes("NEXT_PUBLIC_") || migration.includes("SERVICE_ROLE_KEY") || migration.includes("SUPABASE_SECRET")) {
  throw new Error("Market migration must not embed secrets.");
}

const foundation = read("supabase/migrations/20260914230750_initial_production_schema.sql");
for (const name of [
  "orders_currency_gbp",
  "payments_currency_gbp",
  "carts_currency_gbp",
  "product_variants_currency_gbp",
  "orders_total_matches_components",
] as const) {
  if (!foundation.includes(name)) {
    throw new Error(`Existing constraint ${name} must remain in the foundation migration.`);
  }
}

const marketsSource = read("src/contracts/markets.ts");
if (marketsSource.includes("@razorpay") || marketsSource.includes("src/lib/paypal") || marketsSource.includes("frankfurter")) {
  throw new Error("Market contract must stay free of provider SDKs and FX calls.");
}
if (marketsSource.includes("process.env") || marketsSource.includes("NEXT_PUBLIC_")) {
  throw new Error("Market contract must not read environment secrets.");
}

console.log(
  "Market config OK: V1 markets, UK 465 pence, India/INR razorpay mapping, append-only FX table, checkout quote untouched",
);
