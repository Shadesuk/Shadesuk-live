import { routes, shapeLinks } from "@/lib/navigation";
import { getProductBrandName } from "@/lib/product-display";
import {
  getSearchCollection,
  getStaticSearchDiscoveryLinks,
  normalizeSearchQuery,
  productSuggestionHref,
  searchPath,
  tokenizeSearchQuery,
  type SearchDiscoveryLink,
  type SearchHit,
  type SearchSuggestion,
} from "@/lib/search-query";
import { shapeLabel } from "@/lib/collection-query";
import type { Brand, Product } from "@/types/catalogue";

export {
  getSearchCollection,
  getStaticSearchDiscoveryLinks,
  normalizeSearchQuery,
  searchPath,
  tokenizeSearchQuery,
};
export type { SearchDiscoveryLink, SearchHit, SearchSuggestion };

export type SearchCatalogue = {
  products: Product[];
  brands: Brand[];
};

const MERCH_TERMS = ["new arrivals", "best sellers", "best seller"] as const;

function compact(value: string): string {
  return value.replace(/ /g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0),
  );
  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function uniqueTerms(values: string[]): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const value of values) {
    const normalized = normalizeSearchQuery(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    terms.push(normalized);
  }
  return terms;
}

function catalogueDictionary(catalogue: SearchCatalogue): string[] {
  const values: string[] = [];
  for (const product of catalogue.products) {
    values.push(product.name, product.slug.replace(/-/g, " "));
    values.push(getProductBrandName(product));
    for (const colour of product.colours) {
      values.push(colour.name, colour.slug.replace(/-/g, " "));
    }
    for (const shape of product.shape) {
      values.push(shape.replace(/-/g, " "), shapeLabel(shape));
    }
    for (const gender of product.gender) {
      values.push(gender);
    }
    if (product.isNewArrival) {
      values.push("new arrivals", "new arrival");
    }
    if (product.isBestSeller) {
      values.push("best sellers", "best seller");
    }
  }
  for (const brand of catalogue.brands) {
    values.push(brand.name, brand.slug.replace(/-/g, " "));
  }
  for (const shape of shapeLinks) {
    values.push(shape.label, shape.href.replace("/collections/", "").replace(/-/g, " "));
  }
  values.push(...MERCH_TERMS, "men", "women", "unisex");
  return uniqueTerms(values).filter((term) => term.length >= 4 || compact(term).length >= 4);
}

function productHaystack(product: Product): string {
  const parts = [
    product.name,
    product.slug.replace(/-/g, " "),
    getProductBrandName(product),
    product.brandId.replace(/-/g, " "),
    ...product.colours.flatMap((colour) => [
      colour.name,
      colour.slug.replace(/-/g, " "),
    ]),
    ...product.shape.flatMap((shape) => [shape.replace(/-/g, " "), shapeLabel(shape)]),
    ...product.gender,
    product.isNewArrival ? "new arrivals new arrival" : "",
    product.isBestSeller ? "best sellers best seller" : "",
  ];
  return normalizeSearchQuery(parts.join(" "));
}

function matchesTokens(haystack: string, tokens: string[]): boolean {
  return tokens.every((token) => haystack.includes(token));
}

function filterProducts(tokens: string[], products: Product[]): Product[] {
  if (tokens.length === 0) {
    return [];
  }
  return products.filter((product) =>
    matchesTokens(productHaystack(product), tokens),
  );
}

const FUZZY_CANDIDATE_CAP = 64;

function fuzzyCandidates(token: string, dictionary: string[]): string[] {
  const first = token[0];
  const minLen = Math.max(1, token.length - 1);
  const maxLen = token.length + 1;
  const nearby: string[] = [];
  for (const term of dictionary) {
    const compactTerm = compact(term);
    const firstOk = term[0] === first || compactTerm[0] === first;
    const lengthOk =
      (term.length >= minLen && term.length <= maxLen) ||
      (compactTerm.length >= minLen && compactTerm.length <= maxLen);
    if (!firstOk || !lengthOk) {
      continue;
    }
    nearby.push(term);
    if (nearby.length >= FUZZY_CANDIDATE_CAP) {
      break;
    }
  }
  return nearby;
}

export function suggestCatalogueTerm(
  query: string,
  catalogue: SearchCatalogue,
): string | undefined {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) {
    return undefined;
  }
  const dictionary = catalogueDictionary(catalogue);
  let changed = false;
  const corrected = tokens.map((token) => {
    const exact = dictionary.some(
      (term) => term === token || compact(term) === token,
    );
    if (exact || token.length < 5) {
      return token;
    }
    const ranked = fuzzyCandidates(token, dictionary)
      .map((term) => {
        const distance = Math.min(
          levenshtein(token, term),
          levenshtein(token, compact(term)),
        );
        return { term, distance };
      })
      .filter((item) => item.distance <= 1)
      .sort((a, b) => a.distance - b.distance || b.term.length - a.term.length);
    if (ranked.length === 0) {
      return token;
    }
    const best = ranked[0];
    const tied = ranked.filter((item) => item.distance === best.distance);
    const unique = new Set(tied.map((item) => item.term));
    if (unique.size !== 1) {
      return token;
    }
    if (best.term !== token) {
      changed = true;
    }
    return best.term;
  });
  if (!changed) {
    return undefined;
  }
  return corrected.join(" ");
}

export function searchProducts(
  raw: string,
  catalogue: SearchCatalogue,
): SearchHit<Product> {
  const query = raw.trim().replace(/\s+/g, " ");
  const tokens = tokenizeSearchQuery(raw);
  const products = filterProducts(tokens, catalogue.products);
  if (products.length > 0 || tokens.length === 0) {
    return { query, products };
  }
  const correctedTo = suggestCatalogueTerm(raw, catalogue);
  if (!correctedTo) {
    return { query, products: [] };
  }
  return {
    query,
    products: filterProducts(tokenizeSearchQuery(correctedTo), catalogue.products),
    correctedTo,
  };
}

function matchesLabel(label: string, tokens: string[]): boolean {
  return matchesTokens(normalizeSearchQuery(label), tokens);
}

export function getSearchSuggestions(
  raw: string,
  catalogue: SearchCatalogue,
  limit = 6,
): SearchSuggestion[] {
  const tokens = tokenizeSearchQuery(raw);
  if (tokens.length === 0) {
    return [];
  }
  const found = searchProducts(raw, catalogue);
  const suggestions: SearchSuggestion[] = [];

  for (const product of found.products.slice(0, limit)) {
    suggestions.push({
      id: `product:${product.id}`,
      kind: "product",
      label: product.name,
      meta: getProductBrandName(product),
      href: productSuggestionHref(product.slug),
    });
  }

  for (const brand of catalogue.brands) {
    if (!matchesLabel(`${brand.name} ${brand.slug.replace(/-/g, " ")}`, tokens)) {
      const corrected = found.correctedTo
        ? matchesLabel(
            `${brand.name} ${brand.slug.replace(/-/g, " ")}`,
            tokenizeSearchQuery(found.correctedTo),
          )
        : false;
      if (!corrected) {
        continue;
      }
    }
    suggestions.push({
      id: `brand:${brand.id}`,
      kind: "brand",
      label: brand.name,
      meta: "Brand",
      href: searchPath(brand.name),
    });
  }

  const collections: SearchSuggestion[] = [
    {
      id: "collection:new-arrivals",
      kind: "collection",
      label: "New arrivals",
      href: routes.newArrivals,
    },
    {
      id: "collection:best-sellers",
      kind: "collection",
      label: "Best sellers",
      href: routes.bestSellers,
    },
    ...shapeLinks.map((link) => ({
      id: `collection:${link.href}`,
      kind: "collection" as const,
      label: link.label,
      href: link.href,
    })),
  ];

  for (const collection of collections) {
    const hay = collection.label;
    const tokensToUse = found.correctedTo
      ? tokenizeSearchQuery(found.correctedTo)
      : tokens;
    if (matchesLabel(hay, tokens) || matchesLabel(hay, tokensToUse)) {
      suggestions.push(collection);
    }
  }

  const seen = new Set<string>();
  return suggestions.filter((item) => {
    if (seen.has(item.id) || seen.has(item.href)) {
      return false;
    }
    seen.add(item.id);
    seen.add(item.href);
    return true;
  }).slice(0, limit + 4);
}

export function getSearchDiscoveryLinks(
  brands: Brand[] = [],
): SearchDiscoveryLink[] {
  return [
    ...getStaticSearchDiscoveryLinks(),
    ...brands.map((brand) => ({
      id: brand.id,
      label: brand.name,
      href: searchPath(brand.name),
    })),
  ];
}
