import { PRODUCT_DISCLOSURE_COPY } from "../src/components/pdp/ProductDisclosure";
import { FACE_GUIDE } from "../src/components/pdp/face-guide";
import { evaluateAddToBag } from "../src/lib/add-to-bag";
import { productPath } from "../src/lib/navigation";
import {
  getBrandName,
  getProductBySlug,
  getProducts,
} from "../src/services/catalogue";

const frame01 = getProductBySlug("frame-01");
const frame04 = getProductBySlug("frame-04");
const frame05 = getProductBySlug("frame-05");
const frame06 = getProductBySlug("frame-06");

if (!frame01 || !frame04 || !frame05 || !frame06) {
  throw new Error("Demo PDP fixtures are missing.");
}

if (productPath(frame01.slug) !== "/product/frame-01") {
  throw new Error("Product route must stay /product/[slug].");
}

if (getBrandName(frame01) !== "Demo Line A") {
  throw new Error("Demo PDP must resolve the catalogue brand name.");
}

const related = getProducts().filter(
  (product) => product.id !== frame01.id && product.shape.includes(frame01.shape[0]),
);
if (!related.some((product) => product.slug === "frame-06")) {
  throw new Error("Aviator PDP should recommend the other aviator fixture.");
}
if (related.some((product) => product.slug === "frame-01")) {
  throw new Error("Related products must not include the current product.");
}

if (PRODUCT_DISCLOSURE_COPY !== "High-quality 1:1 Superclone") {
  throw new Error("PDP disclosure copy must stay locked.");
}

const round = FACE_GUIDE.find((face) => face.id === "round");
if (!round || round.usually.join(",") !== "Rectangle,Square,Angular") {
  throw new Error("Round face guidance must match the locked PDP example.");
}

const added = evaluateAddToBag(frame01, {
  slug: frame01.slug,
  colourId: "colour-black",
  quantity: 1,
});
if (added.status !== "deferred") {
  throw new Error("In-stock demo add-to-bag must be deferred until cart exists.");
}

const soldOut = evaluateAddToBag(frame05, {
  slug: frame05.slug,
  colourId: "colour-black",
  quantity: 1,
});
if (soldOut.status !== "unavailable" || soldOut.availability !== "sold_out") {
  throw new Error("Sold-out demo products must not pretend to add.");
}

const out = evaluateAddToBag(frame04, {
  slug: frame04.slug,
  colourId: "colour-brown",
  quantity: 1,
});
if (out.status !== "unavailable") {
  throw new Error("Out-of-stock demo products must not pretend to add.");
}

const missing = evaluateAddToBag(undefined, {
  slug: "not-a-product",
  colourId: "colour-black",
  quantity: 1,
});
if (missing.status !== "unavailable") {
  throw new Error("Unknown slugs must not evaluate as added.");
}

const badQty = evaluateAddToBag(frame01, {
  slug: frame01.slug,
  colourId: "colour-black",
  quantity: 0,
});
if (badQty.status !== "error") {
  throw new Error("Invalid quantity must error, not succeed.");
}

console.log("PDP OK: demo slugs resolve, disclosure locked, add-to-bag deferred");
