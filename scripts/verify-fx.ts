/**
 * Phase 2 FX and pricing. Does not call Frankfurter or Supabase.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UK_STANDARD_DELIVERY_MINOR } from "../src/lib/checkout-quote";
import { getLocalizedPrice, multiplyMinorByRateHalfUp, parsePositiveDecimalRate } from "../src/contracts/pricing";
import { fxUpdateAuthorized } from "../src/lib/fx/auth";
import { FRANKFURTER_DEFAULT_BASE_URL, parseFrankfurterLatestRates } from "../src/lib/fx/observations";
import { resolveFrankfurterBaseUrl } from "../src/lib/fx/frankfurter";
import { observationsToInserts, planFxPersistence, runFxRefresh } from "../src/lib/fx/refresh";
import { FxRateReadError, selectLatestFxRates } from "../src/lib/fx/store";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

const now = new Date("2026-10-05T12:00:00.000Z");
const sample = JSON.stringify([
  { date: "2026-10-05", base: "GBP", quote: "EUR", rate: 1.1762 },
  { date: "2026-10-05", base: "GBP", quote: "INR", rate: 127.28 },
  { date: "2026-10-05", base: "GBP", quote: "USD", rate: 1.3231 },
]);

const parsed = parseFrankfurterLatestRates(sample, now);
if (!parsed.ok || parsed.observations.length !== 3) {
  throw new Error("Frankfurter sample must yield EUR, USD, and INR.");
}
if (parsed.observations.some((row) => row.rate.includes("e") || row.rate.includes("E"))) {
  throw new Error("Persisted rates must stay decimal strings.");
}
if (!parsed.ok) {
  throw new Error("Frankfurter sample must yield EUR, USD, and INR.");
}
const sampleObservations = parsed.observations;
const eur = sampleObservations.find((row) => row.quoteCurrency === "EUR");
if (!eur || eur.rate !== "1.1762") {
  throw new Error("EUR rate literal must be preserved.");
}

const partial = parseFrankfurterLatestRates(
  JSON.stringify([{ date: "2026-10-05", base: "GBP", quote: "EUR", rate: 1.1 }]),
  now,
);
if (partial.ok || partial.reason !== "incomplete") {
  throw new Error("A partial Frankfurter body must not be persisted.");
}
const zero = parseFrankfurterLatestRates(
  sample.replace("1.1762", "0"),
  now,
);
if (zero.ok || zero.reason !== "invalid_rate") {
  throw new Error("A zero rate must be rejected.");
}
const negative = parseFrankfurterLatestRates(sample.replace("1.1762", "-1.1"), now);
if (negative.ok || negative.reason !== "invalid_rate") {
  throw new Error("A negative rate must be rejected.");
}
const malformed = parseFrankfurterLatestRates("{", now);
if (malformed.ok || malformed.reason !== "malformed") {
  throw new Error("A malformed body must be rejected.");
}

const mixedDates = parseFrankfurterLatestRates(
  JSON.stringify([
    { date: "2026-10-06", base: "GBP", quote: "EUR", rate: 1.1762 },
    { date: "2026-10-05", base: "GBP", quote: "INR", rate: 127.28 },
    { date: "2026-10-06", base: "GBP", quote: "USD", rate: 1.3231 },
    { date: "2026-10-06", base: "GBP", quote: "AUD", rate: 1.91 },
    { date: "2026-10-04", base: "GBP", quote: "CAD", rate: 0 },
    { date: "not-a-date", base: "GBP", quote: "JPY", rate: 190 },
    { date: "2026-10-05", base: "GBP", quote: "XXX", rate: 1 },
  ]),
  now,
);
if (!mixedDates.ok) {
  throw new Error("Mixed Frankfurter dates must still keep EUR, USD, and INR.");
}
const mixedQuotes = mixedDates.observations.map((row) => row.quoteCurrency).sort();
if (mixedQuotes.join(",") !== "AUD,EUR,INR,USD") {
  throw new Error(`Optional rows with a bad date or rate must be skipped, got ${mixedQuotes.join(",")}.`);
}
const mixedInr = mixedDates.observations.find((row) => row.quoteCurrency === "INR");
if (mixedInr?.effectiveOn !== "2026-10-05") {
  throw new Error("Each quote must keep its own Frankfurter date.");
}
const badRequiredDate = parseFrankfurterLatestRates(
  sample.replace('"date":"2026-10-05","base":"GBP","quote":"EUR"', '"date":"not-a-date","base":"GBP","quote":"EUR"'),
  now,
);
if (badRequiredDate.ok || badRequiredDate.reason !== "invalid_date") {
  throw new Error("A bad date on EUR, USD, or INR must fail the batch.");
}

if (parsePositiveDecimalRate("0") || parsePositiveDecimalRate("-1") || parsePositiveDecimalRate("NaN")) {
  throw new Error("Non-positive rate strings must be rejected.");
}
const half = parsePositiveDecimalRate("1.005");
if (!half || multiplyMinorByRateHalfUp(100, half) !== 101) {
  throw new Error("Half-up rounding must turn 100 × 1.005 into 101.");
}
const exactHalf = parsePositiveDecimalRate("0.5");
if (!exactHalf || multiplyMinorByRateHalfUp(1, exactHalf) !== 1) {
  throw new Error("Half-up rounding must turn 1 × 0.5 into 1.");
}
const eurRate = parsePositiveDecimalRate("1.1762");
if (!eurRate || multiplyMinorByRateHalfUp(4900, eurRate) !== 5763) {
  throw new Error("4900 × 1.1762 must round half-up to 5763.");
}

const gbp = getLocalizedPrice({
  baseAmountMinor: 465,
  baseCurrency: "GBP",
  targetCurrency: "GBP",
});
if (!gbp.ok || gbp.price.amountMinor !== 465 || gbp.price.fxRateId !== null) {
  throw new Error("GBP identity conversion must keep 465 and attach no FX row.");
}
const converted = getLocalizedPrice({
  baseAmountMinor: 4900,
  baseCurrency: "GBP",
  targetCurrency: "eur",
  fxRate: "1.1762",
  fxRateId: "rate-1",
  fxVersion: 4,
});
if (
  !converted.ok ||
  converted.price.amountMinor !== 5763 ||
  converted.price.currency !== "EUR" ||
  converted.price.fxRateId !== "rate-1" ||
  converted.price.fxVersion !== 4
) {
  throw new Error("Localized EUR price must use the supplied FX row.");
}
const missing = getLocalizedPrice({
  baseAmountMinor: 4900,
  baseCurrency: "GBP",
  targetCurrency: "USD",
});
if (missing.ok || missing.reason !== "missing_rate") {
  throw new Error("A missing FX rate must not invent a price.");
}
const foreignBase = getLocalizedPrice({
  baseAmountMinor: 100,
  baseCurrency: "EUR",
  targetCurrency: "USD",
  fxRate: "1.1",
});
if (foreignBase.ok || foreignBase.reason !== "unsupported_currency") {
  throw new Error("Catalogue base must stay GBP.");
}

const latest = selectLatestFxRates([
  { id: "old", quote_currency: "EUR", rate: "1.1000", version: 1, effective_at: "2026-10-01T00:00:00.000Z", status: "active" },
  { id: "new", quote_currency: "EUR", rate: "1.1762", version: 3, effective_at: "2026-10-05T00:00:00.000Z", status: "active" },
  { id: "usd", quote_currency: "USD", rate: "1.3231", version: 2, effective_at: "2026-10-05T00:00:00.000Z", status: "active" },
]);
if (latest.find((row) => row.quoteCurrency === "EUR")?.id !== "new") {
  throw new Error("Latest FX selection must keep the highest version and leave older rows unused.");
}
if (latest.length !== 2) {
  throw new Error("Latest selection must not invent a quote that was not stored.");
}
let numericRejected = false;
try {
  selectLatestFxRates([
    {
      id: "numeric",
      quote_currency: "EUR",
      rate: 1.1762,
      version: 4,
      effective_at: "2026-10-05T00:00:00.000Z",
      status: "active",
    },
  ]);
} catch (error) {
  numericRejected = error instanceof FxRateReadError;
}
if (!numericRejected) {
  throw new Error("A numeric FX rate must fail closed instead of being dropped.");
}

async function verifyRefresh(): Promise<void> {
const sink: { rows: number } = { rows: -1 };
const failed = await runFxRefresh({
  fetchBody: async () => {
    throw new Error("down");
  },
  insert: async (rows) => {
    sink.rows = rows.length;
  },
  now,
});
if (failed.ok || !failed.keptLastRates || sink.rows !== -1) {
  throw new Error("A failed fetch must not insert and must keep the last rates.");
}
const stored = await runFxRefresh({
  fetchBody: async () => sample,
  insert: async (rows) => {
    sink.rows = rows.length;
  },
  now,
});
if (!stored.ok || stored.inserted !== 3 || Number(sink.rows) !== 3) {
  throw new Error("A valid batch must insert three active rows.");
}
const badBatch = await runFxRefresh({
  fetchBody: async () => sample.replace("127.28", "0"),
  insert: async () => {
    throw new Error("insert should not run");
  },
  now,
});
if (badBatch.ok || badBatch.reason !== "invalid_rate") {
  throw new Error("An invalid batch must skip insert.");
}

const baseline = observationsToInserts(sampleObservations);
const spiked = baseline.map((row) =>
  row.quote_currency === "EUR" ? { ...row, rate: "1.3600" } : row,
);
let bandInserted = false;
const band = await runFxRefresh({
  fetchBody: async () =>
    JSON.stringify([
      { date: "2026-10-05", base: "GBP", quote: "EUR", rate: "1.3600" },
      { date: "2026-10-05", base: "GBP", quote: "INR", rate: "127.28" },
      { date: "2026-10-05", base: "GBP", quote: "USD", rate: "1.3231" },
    ]),
  previous: baseline.map((row) => ({
    quoteCurrency: row.quote_currency,
    rate: row.rate,
    effectiveAt: row.effective_at,
  })),
  insert: async () => {
    bandInserted = true;
  },
  now,
});
if (band.ok || band.reason !== "out_of_band" || bandInserted || !band.keptLastRates) {
  throw new Error("A move above 15% must reject the whole batch and keep the last rates.");
}
const withinBand = planFxPersistence(
  baseline.map((row) => (row.quote_currency === "EUR" ? { ...row, rate: "1.2000" } : row)),
  baseline.map((row) => ({
    quoteCurrency: row.quote_currency,
    rate: row.rate,
    effectiveAt: row.effective_at,
  })),
);
if (withinBand.action !== "insert") {
  throw new Error("A move inside the 15% band must still be allowed.");
}
const firstPair = planFxPersistence(spiked, []);
if (firstPair.action !== "insert" || firstPair.rows.length !== 3) {
  throw new Error("The first observation for a pair must skip the band check.");
}

let duplicateInserted = false;
const duplicate = await runFxRefresh({
  fetchBody: async () => sample,
  previous: baseline.map((row) => ({
    quoteCurrency: row.quote_currency,
    rate: row.rate,
    effectiveAt: "2026-10-05T00:00:00+00:00",
  })),
  insert: async () => {
    duplicateInserted = true;
  },
  now,
});
if (!duplicate.ok || duplicate.inserted !== 0 || duplicate.reason !== "unchanged" || duplicateInserted) {
  throw new Error("A batch matching the latest effective time and rate must not insert.");
}
const changedEur = planFxPersistence(
  baseline.map((row) => (row.quote_currency === "USD" ? { ...row, rate: "1.3300" } : row)),
  baseline.map((row) => ({
    quoteCurrency: row.quote_currency,
    rate: row.rate,
    effectiveAt: row.effective_at,
  })),
);
if (changedEur.action !== "insert" || changedEur.rows.length !== 1 || changedEur.rows[0]?.quote_currency !== "USD") {
  throw new Error("Only a quote whose rate changed may be inserted.");
}

const locked = resolveFrankfurterBaseUrl({
  NODE_ENV: "production",
  FRANKFURTER_BASE_URL: "https://evil.example",
} as NodeJS.ProcessEnv);
if (locked !== FRANKFURTER_DEFAULT_BASE_URL || locked !== "https://api.frankfurter.dev") {
  throw new Error("Production must lock Frankfurter to https://api.frankfurter.dev.");
}
const devOverride = resolveFrankfurterBaseUrl({
  NODE_ENV: "test",
  FRANKFURTER_BASE_URL: "https://fx.test.example/base/",
} as NodeJS.ProcessEnv);
if (devOverride !== "https://fx.test.example/base") {
  throw new Error("Non-production may use an https Frankfurter test host.");
}

if (!fxUpdateAuthorized("Bearer secret-value", "secret-value")) {
  throw new Error("Matching bearer secret must authorize the refresh.");
}
if (fxUpdateAuthorized("Bearer other", "secret-value") || fxUpdateAuthorized(null, "secret-value")) {
  throw new Error("A missing or wrong secret must not authorize the refresh.");
}

if (UK_STANDARD_DELIVERY_MINOR !== 465) {
  throw new Error("UK checkout shipping must stay 465 pence.");
}
const quote = read("src/lib/checkout-quote.ts");
if (!quote.includes("UK_STANDARD_DELIVERY_MINOR = 465") || quote.includes("getLocalizedPrice") || quote.includes("frankfurter")) {
  throw new Error("Checkout quote must stay the GBP 465 path in Phase 2.");
}

const route = read("src/app/api/internal/fx/refresh/route.ts");
if (!route.includes("handleFxRefreshRequest") || route.includes("request.json")) {
  throw new Error("The refresh route must ignore client-supplied rates.");
}
const requestSource = read("src/lib/fx/refresh-request.ts");
if (!requestSource.includes('import "server-only"') || requestSource.includes("NEXT_PUBLIC_")) {
  throw new Error("FX refresh must stay server-only.");
}
const fxStore = read("src/lib/fx/store.ts");
if (!fxStore.includes("rate::text") || !fxStore.includes("FxRateReadError")) {
  throw new Error("Latest FX reads must cast rate to text and fail closed when it is not text.");
}
const frankfurter = read("src/lib/fx/frankfurter.ts");
const observations = read("src/lib/fx/observations.ts");
if (!frankfurter.includes('import "server-only"') || !observations.includes("api.frankfurter.dev")) {
  throw new Error("Frankfurter adapter must stay server-side.");
}
const envExample = read(".env.example");
if (!envExample.includes("\nFX_UPDATE_SECRET=")) {
  throw new Error(".env.example must document FX_UPDATE_SECRET.");
}
if (!envExample.includes("32 random bytes") || !envExample.includes("Production ignores FRANKFURTER_BASE_URL")) {
  throw new Error(".env.example must document the FX secret length and the production Frankfurter host.");
}
if (envExample.includes("NEXT_PUBLIC_FX_UPDATE_SECRET") || envExample.includes("NEXT_PUBLIC_FRANKFURTER")) {
  throw new Error("FX secrets must not use NEXT_PUBLIC_.");
}
const workflow = read(".github/workflows/fx-rates-daily.yml");
if (!workflow.includes("15 6 * * *") || !workflow.includes("FX_UPDATE_SECRET") || !workflow.includes("/api/internal/fx/refresh")) {
  throw new Error("Daily workflow must call the authenticated refresh endpoint.");
}
if (workflow.includes("geoapify") || workflow.toLowerCase().includes("razorpay")) {
  throw new Error("FX workflow must not add address lookup or a payment adapter.");
}

const checkoutFiles = [
  "src/components/checkout/CheckoutPage.tsx",
  "src/components/checkout/CheckoutReview.tsx",
  "src/services/checkout.ts",
  "src/lib/checkout-quote.ts",
];
for (const file of checkoutFiles) {
  const source = read(file);
  if (source.includes("frankfurter") || source.includes("getLocalizedPrice") || source.includes("geoapify")) {
    throw new Error(`${file} must not change in the FX phase.`);
  }
}

console.log("FX OK: Frankfurter validation, half-up pricing, append-only fallback, checkout quote untouched");
}

verifyRefresh().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
