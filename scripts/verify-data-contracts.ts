import {
  CART_MEDIATION_RULES,
  CART_MERGE_POLICY,
  createGuestCartSessionId,
  createOrderReference,
  customerPaymentState,
  deriveBrandSource,
  emailsMatch,
  guestCartCookieSetOptions,
  GUEST_CART_COOKIE_NAME,
  GUEST_TRACKING_GENERIC_ERROR,
  isGuestCartSessionId,
  isLegalOrderStatusTransition,
  isManualFulfilmentV1,
  isOrderReference,
  mapProductAggregateToStorefront,
  merchandisingFromCollectionSlugs,
  minorToMajorGbp,
  normalizeEmail,
  parseGenderTokens,
  parseGuestTrackingRequest,
  parseOrderReferenceInput,
  parseShapeTokens,
  PAYMENT_TRUST_RULES,
  paymentStub,
  selectableColourCount,
  toCustomerOrderView,
  toCustomerShipmentView,
  toGuestOrderTrackingView,
  toStorefrontImages,
} from "../src/contracts";
import type { ProductAggregate } from "../src/contracts";
import { getColourCount, getProducts } from "../src/services/catalogue";
import { assertDemoCatalogueIntegrity } from "../src/services/catalogue";

assertDemoCatalogueIntegrity();

const demo = getProducts();
if (demo.length !== 6) {
  throw new Error("Demo catalogue size changed; discovery fixtures must stay intact.");
}
if (demo.some((product) => !product.isDemo)) {
  throw new Error("Demo products must remain isDemo.");
}
const frame01 = demo.find((product) => product.slug === "frame-01");
if (!frame01 || getColourCount(frame01) !== 4) {
  throw new Error("Demo Frame 01 colour count must remain 4 for discovery UI.");
}

if (minorToMajorGbp(4900) !== 49 || minorToMajorGbp(4999) !== 49.99) {
  throw new Error("GBP minor→major conversion failed.");
}

if (parseGenderTokens("men, unisex").join(",") !== "men,unisex") {
  throw new Error("Gender token parse failed.");
}
if (parseGenderTokens("kids").length !== 0) {
  throw new Error("Unknown gender must be omitted, not invented.");
}
if (parseShapeTokens("Cat Eye").join(",") !== "cat-eye") {
  throw new Error("Shape alias parse failed.");
}
if (parseShapeTokens("oval").length !== 0) {
  throw new Error("Unknown shape must be omitted, not invented.");
}

const brand = deriveBrandSource("Demo Line A");
if (!brand || brand.id !== "demo-line-a" || brand.isDemo) {
  throw new Error("Derived brand must slugify name and not be marked demo.");
}
if (deriveBrandSource("   ") !== null) {
  throw new Error("Blank brand must not invent a record.");
}

const merch = merchandisingFromCollectionSlugs(["new-arrivals", "shop"]);
if (!merch.isNewArrival || merch.isBestSeller) {
  throw new Error("Merchandising flags must follow collection slugs only.");
}

const now = new Date().toISOString();
const publishedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const productId = "11111111-1111-1111-1111-111111111111";
const blackId = "22222222-2222-2222-2222-222222222222";
const greenId = "33333333-3333-3333-3333-333333333333";

const aggregate: ProductAggregate = {
  product: {
    id: productId,
    slug: "frame-live",
    name: "Frame Live",
    brand: "Line A",
    description: "A published frame.",
    details: { unknown: true },
    materials: "Acetate",
    whats_included: null,
    shape: "aviator",
    gender: "men",
    fit: "medium",
    disclosure: "High-quality 1:1 Superclone",
    status: "published",
    created_at: now,
    updated_at: now,
    published_at: publishedAt,
  },
  variants: [
    {
      id: blackId,
      product_id: productId,
      sku: "SHU-LIVE-BLK",
      colour_name: "Black",
      size_name: "Medium",
      price_minor: 4900,
      compare_at_price_minor: 5900,
      currency: "GBP",
      lens_width_mm: 52,
      bridge_width_mm: 18,
      temple_length_mm: 145,
      stock_quantity: 4,
      status: "available",
      created_at: now,
      updated_at: now,
    },
    {
      id: greenId,
      product_id: productId,
      sku: "SHU-LIVE-GRN",
      colour_name: "Green",
      size_name: "Medium",
      price_minor: 4900,
      compare_at_price_minor: null,
      currency: "GBP",
      lens_width_mm: 52,
      bridge_width_mm: 18,
      temple_length_mm: 145,
      stock_quantity: 0,
      status: "available",
      created_at: now,
      updated_at: now,
    },
  ],
  images: [
    {
      id: "44444444-4444-4444-4444-444444444444",
      product_id: productId,
      variant_id: null,
      storage_path: "product-images/frame-live/primary.webp",
      alt_text: "Frame Live front",
      sort_order: 0,
      image_type: "primary",
      is_primary: true,
      created_at: now,
      updated_at: now,
    },
  ],
  collectionSlugs: ["new-arrivals"],
};

if (selectableColourCount(aggregate.variants) !== 1) {
  throw new Error("Selectable colour count must ignore zero-stock colours.");
}

const card = mapProductAggregateToStorefront(aggregate, { projection: "card" });
if (!card) {
  throw new Error("Published product with a selectable variant must map.");
}
if (card.isDemo) {
  throw new Error("Live mapped products must not be marked isDemo.");
}
if (card.price !== 49 || card.compareAtPrice !== 59) {
  throw new Error("Card price must be major units from the priced variant.");
}
if (card.colours.length !== 1 || card.colours[0]?.slug !== "black") {
  throw new Error("Card projection must list selectable colours only.");
}
if (card.colours[0]?.hex) {
  throw new Error("Colour hex must not be invented.");
}
if (card.style.length > 0) {
  throw new Error("Style must stay empty until a taxonomy exists.");
}
if (card.images.length !== 0) {
  throw new Error("Images must not be projected without measured dimensions.");
}
if (!card.isNewArrival || card.isBestSeller) {
  throw new Error("Merchandising mapping failed.");
}
if (card.brandId !== "line-a") {
  throw new Error("Brand id must be the derived slug.");
}
if (card.pdp) {
  throw new Error("Card projection must not attach PDP extras.");
}

const pdp = mapProductAggregateToStorefront(aggregate, { projection: "pdp" });
if (!pdp || pdp.colours.length !== 2) {
  throw new Error("PDP projection must include unavailable colours.");
}
if (pdp.pdp?.materials !== "Acetate" || pdp.pdp?.fit !== "medium") {
  throw new Error("PDP extras mapping failed.");
}
if (pdp.pdp?.disclosure !== "High-quality 1:1 Superclone") {
  throw new Error("PDP disclosure must map from products.disclosure.");
}
const customDisclosure = mapProductAggregateToStorefront(
  {
    ...aggregate,
    product: { ...aggregate.product, disclosure: "  Studio sample  " },
  },
  { projection: "pdp" },
);
if (customDisclosure?.pdp?.disclosure !== "Studio sample") {
  throw new Error("PDP disclosure must pass through trimmed products.disclosure.");
}
const blankDisclosure = mapProductAggregateToStorefront(
  {
    ...aggregate,
    product: { ...aggregate.product, disclosure: "   " },
  },
  { projection: "pdp" },
);
if (blankDisclosure?.pdp?.disclosure) {
  throw new Error("Blank disclosure must stay unset for the PDP fallback.");
}
if (pdp.measurements?.lensMm !== 52) {
  throw new Error("Shared measurements must map when variants agree.");
}

const draft = mapProductAggregateToStorefront(
  { ...aggregate, product: { ...aggregate.product, status: "draft" } },
  { projection: "card" },
);
if (draft) {
  throw new Error("Draft products must not map to the storefront.");
}

if (toStorefrontImages(aggregate.images).length !== 0) {
  throw new Error("Relative storage paths must not become image src.");
}

const sessionId = createGuestCartSessionId();
if (!isGuestCartSessionId(sessionId)) {
  throw new Error("Guest cart session id format failed.");
}
const cookie = guestCartCookieSetOptions(sessionId, { secure: true });
if (
  cookie.name !== GUEST_CART_COOKIE_NAME ||
  !cookie.httpOnly ||
  cookie.sameSite !== "lax"
) {
  throw new Error("Guest cart cookie attributes failed.");
}
if (CART_MEDIATION_RULES.anonRlsWrites) {
  throw new Error("Anon RLS cart writes must stay closed.");
}
if (CART_MERGE_POLICY.soldOut !== "drop_with_notice") {
  throw new Error("Merge policy must not drop sold-out lines silently.");
}

const reference = createOrderReference();
if (!isOrderReference(reference) || reference === "SHU10294") {
  throw new Error("order_reference must be non-guessable SHU- + Crockford.");
}
if (parseOrderReferenceInput("shu-0123456789ab") !== "SHU-0123456789AB") {
  throw new Error("Order reference parse/normalise failed.");
}
if (parseOrderReferenceInput("SHU10294") !== null) {
  throw new Error("Sequential UI mock must not parse as a valid reference.");
}

if (normalizeEmail("  Syed@Example.COM ") !== "syed@example.com") {
  throw new Error("Email normalisation failed.");
}
if (!emailsMatch("syed@example.com", "Syed@Example.COM")) {
  throw new Error("Email match must be case-insensitive.");
}
if (emailsMatch("a@b.com", "c@d.com")) {
  throw new Error("Distinct emails must not match.");
}

const parsed = parseGuestTrackingRequest({
  orderReference: reference,
  email: "guest@example.com",
});
if (!parsed.ok) {
  throw new Error("Valid guest tracking request must parse.");
}
const rejected = parseGuestTrackingRequest({ orderReference: "12345", email: "x@y.z" });
if (rejected.ok || rejected.message !== GUEST_TRACKING_GENERIC_ERROR) {
  throw new Error("Guessable references must fail with the generic error.");
}

if (customerPaymentState("captured") !== "PAYMENT_SUCCEEDED") {
  throw new Error("Captured payments map to succeeded.");
}
if (customerPaymentState("created") !== "PAYMENT_READY") {
  throw new Error("created maps to PAYMENT_READY, not paid.");
}
if (!PAYMENT_TRUST_RULES.webhooksOutOfScopeForPhase33) {
  throw new Error("Paid-state webhooks must remain out of scope for 3.3.");
}
const stub = paymentStub({
  provider: "unset",
  provider_order_id: null,
  provider_payment_id: null,
  status: "created",
});
if (stub.providerOrderId !== null) {
  throw new Error("Payment stub must not invent provider ids.");
}

if (!isManualFulfilmentV1()) {
  throw new Error("V1 fulfilment must remain manual.");
}
if (!isLegalOrderStatusTransition("placed", "processing")) {
  throw new Error("placed → processing must be legal.");
}
if (isLegalOrderStatusTransition("delivered", "placed")) {
  throw new Error("delivered → placed must be illegal.");
}

const tracking = toGuestOrderTrackingView({
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
      address_line_1: "1 Example Street",
      city: "London",
      postcode: "W1A 1AA",
      country: "GB",
    },
    created_at: now,
    updated_at: now,
  },
  items: [
    {
      id: "66666666-6666-6666-6666-666666666666",
      order_id: "55555555-5555-5555-5555-555555555555",
      product_id: productId,
      product_variant_id: blackId,
      sku: "SHU-LIVE-BLK",
      product_name: "Frame Live",
      colour_name: "Black",
      variant_name: "Medium",
      quantity: 1,
      unit_price_minor: 4900,
      line_total_minor: 4900,
      product_snapshot: null,
      created_at: now,
    },
  ],
  shipment: toCustomerShipmentView(
    {
      id: "77777777-7777-7777-7777-777777777777",
      order_id: "55555555-5555-5555-5555-555555555555",
      carrier_name: null,
      tracking_number: null,
      tracking_url: null,
      status: "pending",
      shipped_at: null,
      delivered_at: null,
      notes: "internal only",
      created_at: now,
      updated_at: now,
    },
    [],
  ),
});
if (tracking.total !== 49) {
  throw new Error("Guest tracking total must be major units.");
}
if (JSON.stringify(tracking).includes("internal only")) {
  throw new Error("Shipment notes must not appear on guest tracking views.");
}
if (!tracking.deliveryAddress?.line1 || tracking.deliveryAddress.line1 !== "1 Example Street") {
  throw new Error("Guest tracking must map a customer-safe delivery address.");
}
if ("payment" in tracking || "customerFirstName" in tracking) {
  throw new Error("Guest tracking view must not reuse CustomerOrderView fields.");
}

const customerOrder = toCustomerOrderView({
  order: {
    id: "55555555-5555-5555-5555-555555555555",
    order_reference: reference,
    user_id: "11111111-1111-1111-1111-111111111111",
    customer_email: "guest@example.com",
    customer_first_name: "Guest",
    customer_last_name: "Customer",
    status: "in_transit",
    payment_status: "captured",
    currency: "GBP",
    subtotal_minor: 4900,
    shipping_minor: 0,
    total_minor: 4900,
    delivery_address: {
      address_line_1: "1 Example Street",
      city: "London",
      postcode: "W1A 1AA",
      country: "GB",
      extra_internal: "do-not-leak",
    },
    created_at: now,
    updated_at: now,
  },
  items: [
    {
      id: "66666666-6666-6666-6666-666666666666",
      order_id: "55555555-5555-5555-5555-555555555555",
      product_id: productId,
      product_variant_id: blackId,
      sku: "SHU-LIVE-BLK",
      product_name: "Frame Live",
      colour_name: "Black",
      variant_name: "Medium",
      quantity: 1,
      unit_price_minor: 4900,
      line_total_minor: 4900,
      product_snapshot: null,
      created_at: now,
    },
  ],
  shipment: toCustomerShipmentView(
    {
      id: "77777777-7777-7777-7777-777777777777",
      order_id: "55555555-5555-5555-5555-555555555555",
      carrier_name: "Royal Mail",
      tracking_number: "AB123",
      tracking_url: "https://example.com/track/AB123",
      status: "in_transit",
      shipped_at: now,
      delivered_at: null,
      notes: "internal only",
      created_at: now,
      updated_at: now,
    },
    [],
  ),
  events: [
    {
      id: "88888888-8888-8888-8888-888888888888",
      order_id: "55555555-5555-5555-5555-555555555555",
      event_type: "order_status_changed",
      old_status: "processing",
      new_status: "in_transit",
      actor_user_id: "99999999-9999-9999-9999-999999999999",
      metadata: { staff: true },
      customer_visible: true,
      created_at: now,
    },
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      order_id: "55555555-5555-5555-5555-555555555555",
      event_type: "internal_note",
      old_status: null,
      new_status: null,
      actor_user_id: "99999999-9999-9999-9999-999999999999",
      metadata: { secret: "nope" },
      customer_visible: false,
      created_at: now,
    },
  ],
});
if (customerOrder.status !== "in_transit" || customerOrder.statusLabel !== "IN TRANSIT") {
  throw new Error("Account order status must use the locked customer vocabulary.");
}
if (customerOrder.shipment?.trackingNumber !== "AB123") {
  throw new Error("Customer shipment tracking number must remain available without changing status.");
}
if (JSON.stringify(customerOrder).includes("internal only") || JSON.stringify(customerOrder).includes("99999999")) {
  throw new Error("Customer order views must not expose shipment notes or actor ids.");
}
if (JSON.stringify(customerOrder).includes("do-not-leak") || JSON.stringify(customerOrder).includes("secret")) {
  throw new Error("Customer order views must not dump raw delivery jsonb or hidden event metadata.");
}
if ("payment" in customerOrder || customerOrder.paymentState !== "PAYMENT_SUCCEEDED") {
  throw new Error("Customer payment summary must be the safe mapped state, not provider ids.");
}
if (customerOrder.events.length !== 1 || customerOrder.events[0]?.eventType !== "order_status_changed") {
  throw new Error("Only customer-visible order events may appear on the account order view.");
}

console.log("Data contracts OK");
