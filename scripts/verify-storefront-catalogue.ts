import { resolveDemoCatalogueMode } from "../src/lib/demo-catalogue-mode";
import { getProductBrandName, getProductHref } from "../src/lib/product-display";
import { getProducts } from "../src/services/catalogue";
import { searchProducts } from "../src/services/search";
import { applyFilters, emptyCollectionQuery, getCollectionById, getCollectionProducts } from "../src/services/collections";

const forced = resolveDemoCatalogueMode({ demoCatalogue: "true", nodeEnv: "production" });
if (!forced.enabled || !forced.forced) {
  throw new Error("DEMO_CATALOGUE=true must force the demo catalogue on");
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

console.log("Storefront catalogue containment OK");
