import { productPath, routes, shapeLinks } from "@/lib/navigation";
import {
  collectionQueryPath,
  emptyCollectionQuery,
} from "@/lib/collection-query";
import type { CollectionDefinition } from "@/types/collection";

export type SearchHit<TProduct> = {
  query: string;
  products: TProduct[];
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

export const SEARCH_QUERY_MAX_LENGTH = 80;

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

export function clampSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, SEARCH_QUERY_MAX_LENGTH);
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

/** Route-level discovery. Brand links are appended server-side from the live snapshot. */
export function getStaticSearchDiscoveryLinks(): SearchDiscoveryLink[] {
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
  ];
}

export function productSuggestionHref(slug: string): string {
  return productPath(slug);
}
