import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyFilters,
  applySort,
  getBrandCollectionBySlug,
  getCollectionBySlug,
  getCollectionProducts,
  getFilteredProductCount,
  getPopulatedCollections,
  parseCollectionQuery,
  queryCollection,
} from "../src/services/collections";
import { getCollectionById } from "../src/services/collections";
import { emptyCollectionQuery } from "../src/services/collections";
import { getBrands, getProducts } from "../src/services/catalogue";

const snapshot = { products: getProducts(), brands: getBrands() };

const shop = getCollectionById("shop");
const aviator = getCollectionBySlug("aviator");
const men = getCollectionById("men");
const unknown = getCollectionBySlug("oval");
const style = getCollectionBySlug("everyday");

if (!shop || !aviator || !men) {
  throw new Error("Expected core collections");
}
if (unknown || style) {
  throw new Error("Unapproved collections must not be published");
}

const shopProducts = getCollectionProducts(shop, snapshot.products, snapshot.brands);
const aviatorProducts = getCollectionProducts(aviator, snapshot.products, snapshot.brands);
if (shopProducts.length === 0 || aviatorProducts.length === 0) {
  throw new Error("Expected collection products");
}

const query = parseCollectionQuery({
  colour: "black",
  price: "under-100",
  sort: "price-asc",
});
if (query.colours[0] !== "black" || query.price !== "under-100") {
  throw new Error("Query parsing failed");
}

const filtered = applyFilters(aviatorProducts, query, snapshot.brands);
const count = getFilteredProductCount(aviator, query, snapshot);
if (filtered.length !== count) {
  throw new Error("Filtered count should match applyFilters");
}

const sorted = applySort(shopProducts, "price-asc");
if (sorted[0].price > sorted[sorted.length - 1].price) {
  throw new Error("Price ascending sort failed");
}

const page = queryCollection(
  shop,
  {
    ...emptyCollectionQuery(),
    limit: 4,
  },
  shopProducts,
  snapshot.brands,
);
if (page.products.length !== 4 || !page.hasMore) {
  throw new Error("Load more paging should expose remaining products");
}

const empty = queryCollection(
  shop,
  parseCollectionQuery({ colour: "green", availability: "in_stock" }),
  shopProducts,
  snapshot.brands,
);
if (empty.total !== 0) {
  throw new Error("Expected empty in-stock green filter combination");
}

const brand = getBrandCollectionBySlug("demo-line-a", snapshot.brands);
if (!brand) {
  throw new Error("Expected brand collection for Demo Line A");
}
const brandMembers = getCollectionProducts(brand, snapshot.products, snapshot.brands);
const brandPage = queryCollection(brand, emptyCollectionQuery(), brandMembers, snapshot.brands);
if (brandPage.total !== brandMembers.length) {
  throw new Error("Brand collection products should match query totals");
}

const hub = getPopulatedCollections(snapshot.products);
if (hub.length === 0 || hub.some((item) => item.kind !== "shape")) {
  throw new Error("Populated collections should be catalogue-backed shapes only");
}

const hubSource = readFileSync(resolve("src/components/discovery/CollectionsHub.tsx"), "utf8");
if (!hubSource.includes('variant="cards"') || !hubSource.includes("getCoverImage")) {
  throw new Error("Collections hub must use image-slot cards ready for catalogue photography.");
}
const listSource = readFileSync(resolve("src/components/discovery/DiscoveryList.tsx"), "utf8");
if (!listSource.includes("MediaSlot")) {
  throw new Error("Collection cards must keep an image slot with a graceful empty fallback.");
}
const heroSource = readFileSync(resolve("src/components/home/HeroCampaign.tsx"), "utf8");
if (heroSource.includes("Campaign image") || !heroSource.includes("compactEmpty")) {
  throw new Error("Hero must work without campaign photography and must not use wireframe labels.");
}

console.log(
  `Collections OK: ${shopProducts.length} shop, ${aviatorProducts.length} aviator, ${count} filtered aviator`,
);
