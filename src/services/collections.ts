import { brandPath, routes, shapeLinks } from "@/lib/navigation";
import {
  collectionQueryPath,
  countActiveFilters,
  emptyCollectionQuery,
  getFilterChips,
  hasUserFilters,
  hiddenFilterKeys,
  matchesPriceRange,
  parseCollectionQuery,
  removeFilterChip,
  serializeCollectionQuery,
  genderLabel,
  shapeLabel,
} from "@/lib/collection-query";
import {
  getAvailableFilters,
  getPopulatedShapes,
} from "@/services/catalogue";
import type { CollectionDefinition, CollectionQuery, SortId } from "@/types/collection";
import type { Brand, Product, Shape } from "@/types/catalogue";

export {
  collectionQueryPath,
  countActiveFilters,
  emptyCollectionQuery,
  getFilterChips,
  hasUserFilters,
  hiddenFilterKeys,
  matchesPriceRange,
  parseCollectionQuery,
  removeFilterChip,
  serializeCollectionQuery,
  genderLabel,
  shapeLabel,
};

export type CatalogueSnapshot = {
  products: Product[];
  brands: Brand[];
};

const collections: CollectionDefinition[] = [
  {
    id: "shop",
    slug: "shop",
    href: routes.shop,
    title: "All shades",
    description: "The full SHADESUK catalogue.",
    kind: "all",
  },
  {
    id: "men",
    slug: "men",
    href: routes.men,
    title: "Men",
    description: "Frames merchandised for men.",
    kind: "gender",
    gender: "men",
  },
  {
    id: "women",
    slug: "women",
    href: routes.women,
    title: "Women",
    description: "Frames merchandised for women.",
    kind: "gender",
    gender: "women",
  },
  {
    id: "unisex",
    slug: "unisex",
    href: routes.unisex,
    title: "Unisex",
    description: "Frames merchandised as unisex.",
    kind: "gender",
    gender: "unisex",
  },
  {
    id: "new-arrivals",
    slug: "new-arrivals",
    href: routes.newArrivals,
    title: "New arrivals",
    description: "Recently added shades.",
    kind: "merchandising",
    merchandising: "new-arrivals",
  },
  {
    id: "best-sellers",
    slug: "best-sellers",
    href: routes.bestSellers,
    title: "Best sellers",
    description: "Shades with established demand.",
    kind: "merchandising",
    merchandising: "best-sellers",
  },
  ...shapeLinks.map((link) => {
    const slug = link.href.replace("/collections/", "") as Shape;
    return {
      id: slug,
      slug,
      href: link.href,
      title: link.label,
      description: `${link.label} frames.`,
      kind: "shape" as const,
      shape: slug,
    };
  }),
];

export function getCollections(): CollectionDefinition[] {
  return collections;
}

export function getCollectionById(
  id: string,
): CollectionDefinition | undefined {
  return collections.find((collection) => collection.id === id);
}

export function getCollectionBySlug(
  slug: string,
): CollectionDefinition | undefined {
  return collections.find(
    (collection) => collection.kind === "shape" && collection.slug === slug,
  );
}

export function getPopulatedShapeCollections(
  products: Product[],
): CollectionDefinition[] {
  return getPopulatedShapes(products)
    .map((shape) => getCollectionBySlug(shape))
    .filter((collection): collection is CollectionDefinition =>
      Boolean(collection),
    );
}

/**
 * Public discovery collections for the hub.
 * Style collections remain unpublished until the taxonomy is resolved.
 */
export function getPopulatedCollections(
  products: Product[],
): CollectionDefinition[] {
  return getPopulatedShapeCollections(products);
}

export function getBrandCollection(brand: Brand): CollectionDefinition {
  return {
    id: `brand:${brand.id}`,
    slug: brand.slug,
    href: brandPath(brand.slug),
    title: brand.name,
    description: brand.description,
    kind: "brand",
    brandId: brand.id,
  };
}

export function getBrandCollectionBySlug(
  slug: string,
  brands: Brand[],
): CollectionDefinition | undefined {
  const brand = brands.find((item) => item.slug === slug && item.status === "active");
  if (!brand) {
    return undefined;
  }
  return getBrandCollection(brand);
}

export function getCollectionProducts(
  collection: CollectionDefinition,
  products: Product[],
  brands: Brand[] = [],
): Product[] {
  if (collection.kind === "gender" && collection.gender) {
    return products.filter((product) => product.gender.includes(collection.gender!));
  }
  if (collection.merchandising === "new-arrivals") {
    return products.filter((product) => product.isNewArrival);
  }
  if (collection.merchandising === "best-sellers") {
    return products.filter((product) => product.isBestSeller);
  }
  if (collection.kind === "shape" && collection.shape) {
    return products.filter((product) => product.shape.includes(collection.shape!));
  }
  if (collection.kind === "brand" && collection.brandId) {
    return products.filter((product) => {
      if (product.brandId === collection.brandId) {
        return true;
      }
      const brand = brands.find(
        (item) => item.id === collection.brandId || item.slug === collection.slug,
      );
      return Boolean(brand && product.brandId === brand.id);
    });
  }
  return products;
}

function productMatchesBrand(
  product: Product,
  brandValues: string[],
  brands: Brand[],
): boolean {
  return brandValues.some((value) => {
    if (product.brandId === value) {
      return true;
    }
    const brand = brands.find(
      (item) => item.id === value || item.slug === value,
    );
    return Boolean(brand && product.brandId === brand.id);
  });
}

export function applyFilters(
  products: Product[],
  query: CollectionQuery,
  brands: Brand[] = [],
): Product[] {
  return products.filter((product) => {
    if (
      query.genders.length > 0 &&
      !query.genders.some((gender) => product.gender.includes(gender))
    ) {
      return false;
    }
    if (query.brands.length > 0 && !productMatchesBrand(product, query.brands, brands)) {
      return false;
    }
    if (
      query.shapes.length > 0 &&
      !query.shapes.some((shape) => product.shape.includes(shape))
    ) {
      return false;
    }
    if (
      query.colours.length > 0 &&
      !product.colours.some((colour) => query.colours.includes(colour.slug))
    ) {
      return false;
    }
    if (query.price && !matchesPriceRange(product.price, query.price)) {
      return false;
    }
    if (query.inStockOnly && product.availability !== "in_stock") {
      return false;
    }
    return true;
  });
}

export function applySort(products: Product[], sort: SortId): Product[] {
  const next = [...products];
  if (sort === "newest") {
    return next.sort((a, b) => {
      const published = Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? "");
      if (Number.isFinite(published) && published !== 0) {
        return published;
      }
      return Number(b.isNewArrival) - Number(a.isNewArrival);
    });
  }
  if (sort === "best-selling") {
    return next.sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller));
  }
  if (sort === "price-asc") {
    return next.sort((a, b) => a.price - b.price);
  }
  if (sort === "price-desc") {
    return next.sort((a, b) => b.price - a.price);
  }
  return next;
}

export function getFilteredProductCount(
  collection: CollectionDefinition,
  query: CollectionQuery,
  snapshot: CatalogueSnapshot,
): number {
  const products = getCollectionProducts(
    collection,
    snapshot.products,
    snapshot.brands,
  );
  return applyFilters(
    products,
    contextualQuery(collection, query),
    snapshot.brands,
  ).length;
}

export function queryCollection(
  collection: CollectionDefinition,
  query: CollectionQuery,
  products: Product[],
  brands: Brand[],
) {
  const filterQuery = contextualQuery(collection, query);
  const filtered = applySort(
    applyFilters(products, filterQuery, brands),
    filterQuery.sort,
  );
  return {
    products: filtered.slice(0, query.limit),
    total: filtered.length,
    hasMore: filtered.length > query.limit,
    filterOptions: getAvailableFilters(products, brands),
  };
}

export function queryCollectionFromSnapshot(
  collection: CollectionDefinition,
  query: CollectionQuery,
  snapshot: CatalogueSnapshot,
) {
  const scoped = getCollectionProducts(collection, snapshot.products, snapshot.brands);
  return queryCollection(collection, query, scoped, snapshot.brands);
}

function contextualQuery(
  collection: CollectionDefinition,
  query: CollectionQuery,
): CollectionQuery {
  if (collection.kind === "brand") {
    return { ...query, brands: [] };
  }
  return query;
}
