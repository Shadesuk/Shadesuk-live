import { serializeCollectionQuery } from "../src/services/collections";
import { emptyCollectionQuery } from "../src/services/collections";
import {
  getBrands,
  getProducts,
  hydrateDemoProduct,
} from "../src/services/catalogue";
import {
  resetSearchSuggestRateLimitForTests,
  searchSuggestAttemptAllowed,
} from "../src/lib/search-suggest-limit";
import {
  getSearchCollection,
  getSearchDiscoveryLinks,
  getSearchSuggestions,
  normalizeSearchQuery,
  searchPath,
  searchProducts,
  suggestCatalogueTerm,
  tokenizeSearchQuery,
} from "../src/services/search";

const catalogue = {
  products: getProducts().map(hydrateDemoProduct),
  brands: getBrands(),
};

if (normalizeSearchQuery("  Aviator—BLACK ") !== "aviator black") {
  throw new Error("normalizeSearchQuery should fold punctuation and case");
}

const tokens = tokenizeSearchQuery("Aviator  black");
if (tokens.join(",") !== "aviator,black") {
  throw new Error("tokenizeSearchQuery should split on whitespace");
}

const black = searchProducts("black", catalogue);
if (black.products.length !== 5 || black.correctedTo) {
  throw new Error(`Expected 5 exact black matches, got ${black.products.length}`);
}

const typo = searchProducts("aviater", catalogue);
if (typo.correctedTo !== "aviator" || typo.products.length !== 2) {
  throw new Error(
    `Expected aviater → aviator with 2 products, got ${typo.correctedTo} / ${typo.products.length}`,
  );
}

if (suggestCatalogueTerm("zzzzz", catalogue)) {
  throw new Error("Unknown tokens must not invent a catalogue term");
}

const nonsense = searchProducts("zzzzz", catalogue);
if (nonsense.products.length !== 0 || nonsense.correctedTo) {
  throw new Error("Unknown queries must not fake fuzzy results");
}

const path = searchPath("aviator", { ...emptyCollectionQuery(), genders: ["men"] });
if (path !== "/search?q=aviator&gender=men") {
  throw new Error(`searchPath should keep q first, got ${path}`);
}

const queryString = serializeCollectionQuery({
  ...emptyCollectionQuery(),
  q: "aviator",
  colours: ["black"],
  sort: "best-selling",
});
if (queryString !== "q=aviator&colour=black&sort=best-selling") {
  throw new Error(`serializeCollectionQuery should keep q first, got ${queryString}`);
}

const collection = getSearchCollection("aviater", "aviator");
if (!collection.description?.includes("No exact match")) {
  throw new Error("Corrected searches should explain the substitution");
}

const suggestions = getSearchSuggestions("aviator", catalogue);
if (!suggestions.some((item) => item.href === "/collections/aviator")) {
  throw new Error("Shape suggestions must use locked collection routes");
}
if (suggestions.some((item) => /oval|rimless|everyday/i.test(item.label))) {
  throw new Error("Suggestions must not invent unapproved collections");
}

const discovery = getSearchDiscoveryLinks();
if (!discovery.some((item) => item.href === "/shop")) {
  throw new Error("Empty search should offer browse-all discovery");
}

if (searchPath("   ") !== "/search") {
  throw new Error("Blank queries must not submit a q param");
}

resetSearchSuggestRateLimitForTests();
for (let i = 0; i < 20; i += 1) {
  if (!searchSuggestAttemptAllowed("203.0.113.10")) {
    throw new Error("Suggest burst budget should allow 20 requests");
  }
}
if (searchSuggestAttemptAllowed("203.0.113.10")) {
  throw new Error("The 21st suggest request in 10s must be rate-limited");
}
if (!searchSuggestAttemptAllowed("203.0.113.11")) {
  throw new Error("Suggest limits must be per IP, not global");
}
resetSearchSuggestRateLimitForTests();

console.log(
  `Search OK: black=${black.products.length}, aviater→${typo.correctedTo} (${typo.products.length})`,
);
