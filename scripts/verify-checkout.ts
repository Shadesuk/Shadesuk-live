import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHECKOUT_DRAFT_COOKIE,
  CHECKOUT_DRAFT_TTL_MS,
  decodeCheckoutDraftCookie,
  encodeCheckoutDraftCookie,
} from "../src/lib/checkout-draft";
import {
  GUEST_COOKIE_HMAC_VERSION,
  resolveGuestCookieSecret,
  signGuestCookiePayload,
} from "../src/lib/guest-cookie-hmac";
import {
  ALL_MAJOR_CARDS,
  ADDRESS_LOOKUP_EMPTY,
  ADDRESS_SEARCH_HINT,
  ADDRESS_SEARCH_LABEL,
  ADDRESS_SEARCH_PLACEHOLDER,
  CHECKOUT_EXPIRED_BODY,
  CHECKOUT_EXPIRED_TITLE,
  CONTINUE_AS_GUEST,
  CONTINUE_TO_PAYMENT,
  ENTER_ADDRESS_MANUALLY,
  FIND_ADDRESS,
  PAYMENT_NEXT_BODY,
  POSTCODE_INVALID,
  SECURE_CARD_PAYMENT,
  SHIPPING_BODY,
  SHIPPING_CALCULATED_LATER,
  SHIPPING_MINIMUM,
  UK_STANDARD_DELIVERY,
  CHECKOUT_PRICE_CHANGED,
  CHECKOUT_ITEM_UNAVAILABLE,
  CHECKOUT_START_AGAIN,
} from "../src/lib/checkout-copy";
import { formatGbpMinor } from "../src/lib/money";
import { STORE_CURRENCY } from "../src/contracts/money";
import {
  authoritativeCheckoutQuote,
  checkoutHasPriceChange,
  checkoutQuoteFromCart,
  checkoutUnavailableBlocked,
  UK_STANDARD_DELIVERY_MINOR,
} from "../src/lib/checkout-quote";
import type { PublicCart } from "../src/types/cart";
import { guestCartCookieSecure } from "../src/lib/guest-cart-cookie-secure";
import { isAllowedCartActionOrigin } from "../src/lib/cart-origin";
import {
  formatUkPostcode,
  hasCheckoutFieldErrors,
  isUkPostcodeLookupQuery,
  validateCheckoutAddress,
  validateCheckoutEmail,
} from "../src/lib/checkout-validate";
import { routes } from "../src/lib/navigation";
import {
  containsForbiddenCartOwnership,
  hasForbiddenOwnershipKey,
} from "../src/lib/ownership-keys";
import { createGuestCartSessionId } from "../src/contracts";
import {
  getAddressLookupProvider,
  isAddressLookupConfigured,
  lookupAddresses,
  retrieveAddress,
  unsetAddressLookupProvider,
} from "../src/lib/address-lookup";
import { addressLookupAttemptAllowed, resetAddressLookupRateLimitForTests } from "../src/lib/address-lookup-rate-limit";
import {
  compactUkPostcodeQuery,
  createPostcodesIoProvider,
  POSTCODES_IO_BASE_URL,
} from "../src/lib/address-providers/postcodes-io";
import {
  CHECKOUT_COUNTRY_GB,
  emptyCheckoutDraft,
  type PublicCheckoutDraft,
} from "../src/types/checkout";
import type { AddressLookupProvider } from "../src/types/integrations";
import { mergeLookupPostalAddress } from "../src/lib/address-merge";
import { enabledPaymentMethods, PAYMENT_METHODS } from "../src/lib/payment-methods";

if (routes.checkout !== "/checkout") {
  throw new Error("Checkout route must stay /checkout.");
}

if (CHECKOUT_DRAFT_COOKIE !== "shadesuk_guest_checkout") {
  throw new Error("Checkout draft cookie name must stay shadesuk_guest_checkout.");
}

if (CONTINUE_AS_GUEST !== "Continue as guest") {
  throw new Error("Guest checkout CTA copy must stay locked.");
}
if (ENTER_ADDRESS_MANUALLY !== "Enter address manually") {
  throw new Error("Manual address fallback copy must stay locked.");
}
if (ADDRESS_SEARCH_LABEL !== "Postcode" || ADDRESS_SEARCH_PLACEHOLDER !== "Enter postcode") {
  throw new Error("Checkout lookup must be postcode-first.");
}
if (ADDRESS_SEARCH_HINT !== "Enter your UK postcode to find your area.") {
  throw new Error("Postcode lookup hint must stay accurate.");
}
if (FIND_ADDRESS !== "Find address") {
  throw new Error("Find address CTA copy must stay locked.");
}
if (ADDRESS_LOOKUP_EMPTY !== "No postcode found. Enter address manually.") {
  throw new Error("Empty lookup copy must not claim household addresses.");
}
if (CONTINUE_TO_PAYMENT !== "Continue to payment") {
  throw new Error("Payment CTA copy must stay locked.");
}
if (CHECKOUT_EXPIRED_TITLE !== "Checkout session expired") {
  throw new Error("Expired checkout title must stay locked.");
}
if (!CHECKOUT_EXPIRED_BODY.includes("cart is still available")) {
  throw new Error("Expired checkout must keep the cart available.");
}
if (SHIPPING_CALCULATED_LATER !== "Calculated later") {
  throw new Error("Bag shipping placeholder copy must stay locked.");
}
if (UK_STANDARD_DELIVERY !== "UK Standard Delivery") {
  throw new Error("Checkout shipping label must stay UK Standard Delivery.");
}
if (UK_STANDARD_DELIVERY_MINOR !== 465) {
  throw new Error("UK standard delivery must be 465 GBP minor units.");
}
if (formatGbpMinor(UK_STANDARD_DELIVERY_MINOR) !== "£4.65") {
  throw new Error("UK standard delivery must display as £4.65.");
}
if (!CHECKOUT_PRICE_CHANGED.toLowerCase().includes("current price")) {
  throw new Error("Price-change copy must use the current price, not a silent old snapshot.");
}
if (!CHECKOUT_ITEM_UNAVAILABLE.toLowerCase().includes("no longer available")) {
  throw new Error("Unavailable-item copy must identify that a shade cannot be bought.");
}
if (CHECKOUT_START_AGAIN !== "Start checkout again") {
  throw new Error("Expired checkout recovery CTA must stay locked.");
}

const tamperedQuote = authoritativeCheckoutQuote({
  subtotalMinor: 4900,
  shippingMinor: 0,
  totalMinor: 1,
  currency: "USD",
  subtotal: 100,
  shipping: 0,
  total: 100,
});
if (
  tamperedQuote.shippingMinor !== 465 ||
  tamperedQuote.totalMinor !== 5365 ||
  tamperedQuote.currency !== STORE_CURRENCY ||
  tamperedQuote.subtotalMinor !== 4900
) {
  throw new Error("Client shipping, total, and currency must not override the server quote.");
}
if (formatGbpMinor(tamperedQuote.totalMinor) !== "£53.65") {
  throw new Error("Authoritative checkout total must display as subtotal plus £4.65.");
}

const quotedCart: PublicCart = {
  items: [
    {
      id: "line-1",
      productId: "product-1",
      slug: "shade",
      name: "Shade",
      href: "/products/shade",
      colourName: "Black",
      quantity: 1,
      unitPrice: 49,
      lineTotal: 49,
      currency: "GBP",
    },
  ],
  itemCount: 1,
  subtotal: 1,
  currency: "GBP",
  issues: [],
};
const cartQuote = checkoutQuoteFromCart(quotedCart);
if (cartQuote.subtotalMinor !== 4900 || cartQuote.shippingMinor !== 465 || cartQuote.totalMinor !== 5365) {
  throw new Error("Checkout quote must derive subtotal from live line prices, not a client subtotal.");
}
if (!checkoutUnavailableBlocked({ ...quotedCart, items: [] })) {
  throw new Error("Empty checkout carts must block payable progression.");
}
if (
  !checkoutUnavailableBlocked({
    ...quotedCart,
    issues: [{ issue: "variant_unavailable", message: "gone", itemId: "line-1" }],
  })
) {
  throw new Error("Unavailable variants must block checkout progression.");
}
if (
  !checkoutUnavailableBlocked({
    ...quotedCart,
    issues: [{ issue: "product_removed", message: "gone", itemId: "line-1" }],
  })
) {
  throw new Error("Removed products must block checkout progression.");
}
if (
  !checkoutHasPriceChange({
    ...quotedCart,
    issues: [{ issue: "price_changed", message: "changed", itemId: "line-1" }],
  })
) {
  throw new Error("Price changes must be visible on checkout.");
}
if (!SHIPPING_MINIMUM.toLowerCase().includes("2-week")) {
  throw new Error("Checkout must show the minimum 2-week delivery expectation.");
}
if (SHIPPING_BODY.toLowerCase().includes("international")) {
  throw new Error("UK checkout must not describe delivery as international.");
}
if (SECURE_CARD_PAYMENT !== "Secure card payment" || ALL_MAJOR_CARDS !== "All major cards accepted") {
  throw new Error("Payment trust copy must stay locked.");
}
if (!PAYMENT_NEXT_BODY.includes("Nothing has been charged")) {
  throw new Error("Payment stub must state that nothing has been charged.");
}

if (!isAddressLookupConfigured()) {
  throw new Error("Address lookup factory must expose a server-side provider.");
}
if (getAddressLookupProvider() === null) {
  throw new Error("Address lookup factory must not return unset in production code.");
}
if (compactUkPostcodeQuery("221B Baker Street") !== null) {
  throw new Error("Street text must not be sent to Postcodes.io.");
}
if (compactUkPostcodeQuery("sw1a 1aa") !== "SW1A1AA") {
  throw new Error("Complete UK postcodes must compact before the provider request.");
}
if (compactUkPostcodeQuery("SW1") !== "SW1") {
  throw new Error("Partial UK postcodes must be allowed as search queries.");
}

void (async () => {
  const streetQuery = await lookupAddresses("221B Baker Street");
  if (streetQuery.status !== "ok" || streetQuery.suggestions.length !== 0) {
    throw new Error("Non-postcode queries must not invent household addresses.");
  }
  const unsetSearch = await unsetAddressLookupProvider.search("SW1A 1AA");
  if (unsetSearch.length !== 0) {
    throw new Error("Unset provider search must not return suggestions.");
  }
  const unsetRetrieve = await retrieveAddress("SW1A 1AA", unsetAddressLookupProvider);
  if (unsetRetrieve.status !== "unavailable") {
    throw new Error("Unset provider retrieve must stay unavailable so manual entry remains.");
  }

  const fakeProvider: AddressLookupProvider = {
    async search(query) {
      if (query.toLowerCase().includes("baker")) {
        return [{ id: "addr-1", label: "221B Baker Street, London NW1" }];
      }
      return [];
    },
    async retrieve(id) {
      if (id !== "addr-1") {
        throw new Error("unknown");
      }
      return {
        line1: "221B Baker Street",
        city: "London",
        postcode: "NW1 6XE",
        country: "GB",
      };
    },
  };

  const found = await lookupAddresses("Baker Street", fakeProvider);
  if (found.status !== "ok" || found.suggestions.length !== 1) {
    throw new Error("Address lookup abstraction must accept a replaceable provider.");
  }
  const retrieved = await retrieveAddress("addr-1", fakeProvider);
  if (retrieved.status !== "ok" || retrieved.address.line1 !== "221B Baker Street") {
    throw new Error("Address retrieve must populate fields from the provider.");
  }

  const requested: string[] = [];
  const postcodesIo = createPostcodesIoProvider({
    async fetch(url) {
      requested.push(url);
      const parsed = new URL(url);
      if (parsed.pathname === "/postcodes" && parsed.searchParams.get("q") === "SW1A1AA") {
        return new Response(
          JSON.stringify({
            status: 200,
            result: [
              {
                postcode: "SW1A 1AA",
                admin_district: "Westminster",
                admin_county: null,
                region: "London",
                country: "England",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (parsed.pathname === "/postcodes/SW1A1AA") {
        return new Response(
          JSON.stringify({
            status: 200,
            result: {
              postcode: "SW1A 1AA",
              admin_district: "Westminster",
              admin_county: null,
              region: "London",
              country: "England",
              longitude: -0.127695,
              latitude: 51.50354,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (parsed.pathname === "/postcodes/ZZ99ZZZ") {
        return new Response(JSON.stringify({ status: 404, error: "Postcode not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (parsed.pathname === "/postcodes" && parsed.searchParams.get("q") === "XX1") {
        return new Response(JSON.stringify({ status: 200, result: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("unexpected", { status: 500 });
    },
  });

  const searched = await lookupAddresses("sw1a 1aa", postcodesIo);
  if (searched.status !== "ok" || searched.suggestions.length !== 1) {
    throw new Error("Postcodes.io search must use GET /postcodes?q= and return postcode suggestions.");
  }
  if (searched.suggestions[0]?.label !== "SW1A 1AA" || searched.suggestions[0]?.id !== "SW1A 1AA") {
    throw new Error("Postcode suggestions must not be labelled as street addresses.");
  }
  if (!requested[0]?.startsWith(`${POSTCODES_IO_BASE_URL}/postcodes?q=SW1A1AA`)) {
    throw new Error("Postcodes.io search must call the documented search endpoint.");
  }

  const filled = await retrieveAddress("SW1A 1AA", postcodesIo);
  if (filled.status !== "ok") {
    throw new Error("Postcodes.io retrieve must use GET /postcodes/:postcode.");
  }
  if (filled.address.line1 !== "" || filled.address.line2) {
    throw new Error("Postcodes.io must not invent household street lines.");
  }
  if (
    filled.address.postcode !== "SW1A 1AA" ||
    filled.address.country !== CHECKOUT_COUNTRY_GB ||
    filled.address.city !== "Westminster" ||
    filled.address.county !== "London"
  ) {
    throw new Error("Postcodes.io retrieve must map postcode, GB, city, and county only.");
  }
  if (JSON.stringify(filled).includes("longitude") || JSON.stringify(filled).includes("latitude")) {
    throw new Error("Raw Postcodes.io fields must not reach the application view.");
  }
  if (!requested.some((url) => url === `${POSTCODES_IO_BASE_URL}/postcodes/SW1A1AA`)) {
    throw new Error("Exact postcode lookup must use the documented /postcodes/:postcode endpoint.");
  }

  const emptySearch = await lookupAddresses("XX1", postcodesIo);
  if (emptySearch.status !== "ok" || emptySearch.suggestions.length !== 0) {
    throw new Error("Empty Postcodes.io search results must be an empty suggestion list.");
  }
  const missing = await retrieveAddress("ZZ9 9ZZ", postcodesIo);
  if (missing.status !== "error") {
    throw new Error("Unknown postcodes must not crash checkout.");
  }
  const timedOut = await retrieveAddress(
    "SW1A 1AA",
    createPostcodesIoProvider({
      timeoutMs: 20,
      fetch: (_url, init) =>
        new Promise((_, reject) => {
          init.signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    }),
  );
  if (timedOut.status !== "error") {
    throw new Error("Postcodes.io timeouts must fail safely.");
  }
  const skipped = await lookupAddresses("10 Downing Street", postcodesIo);
  if (skipped.status !== "ok" || skipped.suggestions.length !== 0) {
    throw new Error("Street queries must not call Postcodes.io or return fake houses.");
  }
  if (requested.some((url) => url.toLowerCase().includes("downing") || url.toLowerCase().includes("baker"))) {
    throw new Error("Provider must not send street text to Postcodes.io.");
  }

  resetAddressLookupRateLimitForTests();
  if (!addressLookupAttemptAllowed("203.0.113.10")) {
    throw new Error("Address lookup rate limit must allow the first attempt.");
  }

if (hasCheckoutFieldErrors(validateCheckoutEmail("guest@example.com"))) {
  throw new Error("Valid email must pass.");
}
if (validateCheckoutEmail("").email !== "Enter an email.") {
  throw new Error("Missing email must use locked copy.");
}
if (validateCheckoutEmail("not-an-email").email !== "Enter a valid email.") {
  throw new Error("Invalid email must use locked copy.");
}

const validAddress = validateCheckoutAddress({
  firstName: "Ada",
  lastName: "Lovelace",
  line1: "1 Example Street",
  city: "London",
  postcode: "W1A 1AA",
  country: "GB",
});
if (hasCheckoutFieldErrors(validAddress)) {
  throw new Error("Complete UK address must pass.");
}
if (validateCheckoutAddress({ ...validAddressInput(), postcode: "123" }).postcode !== POSTCODE_INVALID) {
  throw new Error("Invalid postcode must use locked copy.");
}
const unitedStates = validateCheckoutAddress({
  ...validAddressInput(),
  country: "US",
  city: "New York",
  postcode: "10001",
});
if (hasCheckoutFieldErrors(unitedStates)) {
  throw new Error("A seeded United States address must pass.");
}
if (hasCheckoutFieldErrors(validateCheckoutAddress({ ...validAddressInput(), country: "JP", postcode: "1000001" }))) {
  throw new Error("Japan is a supported delivery country.");
}
if (
  validateCheckoutAddress({ ...validAddressInput(), country: "ZZ" }).country !==
  "Delivery is not available for that country."
) {
  throw new Error("A country outside the supported list must be rejected.");
}
if (formatUkPostcode("sw1a1aa") !== "SW1A 1AA") {
  throw new Error("UK postcodes must format with an inward-code space.");
}
if (isUkPostcodeLookupQuery("221B Baker Street") || isUkPostcodeLookupQuery("10 Downing Street")) {
  throw new Error("Street text must not be treated as a postcode lookup query.");
}
if (!isUkPostcodeLookupQuery("SW1A 1AA") || !isUkPostcodeLookupQuery("SW1")) {
  throw new Error("UK postcode queries must be accepted for lookup.");
}
const mergedLookup = mergeLookupPostalAddress(
  {
    firstName: "Ada",
    lastName: "Lovelace",
    line1: "10 Downing Street",
    line2: "Flat 1",
    city: "Old town",
    county: "Old county",
    postcode: "",
    country: "GB",
  },
  {
    line1: "",
    city: "Westminster",
    county: "London",
    postcode: "SW1A 1AA",
    country: "GB",
  },
);
if (
  mergedLookup.line1 !== "10 Downing Street" ||
  mergedLookup.line2 !== "Flat 1" ||
  mergedLookup.firstName !== "Ada" ||
  mergedLookup.city !== "Westminster" ||
  mergedLookup.postcode !== "SW1A 1AA"
) {
  throw new Error("Postcode lookup must not overwrite street or name fields.");
}

function validAddressInput() {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    line1: "1 Example Street",
    city: "London",
    postcode: "W1A 1AA",
    country: "GB",
  };
}

const sessionId = createGuestCartSessionId();
const cookieSecret = "verify-checkout-cookie-secret";
const draft: PublicCheckoutDraft = {
  ...emptyCheckoutDraft(),
  email: "guest@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  line1: "1 Example Street",
  city: "London",
  postcode: "W1A 1AA",
  country: CHECKOUT_COUNTRY_GB,
  addressEntry: "manual",
  step: "review",
};
const encoded = encodeCheckoutDraftCookie(sessionId, draft, Date.now(), cookieSecret);
if (
  encoded.includes(sessionId) ||
  encoded.toLowerCase().includes("sessionid") ||
  encoded.includes("session_id") ||
  !encoded.startsWith(`${GUEST_COOKIE_HMAC_VERSION}.`)
) {
  throw new Error("Checkout draft cookie must not embed the session id.");
}
if (containsForbiddenCartOwnership(draft)) {
  throw new Error("Public checkout draft must not include ownership keys.");
}
if (!hasForbiddenOwnershipKey({ email: "a@b.c", sessionId })) {
  throw new Error("Checkout actions must reject client-supplied session ids.");
}

const decoded = decodeCheckoutDraftCookie(sessionId, encoded, Date.now(), cookieSecret);
if (decoded.email !== "guest@example.com" || decoded.step !== "review" || decoded.expired) {
  throw new Error("Checkout draft cookie must round-trip fields.");
}
if (decodeCheckoutDraftCookie("ff".repeat(32), encoded, Date.now(), cookieSecret).email !== "") {
  throw new Error("Checkout draft cookie must reject a mismatched session signature.");
}
if (decodeCheckoutDraftCookie(sessionId, encoded, Date.now(), "other-server-secret").email !== "") {
  throw new Error("Checkout draft cookie must reject a mismatched server secret.");
}
if (
  signGuestCookiePayload(sessionId, "{}", cookieSecret) ===
  signGuestCookiePayload(sessionId, "{}")
) {
  throw new Error("Checkout cookie HMAC must not be keyed only by sessionId.");
}
if (
  resolveGuestCookieSecret({
    guestCookieSecret: "",
    supabaseSecret: "",
    nodeEnv: "production",
  }) !== ""
) {
  throw new Error("Checkout production HMAC must fail closed without a server secret.");
}

const expired = decodeCheckoutDraftCookie(
  sessionId,
  encoded,
  Date.now() + CHECKOUT_DRAFT_TTL_MS + 1000,
  cookieSecret,
);
if (!expired.expired || expired.email !== "guest@example.com") {
  throw new Error("Expired checkout drafts must keep fields and flag expiry.");
}

if (
  !isAllowedCartActionOrigin({
    origin: "http://localhost:3000",
    referer: null,
    host: "localhost:3000",
    siteUrl: "http://localhost:3000",
  })
) {
  throw new Error("Same-origin checkout actions must be allowed.");
}
if (
  isAllowedCartActionOrigin({
    origin: "https://evil.example",
    referer: null,
    host: "localhost:3000",
    siteUrl: "http://localhost:3000",
  })
) {
  throw new Error("Cross-origin checkout actions must be rejected.");
}

if (
  !guestCartCookieSecure({
    nodeEnv: "production",
    siteUrl: "https://shadesuk.example",
  })
) {
  throw new Error("Production checkout cookies must be Secure.");
}

const pageSource = readFileSync(resolve("src/app/(storefront)/checkout/page.tsx"), "utf8");
if (!pageSource.includes("redirect(routes.cart)") && !pageSource.includes('redirect("/cart")')) {
  throw new Error("Empty checkout carts must redirect to bag.");
}
if (pageSource.includes("CheckoutPlaceholder")) {
  throw new Error("Checkout placeholder must be replaced.");
}

const reviewSource = readFileSync(
  resolve("src/components/checkout/CheckoutReview.tsx"),
  "utf8",
);
if (!reviewSource.includes("initiateCheckoutPaymentAction") || !reviewSource.includes("data-paypal-button")) {
  throw new Error("The official PayPal button must start the server PayPal initiation action.");
}
if (!reviewSource.includes("mountPayPalCheckout") || !reviewSource.includes("verifyCheckoutPaymentAction")) {
  throw new Error("Checkout review must mount PayPal Buttons and send approval to server verification.");
}
if (reviewSource.includes("openRazorpayCheckout") || reviewSource.toLowerCase().includes("checkout.js")) {
  throw new Error("Checkout review must not wire a Razorpay handler.");
}
if (!reviewSource.includes("orderConfirmationPath") || !reviewSource.includes("{ scroll: true }")) {
  throw new Error("Checkout review must redirect to confirmation only after the server capture result, and reset scroll.");
}
if (
  reviewSource.includes("PAYPAL_CLIENT_SECRET") ||
  reviewSource.includes("PAYPAL_WEBHOOK_ID") ||
  reviewSource.includes("RAZORPAY_")
) {
  throw new Error("Checkout review must never contain payment secrets.");
}
if (
  reviewSource.includes("orders.create") ||
  reviewSource.includes("createPayPalOrder") ||
  reviewSource.includes("openRazorpayCheckout") ||
  reviewSource.toLowerCase().includes("checkout.js")
) {
  throw new Error("The browser must not create PayPal/Razorpay orders or load Checkout.js.");
}
if (!reviewSource.includes("PaymentMethods")) {
  throw new Error("Checkout must reuse the payment methods presentation.");
}
if (
  reviewSource.toLowerCase().includes("apple pay") ||
  reviewSource.toLowerCase().includes("google pay") ||
  reviewSource.toLowerCase().includes("klarna")
) {
  throw new Error("Checkout must not present reserved payment methods as active.");
}

const enabledMethods = enabledPaymentMethods();
if (enabledMethods.map((method) => method.id).join(",") !== "visa,mastercard,amex") {
  throw new Error("Active payment presentation must be Visa, Mastercard, and American Express.");
}
for (const reserved of ["apple_pay", "google_pay", "klarna"] as const) {
  const method = PAYMENT_METHODS.find((item) => item.id === reserved);
  if (!method || method.enabled) {
    throw new Error(`${reserved} must stay reserved until PayPal enables it.`);
  }
}
if (enabledMethods.some((method) => !method.markSrc)) {
  throw new Error("Active card methods must use the supplied brand artwork.");
}
for (const required of [
  ["visa", "/payment/visa.jpg"],
  ["mastercard", "/payment/mastercard.jpg"],
  ["amex", "/payment/amex.png"],
] as const) {
  const method = PAYMENT_METHODS.find((item) => item.id === required[0]);
  if (!method?.markSrc || method.markSrc !== required[1]) {
    throw new Error(`${required[0]} must use the supplied ${required[1]} asset.`);
  }
  if (!existsSync(resolve(`public${required[1]}`))) {
    throw new Error(`Missing supplied payment mark public${required[1]}.`);
  }
}

const pdpHero = readFileSync(resolve("src/components/pdp/ProductHero.tsx"), "utf8");
if (!pdpHero.includes("PaymentMethods")) {
  throw new Error("PDP must reuse the payment methods presentation.");
}
if (pdpHero.includes("@razorpay") || pdpHero.toLowerCase().includes("checkout.js") || pdpHero.includes("paypal.com/sdk")) {
  throw new Error("PDP must not load a payment SDK.");
}

const contactSource = readFileSync(resolve("src/components/checkout/CheckoutContact.tsx"), "utf8");
if (!contactSource.includes("CONTINUE_AS_GUEST") || !contactSource.includes("GoogleAuthButton")) {
  throw new Error("Checkout contact must keep guest continue and reuse Google OAuth.");
}
if (!contactSource.includes("next={routes.checkout}")) {
  throw new Error("Checkout Google OAuth must return to /checkout.");
}
if (!contactSource.includes("onBeforeAuth") || !contactSource.includes("saveCheckoutContactAction")) {
  throw new Error("Checkout Google sign-in must persist an already entered email through the existing draft.");
}
if (contactSource.toLowerCase().includes("discover") || contactSource.toLowerCase().includes("apple pay")) {
  throw new Error("Checkout contact must not add extra payment brands.");
}

const checkoutScrollSource = readFileSync(resolve("src/components/checkout/CheckoutPage.tsx"), "utf8");
if (!checkoutScrollSource.includes("usePinPageStart") || !checkoutScrollSource.includes("checkout-heading")) {
  throw new Error("Checkout step changes must pin the viewport to the top of the step.");
}
const checkoutCss = readFileSync(resolve("src/components/checkout/CheckoutPage.module.css"), "utf8");
if (!checkoutCss.includes("overflow-anchor: none")) {
  throw new Error("Checkout must disable scroll anchoring so the payment CTA does not hold the viewport.");
}
const confirmationSource = readFileSync(resolve("src/components/checkout/OrderConfirmation.tsx"), "utf8");
if (!confirmationSource.includes("PinPageStart")) {
  throw new Error("Order confirmation must open at the top of the page.");
}

const checkoutFiles = [
  "src/app/(storefront)/checkout/page.tsx",
  "src/app/(storefront)/checkout/actions.ts",
  "src/components/checkout/CheckoutPage.tsx",
  "src/lib/address-lookup.ts",
  "src/lib/checkout-quote.ts",
  "src/services/checkout.ts",
];
for (const file of checkoutFiles) {
  const source = readFileSync(resolve(file), "utf8");
  const lower = source.toLowerCase();
  if (lower.includes("stripe") || lower.includes("razorpay") || lower.includes("checkout.js")) {
    throw new Error(
      `${file} must not host Razorpay/Stripe SDKs, secrets, or Checkout.js. Client Checkout Buttons live in CheckoutReview; server PayPal lives in src/lib/paypal.`,
    );
  }
  if (source.includes("PAYPAL_CLIENT_SECRET") || source.includes("RAZORPAY_KEY_SECRET")) {
    throw new Error(`${file} must never contain payment secrets.`);
  }
}
const confirmationPage = readFileSync(
  resolve("src/app/(storefront)/checkout/confirmation/page.tsx"),
  "utf8",
);
if (!confirmationPage.includes("loadCapturedCheckoutConfirmation")) {
  throw new Error("Confirmation page must load authoritative captured order state.");
}
if (
  confirmationPage.includes("razorpay") ||
  confirmationPage.includes("paypal") ||
  confirmationPage.includes("paid=true")
) {
  throw new Error("Confirmation page must not trust a payment provider SDK or a client paid flag.");
}

const paymentActions = readFileSync(resolve("src/app/(storefront)/checkout/payment-actions.ts"), "utf8");
if (!paymentActions.includes("cartActionOriginAllowed")) {
  throw new Error("Payment Server Actions must keep CSRF/origin checks.");
}
if (
  !paymentActions.includes("initiatePendingPayPalPayment") ||
  !paymentActions.includes("verifyPayPalClientReturn") ||
  !paymentActions.includes("captureVerifiedPayment")
) {
  throw new Error("Payment actions must reuse the PayPal initiate, verify, and capture services.");
}
if (
  paymentActions.includes("PAYPAL_CLIENT_SECRET") ||
  paymentActions.includes("RAZORPAY_KEY_SECRET") ||
  paymentActions.includes("RAZORPAY_WEBHOOK_SECRET")
) {
  throw new Error("Payment actions must not embed payment secret names in client-bound results.");
}
if (paymentActions.includes("SUPABASE_SECRET_KEY") || paymentActions.includes("SERVICE_ROLE")) {
  throw new Error("Payment actions must not return service-role credentials.");
}
const actionsSource = readFileSync(resolve("src/app/(storefront)/checkout/actions.ts"), "utf8");
if (!actionsSource.includes("cartActionOriginAllowed")) {
  throw new Error("Checkout Server Actions must keep CSRF/origin checks.");
}
if (
  !actionsSource.includes("searchCheckoutAddressAction") ||
  !actionsSource.includes("retrieveCheckoutAddressAction") ||
  !actionsSource.includes("lookupAddresses") ||
  !actionsSource.includes("retrieveAddress") ||
  !actionsSource.includes("addressLookupAttemptAllowed")
) {
  throw new Error("Checkout Server Actions must remain the address lookup boundary and rate-limit it.");
}
if (actionsSource.includes("api.postcodes.io") || actionsSource.includes("createPostcodesIoProvider")) {
  throw new Error("Server Actions must not call Postcodes.io directly.");
}
if (!actionsSource.includes("restartCheckoutDraftAction")) {
  throw new Error("Expired checkout must restart through the existing draft action.");
}
if (
  /saveCheckoutAddressAction[\s\S]*shippingMinor/.test(actionsSource) ||
  /saveCheckoutContactAction[\s\S]*totalMinor/.test(actionsSource) ||
  actionsSource.includes("currency:")
) {
  throw new Error("Checkout Server Actions must not accept payable money or currency from the client.");
}

const clientLookupFiles = [
  "src/components/address/AddressLookup.tsx",
  "src/components/address/AddressForm.tsx",
  "src/components/checkout/CheckoutPage.tsx",
  "src/components/checkout/CheckoutAddress.tsx",
];
for (const file of clientLookupFiles) {
  const source = readFileSync(resolve(file), "utf8");
  if (source.includes("api.postcodes.io") || source.includes("address-providers/postcodes-io")) {
    throw new Error(`${file} must not call Postcodes.io from the browser.`);
  }
  if (source.includes("NEXT_PUBLIC_")) {
    throw new Error(`${file} must not expose provider config.`);
  }
}
const lookupUi = readFileSync(resolve("src/components/address/AddressLookup.tsx"), "utf8");
if (!lookupUi.includes("ENTER_ADDRESS_MANUALLY")) {
  throw new Error("Manual address fallback must remain in the lookup UI.");
}
if (!lookupUi.includes("FIND_ADDRESS") || !lookupUi.includes('type="button"')) {
  throw new Error("Postcode lookup must use an explicit Find address button.");
}
if (lookupUi.includes("queueSearch") || lookupUi.toLowerCase().includes("start typing your address")) {
  throw new Error("Lookup must not present fake household autocomplete.");
}
if (lookupUi.includes("searchCheckoutAddressAction") === false && !readFileSync(resolve("src/components/checkout/CheckoutPage.tsx"), "utf8").includes("searchCheckoutAddressAction")) {
  throw new Error("Checkout must keep Server Actions as the lookup entry point.");
}

const envExample = readFileSync(resolve(".env.example"), "utf8");
if (/NEXT_PUBLIC_.*POSTCODE|NEXT_PUBLIC_.*ADDRESS/.test(envExample)) {
  throw new Error("No NEXT_PUBLIC address/postcode provider key may exist.");
}
const providerSource = readFileSync(resolve("src/lib/address-providers/postcodes-io.ts"), "utf8");
if (providerSource.includes("NEXT_PUBLIC_") || /api[_-]?key/i.test(providerSource)) {
  throw new Error("Postcodes.io adapter must not introduce an API key.");
}
const factorySource = readFileSync(resolve("src/lib/address-lookup.ts"), "utf8");
if (!factorySource.includes("postcodesIoAddressLookupProvider")) {
  throw new Error("Postcodes.io must be selected from the server-side factory.");
}
if (factorySource.includes("NEXT_PUBLIC_")) {
  throw new Error("Address lookup factory must not use public client config.");
}

const summarySource = readFileSync(resolve("src/components/checkout/CheckoutSummary.tsx"), "utf8");
if (!summarySource.includes("UK_STANDARD_DELIVERY") || !summarySource.includes("quote.shippingMinor")) {
  throw new Error("Checkout summary must show authoritative UK Standard Delivery.");
}
if (!summarySource.includes("quote.totalMinor") || !summarySource.includes("quote.subtotalMinor")) {
  throw new Error("Checkout summary must display the server quote, not client totals.");
}

const checkoutPageSource = readFileSync(resolve("src/components/checkout/CheckoutPage.tsx"), "utf8");
if (!checkoutPageSource.includes("initialDraft") || !checkoutPageSource.includes("initialQuote")) {
  throw new Error("Checkout UI must hydrate from the server draft and quote.");
}
if (checkoutPageSource.includes("localStorage") || checkoutPageSource.includes("sessionStorage")) {
  throw new Error("Checkout must not use browser storage as persistence.");
}
if (!checkoutPageSource.includes("if (pending)") || !checkoutPageSource.includes("setPending(true)")) {
  throw new Error("Checkout mutations must hold while a request is pending.");
}
if (!checkoutPageSource.includes("CHECKOUT_PRICE_CHANGED") || !checkoutPageSource.includes("CHECKOUT_ITEM_UNAVAILABLE")) {
  throw new Error("Checkout must surface price-change and unavailable-item recovery.");
}
if (!checkoutPageSource.includes("setRequestError(true)")) {
  throw new Error("Checkout request failures must stay recoverable without wiping the form.");
}

const checkoutService = readFileSync(resolve("src/services/checkout.ts"), "utf8");
if (!checkoutService.includes("checkoutQuoteFromCart") || !checkoutService.includes("writeCheckoutDraft")) {
  throw new Error("Checkout must keep the signed draft store and derive the server quote.");
}
if (checkoutService.includes("localStorage")) {
  throw new Error("Checkout service must not add a second persistence system.");
}

const quoteSource = readFileSync(resolve("src/lib/checkout-quote.ts"), "utf8");
if (!quoteSource.includes("UK_STANDARD_DELIVERY_MINOR") || !quoteSource.includes("STORE_CURRENCY")) {
  throw new Error("Authoritative quote must lock GBP shipping to 465 minor units.");
}

const draftCodec = readFileSync(resolve("src/lib/checkout-draft.ts"), "utf8");
if (draftCodec.includes("subtotal") || draftCodec.includes("shippingMinor") || draftCodec.includes("totalMinor")) {
  throw new Error("Checkout draft persistence must not store payable totals.");
}

const focusTrap = readFileSync(resolve("src/hooks/useFocusTrap.ts"), "utf8");
if (!focusTrap.includes("onEscapeRef") || focusTrap.includes("[open, ref, onEscape]")) {
  throw new Error("Focus trap must keep onEscape in a ref so a new callback does not rebuild the trap.");
}
if (!focusTrap.includes("requestAnimationFrame")) {
  throw new Error("Focus must return after the overlay closes, not while the page is still inert.");
}
const countrySelector = readFileSync(resolve("src/components/market/CountrySelector.tsx"), "utf8");
if (!countrySelector.includes("useFocusTrap(open, panelRef")) {
  throw new Error("Country selector focus must start in the panel, not on the trigger.");
}
if (!countrySelector.includes("useFocusTrap(open, panelRef, () => setOpen(false), searchRef)")) {
  throw new Error("Country selector focus must start in the search box.");
}
const closeBeforeSearch =
  countrySelector.indexOf("sheetHeader") !== -1 &&
  countrySelector.indexOf("sheetHeader") < countrySelector.indexOf("<input");
if (!closeBeforeSearch) {
  throw new Error("Close must come before the search field in the country sheet.");
}
const countryCss = readFileSync(resolve("src/components/market/CountrySelector.module.css"), "utf8");
if (countryCss.includes("order: -1")) {
  throw new Error("The country sheet must not reorder Close with CSS.");
}
if (!countrySelector.includes('block: "center"') && !countrySelector.includes('block = openedRef.current ? "nearest" : "center"')) {
  throw new Error("Opening the country list must centre the selected country.");
}
if (!countrySelector.includes('scrollIntoView({ block') || !countrySelector.includes('"nearest"')) {
  throw new Error("Arrow keys must keep the active country in view.");
}
const cookieCss = readFileSync(resolve("src/components/consent/CookieConsent.module.css"), "utf8");
if (!cookieCss.includes('body[data-country-sheet="open"]')) {
  throw new Error("The cookie banner must stay behind an open country sheet.");
}
const chromeSource = readFileSync(resolve("src/components/navigation/SiteChrome.tsx"), "utf8");
const baseCss = readFileSync(resolve("src/styles/base.css"), "utf8");
const headerSource = readFileSync(resolve("src/components/navigation/SiteHeader.tsx"), "utf8");
const footerSource = readFileSync(resolve("src/components/navigation/SiteFooter.tsx"), "utf8");
if (
  !chromeSource.includes("window.location.pathname") ||
  !chromeSource.includes("data-checkout={checkout ?") ||
  chromeSource.includes("useLayoutEffect") ||
  !baseCss.includes("[data-checkout] [data-chrome-country]") ||
  !headerSource.includes("data-chrome-country") ||
  !footerSource.includes("data-chrome-country") ||
  !headerSource.includes("reduced ? null") ||
  !footerSource.includes("reduced ? null")
) {
  throw new Error("Checkout must hide header and footer country selectors from the first paint, even when the bag is empty.");
}

console.log(
  "Checkout OK: guest shell, signed draft cookie, Postcodes.io server lookup, manual address, £4.65 GBP shipping, server quote, payment stub, session id never public",
);
})().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
