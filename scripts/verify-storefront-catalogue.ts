import { resolveDemoCatalogueMode } from "../src/lib/demo-catalogue-mode";
import { getProductBrandName, getProductHref, getSaleCompareAtPrice } from "../src/lib/product-display";
import { getProducts } from "../src/services/catalogue";
import { searchProducts } from "../src/services/search";
import { applyFilters, emptyCollectionQuery, getCollectionById, getCollectionProducts } from "../src/services/collections";

const productionLocked = resolveDemoCatalogueMode({
  demoCatalogue: "true",
  nodeEnv: "production",
});
if (productionLocked.enabled || productionLocked.forced) {
  throw new Error("DEMO_CATALOGUE must be ignored in production");
}

const previewForced = resolveDemoCatalogueMode({
  demoCatalogue: "true",
  nodeEnv: "production",
  vercelEnv: "preview",
});
if (!previewForced.enabled || !previewForced.forced) {
  throw new Error("DEMO_CATALOGUE=true may still force demo on Vercel preview");
}

const offInDev = resolveDemoCatalogueMode({ demoCatalogue: "false", nodeEnv: "development" });
if (offInDev.enabled || offInDev.forced) {
  throw new Error("DEMO_CATALOGUE=false must keep demo off even in development");
}

const productionDefault = resolveDemoCatalogueMode({ nodeEnv: "production" });
if (productionDefault.enabled || productionDefault.forced) {
  throw new Error("Production without DEMO_CATALOGUE must not enable demo fixtures");
}

const developmentDefault = resolveDemoCatalogueMode({ nodeEnv: "development" });
if (!developmentDefault.enabled) {
  throw new Error("Development without a flag should allow demo fixtures");
}

const emptyHit = searchProducts("black", { products: [], brands: [] });
if (emptyHit.products.length !== 0 || emptyHit.correctedTo) {
  throw new Error("Empty live catalogue must not invent search hits or typo corrections");
}

const shop = getCollectionById("shop");
if (!shop) {
  throw new Error("Expected shop collection");
}
const emptyShop = getCollectionProducts(shop, [], []);
if (emptyShop.length !== 0) {
  throw new Error("Empty live catalogue must produce an empty shop membership");
}
const filteredEmpty = applyFilters([], emptyCollectionQuery(), []);
if (filteredEmpty.length !== 0) {
  throw new Error("Filters over an empty catalogue must stay empty");
}

const demo = getProducts()[0];
if (!demo) {
  throw new Error("Expected a demo fixture for display-helper checks");
}
if (!getProductHref(demo).startsWith("/product/")) {
  throw new Error("Product href helper must stay route-based");
}
if (getProductBrandName({ ...demo, brandName: "Demo Line A" }) !== "Demo Line A") {
  throw new Error("ProductCard brand name must come from the product prop, not a catalogue lookup");
}
if (getSaleCompareAtPrice({ price: 49, compareAtPrice: 59 }) !== 59) {
  throw new Error("A higher compare-at price must present as a sale");
}
if (
  getSaleCompareAtPrice({ price: 49, compareAtPrice: 49 }) !== undefined ||
  getSaleCompareAtPrice({ price: 49, compareAtPrice: 40 }) !== undefined ||
  getSaleCompareAtPrice({ price: 49 }) !== undefined
) {
  throw new Error("Compare-at must stay hidden unless it is above the selling price");
}

console.log("Storefront catalogue containment OK");
