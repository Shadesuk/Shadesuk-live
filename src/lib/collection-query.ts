import { GENDERS, SHAPES, type Gender, type Shape } from "@/types/catalogue";
import type { CatalogueFilters } from "@/types/catalogue";
import {
  COLLECTION_PAGE_SIZE,
  PRICE_RANGES,
  SORT_IDS,
  type CollectionDefinition,
  type CollectionFilterChip,
  type CollectionQuery,
  type HiddenFilterKey,
  type PriceRangeId,
  type SortId,
} from "@/types/collection";

const GENDER_LABELS: Record<Gender, string> = {
  men: "Men",
  women: "Women",
  unisex: "Unisex",
};

const SHAPE_LABELS: Record<Shape, string> = {
  aviator: "Aviator",
  rectangle: "Rectangle",
  square: "Square",
  round: "Round",
  "cat-eye": "Cat-Eye",
};

export function genderLabel(gender: Gender): string {
  return GENDER_LABELS[gender];
}

export function shapeLabel(shape: Shape): string {
  return SHAPE_LABELS[shape];
}

export function matchesPriceRange(price: number, rangeId: PriceRangeId): boolean {
  const range = PRICE_RANGES.find((item) => item.id === rangeId);
  if (!range) {
    return true;
  }
  if (range.min !== undefined && price < range.min) {
    return false;
  }
  if (range.max !== undefined && price >= range.max) {
    return false;
  }
  return true;
}

function readList(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}

function isShape(value: string): value is Shape {
  return (SHAPES as readonly string[]).includes(value);
}

function isSort(value: string): value is SortId {
  return (SORT_IDS as readonly string[]).includes(value);
}

function isPriceRange(value: string): value is PriceRangeId {
  return PRICE_RANGES.some((range) => range.id === value);
}

export function parseCollectionQuery(
  searchParams: Record<string, string | string[] | undefined>,
): CollectionQuery {
  const genders = readList(searchParams.gender).filter(isGender);
  const shapes = readList(searchParams.shape).filter(isShape);
  const sortValue = Array.isArray(searchParams.sort)
    ? searchParams.sort[0]
    : searchParams.sort;
  const priceValue = Array.isArray(searchParams.price)
    ? searchParams.price[0]
    : searchParams.price;
  const availability = readList(searchParams.availability);
  const limitValue = Array.isArray(searchParams.limit)
    ? searchParams.limit[0]
    : searchParams.limit;
  const parsedLimit = Number.parseInt(limitValue ?? "", 10);
  const qValue = Array.isArray(searchParams.q)
    ? searchParams.q[0]
    : searchParams.q;
  const q = qValue?.trim().replace(/\s+/g, " ");

  return {
    q: q || undefined,
    genders,
    brands: readList(searchParams.brand),
    shapes,
    colours: readList(searchParams.colour),
    price: priceValue && isPriceRange(priceValue) ? priceValue : undefined,
    inStockOnly: availability.includes("in_stock"),
    sort: sortValue && isSort(sortValue) ? sortValue : "featured",
    limit:
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : COLLECTION_PAGE_SIZE,
  };
}

export function serializeCollectionQuery(
  query: CollectionQuery,
  options?: { resetLimit?: boolean },
): string {
  const params = new URLSearchParams();
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.genders.length) {
    params.set("gender", query.genders.join(","));
  }
  if (query.brands.length) {
    params.set("brand", query.brands.join(","));
  }
  if (query.shapes.length) {
    params.set("shape", query.shapes.join(","));
  }
  if (query.colours.length) {
    params.set("colour", query.colours.join(","));
  }
  if (query.price) {
    params.set("price", query.price);
  }
  if (query.inStockOnly) {
    params.set("availability", "in_stock");
  }
  if (query.sort !== "featured") {
    params.set("sort", query.sort);
  }
  const limit = options?.resetLimit ? COLLECTION_PAGE_SIZE : query.limit;
  if (limit !== COLLECTION_PAGE_SIZE) {
    params.set("limit", String(limit));
  }
  return params.toString();
}

export function emptyCollectionQuery(): CollectionQuery {
  return {
    genders: [],
    brands: [],
    shapes: [],
    colours: [],
    inStockOnly: false,
    sort: "featured",
    limit: COLLECTION_PAGE_SIZE,
  };
}

export function collectionQueryPath(
  href: string,
  query: CollectionQuery,
  options?: { resetLimit?: boolean },
): string {
  const search = serializeCollectionQuery(query, options);
  return search ? `${href}?${search}` : href;
}

export function hiddenFilterKeys(
  collection: CollectionDefinition,
): HiddenFilterKey[] {
  if (collection.kind === "gender") {
    return ["gender"];
  }
  if (collection.kind === "shape") {
    return ["shape"];
  }
  if (collection.kind === "brand") {
    return ["brand"];
  }
  return [];
}

export function getFilterChips(
  query: CollectionQuery,
  collection: CollectionDefinition,
  options: CatalogueFilters,
): CollectionFilterChip[] {
  const hidden = hiddenFilterKeys(collection);
  const chips: CollectionFilterChip[] = [];

  if (!hidden.includes("gender")) {
    for (const gender of query.genders) {
      chips.push({
        key: `gender:${gender}`,
        label: GENDER_LABELS[gender],
      });
    }
  }

  if (!hidden.includes("brand")) {
    for (const brandId of query.brands) {
      const brand = options.brands.find(
        (item) => item.id === brandId || item.slug === brandId,
      );
      chips.push({
        key: `brand:${brandId}`,
        label: brand?.name ?? brandId,
      });
    }
  }

  if (!hidden.includes("shape")) {
    for (const shape of query.shapes) {
      chips.push({
        key: `shape:${shape}`,
        label: SHAPE_LABELS[shape],
      });
    }
  }

  for (const colour of query.colours) {
    const match = options.colours.find((item) => item.slug === colour);
    chips.push({
      key: `colour:${colour}`,
      label: match?.name ?? colour,
    });
  }

  if (query.price) {
    const range = PRICE_RANGES.find((item) => item.id === query.price);
    chips.push({
      key: `price:${query.price}`,
      label: range?.label ?? query.price,
    });
  }

  if (query.inStockOnly) {
    chips.push({ key: "availability:in_stock", label: "In stock" });
  }

  return chips;
}

export function removeFilterChip(
  query: CollectionQuery,
  key: string,
): CollectionQuery {
  const [group, value] = key.split(":");
  if (group === "gender") {
    return { ...query, genders: query.genders.filter((item) => item !== value) };
  }
  if (group === "brand") {
    return { ...query, brands: query.brands.filter((item) => item !== value) };
  }
  if (group === "shape") {
    return { ...query, shapes: query.shapes.filter((item) => item !== value) };
  }
  if (group === "colour") {
    return { ...query, colours: query.colours.filter((item) => item !== value) };
  }
  if (group === "price") {
    return { ...query, price: undefined };
  }
  if (group === "availability") {
    return { ...query, inStockOnly: false };
  }
  return query;
}

export function countActiveFilters(
  query: CollectionQuery,
  collection: CollectionDefinition,
  options: CatalogueFilters,
): number {
  return getFilterChips(query, collection, options).length;
}

export function hasUserFilters(
  query: CollectionQuery,
  collection: CollectionDefinition,
): boolean {
  const hidden = hiddenFilterKeys(collection);
  if (!hidden.includes("gender") && query.genders.length > 0) {
    return true;
  }
  if (!hidden.includes("brand") && query.brands.length > 0) {
    return true;
  }
  if (!hidden.includes("shape") && query.shapes.length > 0) {
    return true;
  }
  return query.colours.length > 0 || Boolean(query.price) || query.inStockOnly;
}
