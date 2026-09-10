import {
  assertDemoCatalogueIntegrity,
  getBestSellers,
  getBrandBySlug,
  getColourCount,
  getEditorialProduct,
  getHomepageFeatured,
  getNewArrivals,
  getPopulatedShapes,
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
if (getHomepageFeatured(4).length !== 4) {
  throw new Error("Homepage featured should use four catalogue products");
}
if (!getEditorialProduct() || !isProductAvailable(getEditorialProduct()!)) {
  throw new Error("Editorial product should be an in-stock catalogue item");
}
if (!getPopulatedShapes().includes("aviator")) {
  throw new Error("Populated shapes should include catalogue-backed aviator");
}
if (getPopulatedShapes().length === 0) {
  throw new Error("Expected populated shapes");
}

const demoLineA = getBrandBySlug("demo-line-a");
if (!demoLineA || demoLineA.productCount < 1) {
  throw new Error("Expected catalogue-backed Demo Line A with a derived product count");
}
if (getBrandBySlug("not-a-brand")) {
  throw new Error("Unknown brand slugs must not resolve");
}

console.log(`Catalogue OK: ${products.length} demo products`);
