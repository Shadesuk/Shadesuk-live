import {
  getBrandBySlug,
  getBrandHref,
  getBrandIndex,
  getBrandProducts,
  getBrands,
  getMenuBrandLinks,
  getPopulatedShapes,
} from "../src/services/catalogue";
import {
  emptyCollectionQuery,
  getBrandCollectionBySlug,
  getCollectionBySlug,
  hiddenFilterKeys,
  parseCollectionQuery,
  queryCollection,
  getPopulatedCollections,
} from "../src/services/collections";

const brands = getBrandIndex();
if (brands.length !== getBrands().filter((brand) => brand.status === "active").length) {
  throw new Error("Brand index should list published catalogue brands");
}

const lineA = getBrandBySlug("demo-line-a");
if (!lineA || lineA.name !== "Demo Line A") {
  throw new Error("Expected Demo Line A by slug");
}
if (getBrandHref(lineA) !== "/brands/demo-line-a") {
  throw new Error("Brand href should use /brands/[slug]");
}
if (lineA.productCount !== getBrandProducts("demo-line-a").length) {
  throw new Error("Brand productCount must be derived from catalogue products");
}
if (lineA.productCount < 1) {
  throw new Error("Demo Line A should have products");
}
if (lineA.description || lineA.logo) {
  throw new Error("Demo brands must not invent descriptions or logos");
}

if (getBrandBySlug("not-a-brand") || getBrandCollectionBySlug("not-a-brand")) {
  throw new Error("Unknown brands must not resolve");
}

if (getBrandCollectionBySlug("everyday") || getCollectionBySlug("everyday")) {
  throw new Error("Style collections must remain unpublished");
}

const brandCollection = getBrandCollectionBySlug("demo-line-a");
if (!brandCollection || brandCollection.kind !== "brand") {
  throw new Error("Brand pages should reuse a brand collection definition");
}
if (!hiddenFilterKeys(brandCollection).includes("brand")) {
  throw new Error("Brand pages should hide the brand filter");
}

const filtered = queryCollection(
  brandCollection,
  parseCollectionQuery({
    shape: "aviator",
    colour: "black",
    sort: "price-asc",
  }),
);
if (filtered.total !== 1 || filtered.products[0]?.slug !== "frame-01") {
  throw new Error("Brand page filters/sort should compose the shared collection query");
}

const foreignBrand = queryCollection(
  brandCollection,
  parseCollectionQuery({ brand: "demo-line-b" }),
);
if (foreignBrand.total !== lineA.productCount) {
  throw new Error("Brand identity stays in the path; brand query filters must not escape the page");
}

const page = queryCollection(brandCollection, {
  ...emptyCollectionQuery(),
  limit: 4,
});
if (page.total !== lineA.productCount) {
  throw new Error("Brand page counts must come from catalogue data");
}

const hub = getPopulatedCollections();
const populatedShapes = getPopulatedShapes();
if (hub.length !== populatedShapes.length) {
  throw new Error("Collections hub should only publish populated shape collections");
}
if (hub.some((collection) => collection.kind !== "shape")) {
  throw new Error("Collections hub must not publish style collections");
}
if (!hub.some((collection) => collection.slug === "aviator")) {
  throw new Error("Populated aviator collection should appear on the hub");
}

const menuBrands = getMenuBrandLinks();
if (menuBrands.length !== brands.filter((brand) => brand.productCount > 0).length) {
  throw new Error("Compact shop menu should list current catalogue brands");
}

console.log(
  `Discovery OK: ${brands.length} brands, ${hub.length} populated shapes, ${filtered.total} filtered Demo Line A`,
);
