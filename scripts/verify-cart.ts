import {
  CART_MEDIATION_RULES,
  createGuestCartSessionId,
  guestCartCookieSetOptions,
} from "../src/contracts";
import {
  evaluateAddToBag,
  parseAddToBagInput,
  resolveCartVariantId,
  toPublicAddToBagResult,
} from "../src/lib/add-to-bag";
import { isAllowedCartActionOrigin } from "../src/lib/cart-origin";
import { cartIssueMessage, EMPTY_BAG_CTA, EMPTY_BAG_TITLE } from "../src/lib/cart-copy";
import { decodeDemoCartCookie, encodeDemoCartCookie } from "../src/lib/demo-cart-cookie";
import { guestCartCookieSecure } from "../src/lib/guest-cart-cookie-secure";
import { demoVariantId, isDemoVariantId, isUuid } from "../src/lib/ids";
import { routes } from "../src/lib/navigation";
import {
  containsForbiddenCartOwnership,
  hasForbiddenOwnershipKey,
} from "../src/lib/ownership-keys";
import { getCartSuggestions } from "../src/lib/cart-suggestions";
import { getProductBySlug, getProducts, isProductAvailable } from "../src/services/catalogue";

const frame01 = getProductBySlug("frame-01");
if (!frame01) {
  throw new Error("Demo Frame 01 is required for cart verification.");
}

if (routes.cart !== "/cart" || routes.checkout !== "/checkout") {
  throw new Error("Cart and checkout routes must stay /cart and /checkout.");
}

if (!CART_MEDIATION_RULES.clientMustNotSendSessionId || CART_MEDIATION_RULES.anonRlsWrites) {
  throw new Error("Guest cart mediation rules must keep anon writes closed.");
}

if (
  parseAddToBagInput({
    slug: "frame-01",
    colourId: "colour-black",
    quantity: 1,
    sessionId: "should-not-be-accepted",
  }) ||
  parseAddToBagInput({
    slug: "frame-01",
    colourId: "colour-black",
    quantity: 1,
    cartId: "also-rejected",
  }) ||
  !hasForbiddenOwnershipKey({ itemId: "x", quantity: 1, userId: "nope" })
) {
  throw new Error("Cart actions must reject client-supplied ownership ids.");
}

const ready = evaluateAddToBag(frame01, {
  slug: frame01.slug,
  colourId: "colour-black",
  quantity: 2,
});
if (ready.status !== "ready") {
  throw new Error("In-stock demo products must evaluate as ready to persist.");
}

const publicReady = toPublicAddToBagResult(ready);
if (publicReady.status === "added") {
  throw new Error("Validation must not serialize an added cart.");
}

const variantId = resolveCartVariantId(frame01, { colourId: "colour-black" });
if (!variantId || !isDemoVariantId(variantId) || isUuid(variantId)) {
  throw new Error("Demo variant ids must not be written as catalogue UUIDs.");
}
if (variantId !== demoVariantId(frame01.id, "colour-black")) {
  throw new Error("Demo variant ids must stay stable per product and colour.");
}

const smallId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const largeId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const foreignId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const sizedProduct = {
  ...frame01,
  id: "prod-sized-live",
  slug: "sized-live-frame",
  colours: [{ id: "black", slug: "black", name: "Black", available: true }],
  sizes: ["Small", "Large"],
  variants: [
    { id: smallId, colourId: "black", availability: "in_stock" as const, size: "Small" },
    { id: largeId, colourId: "black", availability: "in_stock" as const, size: "Large" },
  ],
};

if (
  evaluateAddToBag(sizedProduct, {
    slug: sizedProduct.slug,
    colourId: "black",
    quantity: 1,
  }).status !== "error"
) {
  throw new Error("Colour-only add-to-bag must fail when a colour has multiple sizes.");
}

const sizedByPair = evaluateAddToBag(sizedProduct, {
  slug: sizedProduct.slug,
  colourId: "black",
  size: "Large",
  quantity: 1,
});
if (sizedByPair.status !== "ready") {
  throw new Error("Colour + size must uniquely identify a live cart line.");
}
if (resolveCartVariantId(sizedProduct, { colourId: "black", size: "Large" }) !== largeId) {
  throw new Error("Cart writes must use the sized variant id, not the first colour match.");
}

const sizedById = evaluateAddToBag(sizedProduct, {
  slug: sizedProduct.slug,
  variantId: smallId,
  quantity: 1,
});
if (sizedById.status !== "ready") {
  throw new Error("variantId must be the preferred cart line identity.");
}
if (resolveCartVariantId(sizedProduct, { variantId: smallId }) !== smallId) {
  throw new Error("Preferred variantId must be written to cart_items.");
}

if (
  evaluateAddToBag(sizedProduct, {
    slug: sizedProduct.slug,
    variantId: foreignId,
    colourId: "black",
    quantity: 1,
  }).status !== "error" ||
  resolveCartVariantId(sizedProduct, { variantId: foreignId, colourId: "black" }) !== null
) {
  throw new Error("Client-supplied variantId must belong to the product on the slug.");
}

if (
  parseAddToBagInput({
    slug: "sized-live-frame",
    variantId: largeId,
    quantity: 1,
  })?.variantId !== largeId
) {
  throw new Error("Add-to-bag must accept variantId without colourId.");
}

const sessionId = createGuestCartSessionId();
const encoded = encodeDemoCartCookie(sessionId, [
  {
    id: "11111111-1111-1111-1111-111111111111",
    variantId,
    productId: frame01.id,
    slug: frame01.slug,
    colourId: "colour-black",
    quantity: 2,
    unitPriceMinor: 4900,
  },
]);
if (encoded.includes(sessionId) || encoded.includes("sessionId")) {
  throw new Error("Demo cart cookie must not embed the session id.");
}
const decoded = decodeDemoCartCookie(sessionId, encoded);
if (decoded.length !== 1 || decoded[0]?.quantity !== 2) {
  throw new Error("Demo cart cookie must round-trip lines.");
}
if (decodeDemoCartCookie("ff".repeat(32), encoded).length !== 0) {
  throw new Error("Demo cart cookie must reject a mismatched session signature.");
}

const publicCart = {
  items: [
    {
      id: decoded[0]!.id,
      productId: frame01.id,
      slug: frame01.slug,
      name: frame01.name,
      href: "/product/frame-01",
      colourName: "Black",
      quantity: 2,
      unitPrice: 49,
      lineTotal: 98,
      currency: "GBP" as const,
    },
  ],
  itemCount: 2,
  subtotal: 98,
  currency: "GBP" as const,
  issues: [],
};
if (containsForbiddenCartOwnership(publicCart)) {
  throw new Error("Public cart fixtures must not include ownership keys.");
}
if (containsForbiddenCartOwnership({ ...publicCart, owner: { kind: "guest", sessionId } })) {
  // detected — required
} else {
  throw new Error("Ownership walker must detect CartOwner.sessionId.");
}

const addedPublic = toPublicAddToBagResult({
  status: "added",
  cart: {
    ...publicCart,
    owner: { kind: "guest", sessionId },
  } as never,
});
if (addedPublic.status !== "error") {
  throw new Error("Public add-to-bag must refuse a cart that contains a session id.");
}

if (
  !isAllowedCartActionOrigin({
    origin: "http://localhost:3000",
    referer: null,
    host: "localhost:3000",
    siteUrl: "http://localhost:3000",
  })
) {
  throw new Error("Same-origin cart actions must be allowed.");
}
if (
  isAllowedCartActionOrigin({
    origin: "https://evil.example",
    referer: null,
    host: "localhost:3000",
    siteUrl: "http://localhost:3000",
  })
) {
  throw new Error("Cross-origin cart actions must be rejected.");
}
if (
  isAllowedCartActionOrigin({
    origin: null,
    referer: null,
    host: "localhost:3000",
    siteUrl: "http://localhost:3000",
  })
) {
  throw new Error("Cart actions without Origin/Referer must be rejected.");
}

const cookie = guestCartCookieSetOptions(sessionId, { secure: true });
if (!cookie.httpOnly || cookie.name !== "shadesuk_guest_cart") {
  throw new Error("Guest cart cookie must stay httpOnly shadesuk_guest_cart.");
}
if (
  !guestCartCookieSecure({
    nodeEnv: "production",
    siteUrl: "https://shadesuk.example",
  })
) {
  throw new Error("Production cookies must be Secure.");
}

if (EMPTY_BAG_TITLE !== "Your bag is empty" || EMPTY_BAG_CTA !== "Explore shades") {
  throw new Error("Empty bag copy must stay locked.");
}
if (cartIssueMessage("price_changed") === cartIssueMessage("product_removed")) {
  throw new Error("Revalidation issues must have distinct customer copy.");
}

const suggestions = getCartSuggestions(
  {
    items: [
      {
        id: "line-1",
        productId: frame01.id,
        slug: frame01.slug,
        name: frame01.name,
        href: "/product/frame-01",
        colourName: "Black",
        quantity: 1,
        unitPrice: 49,
        lineTotal: 49,
        currency: "GBP",
      },
    ],
    itemCount: 1,
    subtotal: 49,
    currency: "GBP",
    issues: [],
  },
  getProducts(),
);
if (suggestions.some((product) => product.id === frame01.id)) {
  throw new Error("Cart suggestions must not repeat items already in the bag.");
}
if (suggestions.length > 4) {
  throw new Error("Cart recommendations must stay at most 4 products.");
}
if (suggestions.some((product) => !isProductAvailable(product))) {
  throw new Error("Cart suggestions must be in stock.");
}
if (getProducts().length !== 6) {
  throw new Error("Cart slice must not change the demo catalogue size.");
}

console.log("Cart OK: bag persistence contracts, origin checks, session id never public");
