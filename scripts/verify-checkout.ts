import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHECKOUT_DRAFT_COOKIE,
  CHECKOUT_DRAFT_TTL_MS,
  decodeCheckoutDraftCookie,
  encodeCheckoutDraftCookie,
} from "../src/lib/checkout-draft";
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

if (isAddressLookupConfigured()) {
  throw new Error("No address vendor is locked; lookup must stay unconfigured.");
}
if (getAddressLookupProvider() !== null) {
  throw new Error("Address lookup factory must not invent a provider.");
}

void (async () => {
  const unavailable = await lookupAddresses("221B Baker Street");
  if (unavailable.status !== "unavailable") {
    throw new Error("Unset address lookup must report unavailable, not fake suggestions.");
  }
  const unsetSearch = await unsetAddressLookupProvider.search("anything");
  if (unsetSearch.length !== 0) {
    throw new Error("Unset provider search must not return suggestions.");
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
const encoded = encodeCheckoutDraftCookie(sessionId, draft);
if (
  encoded.includes(sessionId) ||
  encoded.toLowerCase().includes("sessionid") ||
  encoded.includes("session_id")
) {
  throw new Error("Checkout draft cookie must not embed the session id.");
}
if (containsForbiddenCartOwnership(draft)) {
  throw new Error("Public checkout draft must not include ownership keys.");
}
if (!hasForbiddenOwnershipKey({ email: "a@b.c", sessionId })) {
  throw new Error("Checkout actions must reject client-supplied session ids.");
}

const decoded = decodeCheckoutDraftCookie(sessionId, encoded);
if (decoded.email !== "guest@example.com" || decoded.step !== "review" || decoded.expired) {
  throw new Error("Checkout draft cookie must round-trip fields.");
}
if (decodeCheckoutDraftCookie("ff".repeat(32), encoded).email !== "") {
  throw new Error("Checkout draft cookie must reject a mismatched session signature.");
}

const expired = decodeCheckoutDraftCookie(
  sessionId,
  encoded,
  Date.now() + CHECKOUT_DRAFT_TTL_MS + 1000,
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

const pageSource = readFileSync(resolve("src/app/checkout/page.tsx"), "utf8");
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
  "src/app/checkout/page.tsx",
  "src/app/checkout/actions.ts",
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

console.log(
  "Checkout OK: guest shell, signed draft cookie, manual address, payment stub, session id never public",
);
})().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
