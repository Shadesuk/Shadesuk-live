import type { Gender, Shape } from "@/types/catalogue";

export const SORT_IDS = [
  "featured",
  "newest",
  "price-asc",
  "price-desc",
  "best-selling",
] as const;

export type SortId = (typeof SORT_IDS)[number];

export const SORT_OPTIONS: ReadonlyArray<{ id: SortId; label: string }> = [
  { id: "featured", label: "Featured" },
  { id: "newest", label: "Newest" },
  { id: "price-asc", label: "Low → High" },
  { id: "price-desc", label: "High → Low" },
  { id: "best-selling", label: "Best Selling" },
];

export const PRICE_RANGE_IDS = [
  "under-50",
  "under-100",
  "50-100",
  "over-100",
] as const;

export type PriceRangeId = (typeof PRICE_RANGE_IDS)[number];

export const PRICE_RANGES: ReadonlyArray<{
  id: PriceRangeId;
  label: string;
  min?: number;
  max?: number;
}> = [
  { id: "under-50", label: "Under £50", max: 50 },
  { id: "under-100", label: "Under £100", max: 100 },
  { id: "50-100", label: "£50–£100", min: 50, max: 100 },
  { id: "over-100", label: "Over £100", min: 100 },
];

export const COLLECTION_PAGE_SIZE = 4;

export type CollectionKind =
  | "all"
  | "gender"
  | "merchandising"
  | "shape"
  | "brand";

export type HiddenFilterKey = "gender" | "shape" | "brand";

export type CollectionDefinition = {
  id: string;
  slug: string;
  href: string;
  title: string;
  description?: string;
  kind: CollectionKind;
  gender?: Gender;
  shape?: Shape;
  merchandising?: "new-arrivals" | "best-sellers";
  brandId?: string;
};

export type CollectionQuery = {
  genders: Gender[];
  brands: string[];
  shapes: Shape[];
  colours: string[];
  price?: PriceRangeId;
  inStockOnly: boolean;
  sort: SortId;
  limit: number;
};

export type CollectionFilterChip = {
  key: string;
  label: string;
};
