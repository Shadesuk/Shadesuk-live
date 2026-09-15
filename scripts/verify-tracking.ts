import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  consumeGuestTrackingEmailCompare,
  createOrderReference,
  emailsMatch,
  guestTrackingVerified,
  GUEST_TRACKING_GENERIC_ERROR,
  GUEST_TRACKING_RATE_LIMIT,
  GUEST_TRACKING_RATE_LIMITED,
  isOrderReference,
  parseGuestTrackingRequest,
  parseOrderReferenceInput,
  toGuestDeliveryAddress,
  toGuestOrderTrackingView,
} from "../src/contracts";
import { GENERIC_LOOKUP_ERROR, RATE_LIMITED, TRACK_YOUR_ORDER } from "../src/lib/tracking-copy";
import { routes } from "../src/lib/navigation";
import {
  guestTrackingAttemptAllowed,
  guestTrackingRateLimitKey,
  resetGuestTrackingRateLimitForTests,
} from "../src/lib/tracking-rate-limit";
import { buildTrackingTimeline } from "../src/lib/tracking-timeline";
import { safeHttpUrl } from "../src/lib/tracking-url";
import { hasForbiddenOwnershipKey } from "../src/lib/ownership-keys";

const root = resolve(process.cwd());

if (routes.trackOrder !== "/track-order") {
  throw new Error("Track order route must stay /track-order.");
}

if (TRACK_YOUR_ORDER !== "Track your order") {
  throw new Error("Guest tracking heading copy must stay locked.");
}
if (GENERIC_LOOKUP_ERROR !== GUEST_TRACKING_GENERIC_ERROR) {
  throw new Error("Form generic error must match the contract copy.");
}
if (RATE_LIMITED !== GUEST_TRACKING_RATE_LIMITED) {
  throw new Error("Rate-limit copy must match the contract.");
}

if (GUEST_TRACKING_RATE_LIMIT.maxAttempts !== 5 || GUEST_TRACKING_RATE_LIMIT.windowSeconds !== 15 * 60) {
  throw new Error("Guest tracking rate limit must be 5 attempts / 15 minutes.");
}
if (GUEST_TRACKING_RATE_LIMIT.key !== "ip+orderReference") {
  throw new Error("Guest tracking rate-limit key must be ip+orderReference.");
}

const guessable = parseGuestTrackingRequest({ orderReference: "12345", email: "a@b.com" });
const mockLegacy = parseGuestTrackingRequest({ orderReference: "SHU10294", email: "a@b.com" });
const missing = parseGuestTrackingRequest({ orderReference: "", email: "" });
if (
  guessable.ok ||
  mockLegacy.ok ||
  missing.ok ||
  guessable.message !== GUEST_TRACKING_GENERIC_ERROR ||
  mockLegacy.message !== GUEST_TRACKING_GENERIC_ERROR ||
  missing.message !== GUEST_TRACKING_GENERIC_ERROR
) {
  throw new Error("Guessable or incomplete tracking requests must use the generic error.");
}

const reference = createOrderReference();
if (!isOrderReference(reference) || parseOrderReferenceInput("SHU10294") !== null) {
  throw new Error("order_reference must stay non-guessable SHU- + Crockford.");
}

const valid = parseGuestTrackingRequest({
  orderReference: reference.toLowerCase(),
  email: "  Guest@Example.COM ",
});
if (!valid.ok || valid.email !== "guest@example.com" || valid.orderReference !== reference) {
  throw new Error("Valid guest tracking requests must parse and normalise.");
}

if (!emailsMatch("guest@example.com", "Guest@Example.COM")) {
  throw new Error("Email compare must be case-insensitive and timing-safe.");
}
if (emailsMatch("a@b.com", "c@d.com")) {
  throw new Error("Distinct emails must not match.");
}
if (consumeGuestTrackingEmailCompare("a@b.com")) {
  throw new Error("Dummy email compare must fail closed for real addresses.");
}
if (
  guestTrackingVerified({
    orderReference: reference,
    requestEmail: "a@b.com",
    orderEmail: "b@c.com",
  })
) {
  throw new Error("Wrong email must not verify a real-looking reference.");
}
if (
  !guestTrackingVerified({
    orderReference: reference,
    requestEmail: "a@b.com",
    orderEmail: "A@B.com",
  })
) {
  throw new Error("Matching emails must verify a valid reference.");
}

resetGuestTrackingRateLimitForTests();
const limitKey = guestTrackingRateLimitKey("203.0.113.8", reference);
if (limitKey !== `203.0.113.8:${reference}`) {
  throw new Error("Rate-limit key must be ip + canonical order reference.");
}
if (guestTrackingRateLimitKey("203.0.113.8", "SHU10294") !== "203.0.113.8:invalid") {
  throw new Error("Malformed references must share the invalid rate-limit bucket.");
}
for (let attempt = 0; attempt < GUEST_TRACKING_RATE_LIMIT.maxAttempts; attempt += 1) {
  if (!guestTrackingAttemptAllowed(limitKey)) {
    throw new Error("First five tracking attempts must be allowed.");
  }
}
if (guestTrackingAttemptAllowed(limitKey)) {
  throw new Error("Sixth tracking attempt must be rate-limited.");
}

if (safeHttpUrl("javascript:alert(1)") !== null || safeHttpUrl("https://carrier.example/t/1") === null) {
  throw new Error("Tracking URLs must be http(s) only.");
}

const address = toGuestDeliveryAddress({
  firstName: "Ada",
  lastName: "Lovelace",
  line1: "1 Example Street",
  email: "hidden@example.com",
  provider_payment_id: "pay_secret",
  city: "London",
  postcode: "W1A 1AA",
  country: "GB",
});
if (!address || address.line1 !== "1 Example Street" || address.name !== "Ada Lovelace") {
  throw new Error("Guest delivery address must keep known postal fields.");
}
if (JSON.stringify(address).includes("hidden@example.com") || JSON.stringify(address).includes("pay_secret")) {
  throw new Error("Guest delivery address must drop email and payment ids.");
}

const guestView = toGuestOrderTrackingView({
  order: {
    id: "55555555-5555-5555-5555-555555555555",
    order_reference: reference,
    user_id: null,
    customer_email: "guest@example.com",
    customer_first_name: "Guest",
    customer_last_name: "Customer",
    status: "placed",
    payment_status: "created",
    currency: "GBP",
    subtotal_minor: 4900,
    shipping_minor: 0,
    total_minor: 4900,
    delivery_address: {
      line1: "1 Example Street",
      city: "London",
      postcode: "W1A 1AA",
      country: "GB",
    },
    created_at: "2026-09-06T10:00:00.000Z",
    updated_at: "2026-09-06T10:00:00.000Z",
  },
  items: [
    {
      id: "66666666-6666-6666-6666-666666666666",
      order_id: "55555555-5555-5555-5555-555555555555",
      product_id: "11111111-1111-1111-1111-111111111111",
      product_variant_id: null,
      sku: "SHU-LIVE-BLK",
      product_name: "Frame Live",
      colour_name: "Black",
      variant_name: "Medium",
      quantity: 1,
      unit_price_minor: 4900,
      line_total_minor: 4900,
      product_snapshot: null,
      created_at: "2026-09-06T10:00:00.000Z",
    },
  ],
  shipment: null,
});
if ("payment" in guestView || "customerEmail" in guestView) {
  throw new Error("Guest tracking view must stay minimal (no payment or email).");
}
if (JSON.stringify(guestView).includes('"sku"')) {
  throw new Error("Guest tracking items must not include SKUs.");
}

const timeline = buildTrackingTimeline({
  status: "placed",
  placedAt: "2026-09-06T10:00:00.000Z",
  shipment: null,
});
if (timeline[0]?.state !== "current" || timeline[0]?.dateLabel == null) {
  throw new Error("Placed orders must date ORDER PLACED from created_at.");
}
if (timeline.some((step, index) => index > 0 && step.dateLabel)) {
  throw new Error("Timeline must not invent dates for unreached steps.");
}

if (hasForbiddenOwnershipKey({ orderReference: reference, email: "a@b.com", sessionId: "nope" })) {
  // expected true
} else {
  throw new Error("Tracking actions must reject client-supplied session ids.");
}

if (existsSync(resolve(root, "src/app/order"))) {
  throw new Error("Forbidden: /order/[id] routes must not exist for guest tracking.");
}

const page = readFileSync(resolve(root, "src/app/track-order/page.tsx"), "utf8");
if (!page.includes("TrackOrderForm") || !page.includes('index: false')) {
  throw new Error("/track-order must render the form and stay noindex.");
}
if (page.includes("searchParams")) {
  throw new Error("Track-order must not look up orders from GET query params.");
}

const actions = readFileSync(resolve(root, "src/app/track-order/actions.ts"), "utf8");
if (!actions.includes("cartActionOriginAllowed")) {
  throw new Error("Tracking mutations must check CSRF/origin.");
}
if (!actions.includes("hasForbiddenOwnershipKey")) {
  throw new Error("Tracking mutations must reject ownership keys.");
}
if (actions.includes("CustomerOrderView") || actions.includes("sessionId") || actions.includes("session_id")) {
  throw new Error("Tracking actions must not use CustomerOrderView or session ids.");
}

const service = readFileSync(resolve(root, "src/services/guest-tracking.ts"), "utf8");
if (!service.includes("createSupabaseAdminClient")) {
  throw new Error("Guest tracking must look up PR #10 orders with the service-role client.");
}
if (!service.includes("guestTrackingAttemptAllowed")) {
  throw new Error("Guest tracking must rate-limit before lookup.");
}
if (!service.includes("guestTrackingVerified") || !service.includes("toGuestOrderTrackingView")) {
  throw new Error("Guest tracking must verify email then return GuestOrderTrackingView.");
}
if (service.includes("CustomerOrderView") || service.includes("toCustomerOrderView")) {
  throw new Error("Guest tracking must not reuse CustomerOrderView.");
}
if (service.includes('.from("payments")') || service.includes("provider_payment_id")) {
  throw new Error("Guest tracking must not query payments or return provider payment ids.");
}
{
  const columnsStart = service.indexOf("const SHIPMENT_COLUMNS");
  const columns = service.slice(columnsStart, service.indexOf(";", columnsStart));
  if (columns.includes("notes")) {
    throw new Error("Shipment notes must not be selected for guest tracking.");
  }
}

const footer = readFileSync(resolve(root, "src/lib/navigation.ts"), "utf8");
if (!footer.includes('label: "Track Order"') || !footer.includes("routes.trackOrder")) {
  throw new Error("Footer Track Order link must stay wired to /track-order.");
}

const form = readFileSync(resolve(root, "src/components/tracking/TrackOrderForm.tsx"), "utf8");
if (!form.includes("orderReference") || !form.includes("email") || !form.includes("TRACK_ORDER_ACTION")) {
  throw new Error("Track-order form must collect reference + email.");
}
if (form.includes("CustomerOrderView") || form.includes("from \"@/contracts\"") || form.includes("from '@/contracts'")) {
  throw new Error("Track-order form must not import the contracts barrel or CustomerOrderView.");
}

const result = readFileSync(resolve(root, "src/components/tracking/TrackOrderResult.tsx"), "utf8");
if (!result.includes("TRACKING_UNAVAILABLE_COPY") || !result.includes("TRACK_WITH_CARRIER")) {
  throw new Error("Result view must handle unavailable tracking and pasted carrier URLs.");
}
if (result.includes("CustomerOrderView") || result.includes("carrier api") || result.includes("Royal Mail API")) {
  throw new Error("Guest result must stay on the manual-fulfilment view.");
}

const docs = readFileSync(resolve(root, "docs/PHASE3_GUEST_TRACKING.md"), "utf8");
if (!docs.includes("no orders until payment") && !docs.includes("empty")) {
  throw new Error("Guest tracking docs must record empty/not-found until payment handoff.");
}
if (!docs.includes("Admin dashboard") || !docs.includes("carrier")) {
  throw new Error("Guest tracking docs must record admin/payment/carrier stubs.");
}

console.log("verify-tracking: ok");
