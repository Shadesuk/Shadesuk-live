import { productPath, routes, shapeLinks } from "@/lib/navigation";
import {
  emptyCollectionQuery,
  collectionQueryPath,
  shapeLabel,
} from "@/services/collections";
import {
  getBrandById,
  getBrandName,
  getBrands,
  getProducts,
} from "@/services/catalogue";
import type { CollectionDefinition } from "@/types/collection";
import type { Product } from "@/types/catalogue";

export type SearchHit = {
  query: string;
  products: Product[];
  correctedTo?: string;
};

export type SearchSuggestion = {
  id: string;
  kind: "product" | "brand" | "collection";
  label: string;
  href: string;
  meta?: string;
};

export type SearchDiscoveryLink = {
  id: string;
  label: string;
  href: string;
};

const MERCH_TERMS = ["new arrivals", "best sellers", "best seller"] as const;

function compact(value: string): string {
  return value.replace(/ /g, "");
}

export function normalizeSearchQuery(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenizeSearchQuery(value: string): string[] {
  return normalizeSearchQuery(value).split(" ").filter(Boolean);
}

export function searchPath(
  q: string,
  extra?: Partial<ReturnType<typeof emptyCollectionQuery>> & { q?: string },
): string {
  const trimmed = q.trim();
  if (!trimmed) {
    return routes.search;
  }
  return collectionQueryPath(routes.search, {
    ...emptyCollectionQuery(),
    ...extra,
    q: trimmed,
  });
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

function catalogueDictionary(): string[] {
  const values: string[] = [];
  for (const product of getProducts()) {
    values.push(product.name, product.slug.replace(/-/g, " "));
    values.push(getBrandName(product));
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
  for (const brand of getBrands()) {
    values.push(brand.name, brand.slug.replace(/-/g, " "));
  }
  for (const shape of shapeLinks) {
    values.push(shape.label, shape.href.replace("/collections/", "").replace(/-/g, " "));
  }
  values.push(...MERCH_TERMS, "men", "women", "unisex");
  return uniqueTerms(values).filter((term) => term.length >= 4 || compact(term).length >= 4);
}

function productHaystack(product: Product): string {
  const brand = getBrandById(product.brandId);
  const parts = [
    product.name,
    product.slug.replace(/-/g, " "),
    getBrandName(product),
    brand?.slug.replace(/-/g, " ") ?? "",
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

function filterProducts(tokens: string[]): Product[] {
  if (tokens.length === 0) {
    return [];
  }
  return getProducts().filter((product) =>
    matchesTokens(productHaystack(product), tokens),
  );
}

export function suggestCatalogueTerm(query: string): string | undefined {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) {
    return undefined;
  }
  const dictionary = catalogueDictionary();
  let changed = false;
  const corrected = tokens.map((token) => {
    const exact = dictionary.some(
      (term) => term === token || compact(term) === token,
    );
    if (exact || token.length < 5) {
      return token;
    }
    const ranked = dictionary
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

export function searchProducts(raw: string): SearchHit {
  const query = raw.trim().replace(/\s+/g, " ");
  const tokens = tokenizeSearchQuery(raw);
  const products = filterProducts(tokens);
  if (products.length > 0 || tokens.length === 0) {
    return { query, products };
  }
  const correctedTo = suggestCatalogueTerm(raw);
  if (!correctedTo) {
    return { query, products: [] };
  }
  return {
    query,
    products: filterProducts(tokenizeSearchQuery(correctedTo)),
    correctedTo,
  };
}

function matchesLabel(label: string, tokens: string[]): boolean {
  return matchesTokens(normalizeSearchQuery(label), tokens);
}

export function getSearchSuggestions(raw: string, limit = 6): SearchSuggestion[] {
  const tokens = tokenizeSearchQuery(raw);
  if (tokens.length === 0) {
    return [];
  }
  const found = searchProducts(raw);
  const suggestions: SearchSuggestion[] = [];

  for (const product of found.products.slice(0, limit)) {
    suggestions.push({
      id: `product:${product.id}`,
      kind: "product",
      label: product.name,
      meta: getBrandName(product),
      href: productPath(product.slug),
    });
  }

  for (const brand of getBrands()) {
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

export function getSearchDiscoveryLinks(): SearchDiscoveryLink[] {
  return [
    { id: "shop", label: "All shades", href: routes.shop },
    { id: "new-arrivals", label: "New arrivals", href: routes.newArrivals },
    { id: "best-sellers", label: "Best sellers", href: routes.bestSellers },
    { id: "men", label: "Men", href: routes.men },
    { id: "women", label: "Women", href: routes.women },
    { id: "unisex", label: "Unisex", href: routes.unisex },
    ...shapeLinks.map((link) => ({
      id: link.href,
      label: link.label,
      href: link.href,
    })),
    ...getBrands().map((brand) => ({
      id: brand.id,
      label: brand.name,
      href: searchPath(brand.name),
    })),
  ];
}

export function getSearchCollection(
  q: string,
  correctedTo?: string,
): CollectionDefinition {
  const display = correctedTo ?? q;
  return {
    id: "search",
    slug: "search",
    href: routes.search,
    title: `Results for “${display}”`,
    description: correctedTo
      ? `No exact match. Showing results for “${correctedTo}”.`
      : `Search results for “${q}”.`,
    kind: "all",
  };
}
