/**
 * Row shapes matching PR #10 (`supabase/migrations/20260914230750_initial_production_schema.sql`).
 * Snake_case matches Postgres. Do not treat these as storefront view-models.
 */

export const CATALOGUE_STATUSES = ["draft", "published", "archived"] as const;
export type CatalogueStatus = (typeof CATALOGUE_STATUSES)[number];

export const VARIANT_STATUSES = [
  "draft",
  "available",
  "unavailable",
  "archived",
] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

export const PRODUCT_IMAGE_TYPES = [
  "primary",
  "secondary",
  "detail",
  "side",
  "lifestyle",
] as const;
export type ProductImageType = (typeof PRODUCT_IMAGE_TYPES)[number];

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  description: string | null;
  details: Record<string, unknown> | null;
  materials: string | null;
  whats_included: string | null;
  shape: string | null;
  gender: string | null;
  fit: string | null;
  disclosure: string;
  status: CatalogueStatus;
  created_at: string;
  updated_at: string;
};

export type ProductVariantRow = {
  id: string;
  product_id: string;
  sku: string;
  colour_name: string;
  size_name: string | null;
  price_minor: number;
  compare_at_price_minor: number | null;
  currency: "GBP";
  lens_width_mm: number | null;
  bridge_width_mm: number | null;
  temple_length_mm: number | null;
  stock_quantity: number;
  status: VariantStatus;
  created_at: string;
  updated_at: string;
};

export type ProductImageRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  storage_path: string;
  alt_text: string;
  sort_order: number;
  image_type: ProductImageType;
  is_primary: boolean;
  width?: number | null;
  height?: number | null;
  created_at: string;
  updated_at: string;
};

export type CollectionRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_path: string | null;
  status: CatalogueStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProductCollectionRow = {
  product_id: string;
  collection_id: string;
  created_at: string;
};

/**
 * Server-assembled catalogue aggregate. Not a PostgREST view.
 * Callers must not ship this whole object to the browser as "the catalogue".
 */
export type ProductAggregate = {
  product: ProductRow;
  variants: ProductVariantRow[];
  images: ProductImageRow[];
  /** Published collection slugs linked via product_collections. */
  collectionSlugs: string[];
};
