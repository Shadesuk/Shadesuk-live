/**
 * Phase 7 charge snapshot. Capture writes one immutable record.
 * History does not read the live catalogue or the live FX table.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCheckoutQuoteLock } from "../src/lib/checkout-quote-lock";
import { checkoutQuoteFromLock } from "../src/lib/checkout-quote-lock";
import { buildIndiaCharge } from "../src/lib/payment/india-charge";
import { buildPendingPaymentAttempt, type PendingPaymentLine } from "../src/lib/payment/pending-attempt";
import { indiaChargeFacts, paypalAttemptSatisfiesChargeSnapshot, paypalChargeFacts } from "../src/lib/order-snapshot";
import { V1_SHIPPING_CATALOGUE, type ShippingCatalogue } from "../src/lib/shipping/options";
import { emptyCheckoutDraft, type PublicCheckoutDraft } from "../src/types/checkout";

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

function line(unitPriceMinor: number, variantId = "22222222-2222-4222-8222-222222222222"): PendingPaymentLine {
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

function draftWith(lock: PublicCheckoutDraft["quoteLock"], country = "GB"): PublicCheckoutDraft {
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

const gb = createCheckoutQuoteLock({
  countryCode: "GB",
  lines: [{ variantId: line(4900).productVariantId, quantity: 1, unitPriceMinor: 4900 }],
  now: 1_700_000_000_000,
});
if (!gb) {
  throw new Error("GBP lock is required for the snapshot.");
}
const paypal = buildPendingPaymentAttempt({
  draft: draftWith(gb),
  lines: [line(4900)],
  now: gb.frozenAt,
  createReference: () => "SHU-SNAPSHOT0001",
});
if (!paypal.ok) {
  throw new Error("A GBP lock must still build a PayPal attempt.");
}
if (!paypalAttemptSatisfiesChargeSnapshot(paypal.attempt)) {
  throw new Error("A locked GBP PayPal attempt must satisfy the charge snapshot checks.");
}
const liveUk = buildPendingPaymentAttempt({
  draft: draftWith(null),
  lines: [line(4900)],
  now: gb.frozenAt,
  createReference: () => "SHU-SNAPSHOT0002",
});
if (!liveUk.ok || !paypalAttemptSatisfiesChargeSnapshot(liveUk.attempt)) {
  throw new Error("A live UK PayPal attempt must satisfy the charge snapshot checks before provider capture.");
}
if (
  paypal.attempt.payment.currency !== "GBP" ||
  paypal.attempt.payment.amount_minor !== 5365 ||
  paypal.attempt.payment.charge_subtotal_minor !== 4900 ||
  paypal.attempt.payment.charge_shipping_minor !== 465 ||
  paypal.attempt.payment.fx_rate_id !== null ||
  paypal.attempt.payment.fx_rate !== null ||
  paypal.attempt.payment.quote_frozen_at !== new Date(gb.frozenAt).toISOString() ||
  paypal.attempt.order.currency !== "GBP" ||
  paypal.attempt.order.total_minor !== 5365 ||
  paypal.attempt.order.delivery_address.country !== "GB" ||
  !paypal.attempt.payment.shipping_label
) {
  throw new Error("PayPal snapshot facts must keep the frozen GBP total and the lock clock.");
}

const europe = createCheckoutQuoteLock({
  countryCode: "DE",
  lines: [{ variantId: "variant-de", quantity: 1, unitPriceMinor: 100 }],
  fx: { id: "fx-eur-1", version: 4, rate: "1.005" },
  catalogue: catalogueWith("europe", 100),
  now: 1_700_000_000_000,
});
if (!europe) {
  throw new Error("EUR lock is required for the FX snapshot.");
}
const europeFacts = paypalChargeFacts({
  lock: europe,
  quote: checkoutQuoteFromLock(europe),
  shippingMethodId: europe.shippingMethodId,
});
if (
  europe.chargeCurrency !== "EUR" ||
  europe.paymentProvider !== "paypal" ||
  europeFacts.fx_rate_id !== "fx-eur-1" ||
  europeFacts.fx_version !== 4 ||
  europeFacts.fx_rate !== "1.005" ||
  europeFacts.charge_subtotal_minor !== 101 ||
  europeFacts.charge_shipping_minor !== 101 ||
  europeFacts.charge_subtotal_minor + europeFacts.charge_shipping_minor !== europe.chargeTotalMinor
) {
  throw new Error("A EUR PayPal lock must keep the FX rate and the EUR charge parts.");
}

const india = createCheckoutQuoteLock({
  countryCode: "IN",
  lines: [{ variantId: "variant-in", quantity: 1, unitPriceMinor: 100 }],
  fx: { id: "fx-inr-1", version: 2, rate: "100" },
  catalogue: catalogueWith("india", 100),
  now: 1_700_000_000_000,
});
if (!india || !india.fxRateId || !india.fxRate || india.fxVersion == null) {
  throw new Error("India lock is required for the INR snapshot.");
}
const indiaFacts = indiaChargeFacts({
  ...india,
  fxRateId: india.fxRateId,
  fxRate: india.fxRate,
  fxVersion: india.fxVersion,
});
if (indiaFacts.fx_rate !== "100" || indiaFacts.charge_subtotal_minor !== 10000 || indiaFacts.charge_shipping_minor !== 10000) {
  throw new Error("India snapshot facts must store the INR parts and the rate value.");
}
const indiaCharge = buildIndiaCharge({
  draft: draftWith(india, "IN"),
  lines: [line(100, "variant-in")],
  now: india.frozenAt,
  shippingQuote: {
    status: "priced",
    countryCode: "IN",
    zoneId: "india",
    options: [
      {
        methodId: india.shippingMethodId,
        zoneId: "india",
        code: "standard",
        label: india.shippingLabel,
        estimatedDelivery: india.estimatedDelivery,
        currency: "GBP",
        amountMinor: 100,
      },
    ],
  },
});
if (
  !indiaCharge.ok ||
  indiaCharge.charge.payment.fxRate !== "100" ||
  indiaCharge.charge.payment.amountMinor !== 20000 ||
  indiaCharge.charge.order.currency !== "GBP" ||
  indiaCharge.charge.order.total_minor !== 200 ||
  indiaCharge.charge.order.delivery_address.country !== "IN" ||
  indiaCharge.charge.items.length !== 1
) {
  throw new Error("India charge must keep the GBP order, INR payment, and line snapshot together.");
}

const migration = read("supabase/migrations/20261005200000_order_charge_snapshots.sql");
if (!migration.includes("order_charge_snapshots are write-once")) {
  throw new Error("Snapshot updates and deletes must be rejected.");
}
if (!migration.includes("before update or delete") || !migration.includes("before truncate")) {
  throw new Error("Snapshot writes must block update, delete, and truncate.");
}
if (
  !migration.includes("revoke all on table public.order_charge_snapshots from anon") ||
  !migration.includes("revoke all on table public.order_charge_snapshots from authenticated") ||
  !migration.includes("grant select, insert on table public.order_charge_snapshots to service_role")
) {
  throw new Error("Snapshot table access must be service-role insert and select only.");
}
const revokeServiceRole = migration.indexOf("revoke all on table public.order_charge_snapshots from service_role");
const grantServiceRole = migration.indexOf("grant select, insert on table public.order_charge_snapshots to service_role");
if (revokeServiceRole < 0 || grantServiceRole < revokeServiceRole) {
  throw new Error("service_role must lose every snapshot privilege before select and insert are granted.");
}
for (const name of ["mark_india_payment_captured", "mark_paypal_payment_captured"] as const) {
  if (!migration.includes(`function public.${name}`) || !migration.includes("perform private.insert_order_charge_snapshot")) {
    throw new Error(`${name} must insert the snapshot in the capture transaction.`);
  }
  const body = migration.slice(migration.indexOf(`function public.${name}`));
  if (!body.includes("security definer") || !body.includes("set search_path = public")) {
    throw new Error(`${name} must be security definer with a fixed search_path.`);
  }
  if (!body.includes("grant execute") || !body.includes("to service_role")) {
    throw new Error(`${name} must grant execute only to service_role.`);
  }
}
if (migration.includes("signature") || migration.toLowerCase().includes("webhook") || migration.includes("raw_body")) {
  throw new Error("Snapshots must not store signatures or raw provider payloads.");
}
if (!migration.includes("fx_rate") || !migration.includes("quote_frozen_at") || !migration.includes("shipping_minor")) {
  throw new Error("Snapshots must store the rate value, frozen time, and shipping rate.");
}
const captureStore = read("src/lib/payment/capture-store.ts");
if (!captureStore.includes("mark_paypal_payment_captured")) {
  throw new Error("PayPal capture must go through the snapshot transaction.");
}
if (!captureStore.includes('row?.status !== capturedState.status')) {
  throw new Error("A duplicate PayPal capture must return null so the second caller takes the already-captured path.");
}
const indiaCommit = read("src/lib/razorpay/commit.ts");
const indiaCapturedBranch = indiaCommit.indexOf('if (marked === "captured")');
const indiaNotify = indiaCommit.indexOf("await onVerifiedPaymentCaptured");
if (
  indiaCapturedBranch < 0 ||
  indiaNotify < indiaCapturedBranch ||
  !indiaCommit.includes('status: marked === "duplicate" ? "already_processed"')
) {
  throw new Error("India duplicate capture must skip the confirmation email.");
}
const indiaPersist = read("src/lib/razorpay/persist.ts");
if (!indiaPersist.includes("fx_rate: charge.payment.fxRate") || !indiaPersist.includes("mark_india_payment_captured")) {
  throw new Error("India capture must keep the rate value for the snapshot.");
}
const email = read("src/lib/email/order-confirmation.ts");
if (!email.includes("formatGbp") && !read("src/lib/email/variables.ts").includes("formatGbpMinor")) {
  throw new Error("Confirmation email still formats GBP. Document that instead of changing Resend.");
}
if (!email.includes("order_charge_snapshots")) {
  throw new Error("The GBP confirmation email must point at the charge snapshot follow-up.");
}

console.log("Order snapshot OK: write-once capture record, GBP order, charge currency, FX rate value.");
