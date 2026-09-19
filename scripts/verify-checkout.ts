import { readFileSync } from "node:fs";
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
  CHECKOUT_EXPIRED_BODY,
  CHECKOUT_EXPIRED_TITLE,
  CONTINUE_AS_GUEST,
  CONTINUE_TO_PAYMENT,
  ENTER_ADDRESS_MANUALLY,
  PAYMENT_NEXT_BODY,
  POSTCODE_INVALID,
  SECURE_CARD_PAYMENT,
  SHIPPING_CALCULATED_LATER,
  SHIPPING_MINIMUM,
} from "../src/lib/checkout-copy";
import { guestCartCookieSecure } from "../src/lib/guest-cart-cookie-secure";
import { isAllowedCartActionOrigin } from "../src/lib/cart-origin";
import {
  formatUkPostcode,
  hasCheckoutFieldErrors,
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
}
import {
  CHECKOUT_COUNTRY_GB,
  emptyCheckoutDraft,
  type PublicCheckoutDraft,
} from "../src/types/checkout";
import type { AddressLookupProvider } from "../src/types/integrations";

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
  throw new Error("Checkout shipping must not invent a cost.");
}
if (!SHIPPING_MINIMUM.toLowerCase().includes("2-week")) {
  throw new Error("Checkout must show the minimum 2-week delivery expectation.");
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
if (
  validateCheckoutAddress({ ...validAddressInput(), country: "US" }).country !==
  "Delivery is currently available in the United Kingdom."
) {
  throw new Error("Unsupported country must be rejected.");
}
if (formatUkPostcode("sw1a1aa") !== "SW1A 1AA") {
  throw new Error("UK postcodes must format with an inward-code space.");
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
if (!reviewSource.includes("disabled") || !reviewSource.includes("CONTINUE_TO_PAYMENT")) {
  throw new Error("Continue to payment must stay disabled.");
}

const checkoutFiles = [
  "src/app/(storefront)/checkout/page.tsx",
  "src/app/(storefront)/checkout/actions.ts",
  "src/components/checkout/CheckoutPage.tsx",
  "src/components/checkout/CheckoutReview.tsx",
  "src/lib/address-lookup.ts",
];
for (const file of checkoutFiles) {
  const source = readFileSync(resolve(file), "utf8").toLowerCase();
  if (source.includes("stripe") || source.includes("razorpay")) {
    throw new Error(`${file} must not invent a payment vendor.`);
  }
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

console.log(
  "Checkout OK: guest shell, signed draft cookie, Postcodes.io server lookup, manual address, payment stub, session id never public",
);
})().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
