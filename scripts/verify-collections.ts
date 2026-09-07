import {
  applyFilters,
  applySort,
  getCollectionBySlug,
  getCollectionProducts,
  getFilteredProductCount,
  parseCollectionQuery,
  queryCollection,
} from "../src/services/collections";
import { getCollectionById } from "../src/services/collections";
import { emptyCollectionQuery } from "../src/services/collections";

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

const shopProducts = getCollectionProducts(shop);
const aviatorProducts = getCollectionProducts(aviator);
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

const filtered = applyFilters(aviatorProducts, query);
const count = getFilteredProductCount(aviator, query);
if (filtered.length !== count) {
  throw new Error("Filtered count should match applyFilters");
}

const sorted = applySort(shopProducts, "price-asc");
if (sorted[0].price > sorted[sorted.length - 1].price) {
  throw new Error("Price ascending sort failed");
}

const page = queryCollection(shop, {
  ...emptyCollectionQuery(),
  limit: 4,
});
if (page.products.length !== 4 || !page.hasMore) {
  throw new Error("Load more paging should expose remaining products");
}

const empty = queryCollection(shop, parseCollectionQuery({ colour: "green", availability: "in_stock" }));
if (empty.total !== 0) {
  throw new Error("Expected empty in-stock green filter combination");
}

console.log(
  `Collections OK: ${shopProducts.length} shop, ${aviatorProducts.length} aviator, ${count} filtered aviator`,
);
