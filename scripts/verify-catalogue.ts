import {
  assertDemoCatalogueIntegrity,
  getBestSellers,
  getColourCount,
  getNewArrivals,
  getProductBySlug,
  getProductHref,
  getProducts,
  getProductsByGender,
  getProductsByShape,
  getSecondaryImage,
  isProductAvailable,
} from "../src/services/catalogue";

assertDemoCatalogueIntegrity();

const products = getProducts();
const frame01 = getProductBySlug("frame-01");
const frame04 = getProductBySlug("frame-04");
const frame05 = getProductBySlug("frame-05");

if (!frame01 || getColourCount(frame01) !== 4) {
  throw new Error("Frame 01 should have 4 colours");
}
if (!frame04 || isProductAvailable(frame04)) {
  throw new Error("Frame 04 should be unavailable");
}
if (!frame05 || frame05.availability !== "sold_out") {
  throw new Error("Frame 05 should be sold out");
}
if (getProductHref(frame01) !== "/product/frame-01") {
  throw new Error("Product href should use the locked product route");
}
if (products.some((product) => getSecondaryImage(product))) {
  throw new Error("Demo catalogue must not invent secondary product images");
}
if (getNewArrivals().length === 0 || getBestSellers().length === 0) {
  throw new Error("Expected merchandising subsets");
}
if (getProductsByGender("women").length === 0) {
  throw new Error("Expected women products");
}
if (getProductsByShape("aviator").length === 0) {
  throw new Error("Expected aviator products");
}
if (products.some((product) => product.style.length > 0)) {
  throw new Error("No invented style values");
}

console.log(`Catalogue OK: ${products.length} demo products`);
