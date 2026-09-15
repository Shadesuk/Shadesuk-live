export const GENDERS = ["men", "women", "unisex"] as const;
export type Gender = (typeof GENDERS)[number];

export const SHAPES = [
  "aviator",
  "rectangle",
  "square",
  "round",
  "cat-eye",
] as const;
export type Shape = (typeof SHAPES)[number];

/**
 * Style is reserved for a future catalogue-backed taxonomy.
 * Do not populate demo values while Classic/Sport vs Everyday remains unresolved.
 */
export type Style = string;

export const AVAILABILITIES = [
  "in_stock",
  "out_of_stock",
  "sold_out",
] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const PRODUCT_IMAGE_ROLES = [
  "front",
  "side",
  "detail",
  "back",
  "temple",
  "on-model",
  "packaging",
] as const;
export type ProductImageRole = (typeof PRODUCT_IMAGE_ROLES)[number];

export const BRAND_STATUSES = ["active", "inactive"] as const;
export type BrandStatus = (typeof BRAND_STATUSES)[number];

export type BrandLogo = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

/** Catalogue brand record. productCount is derived at read time, never stored. */
export type BrandSource = {
  id: string;
  slug: string;
  name: string;
  status: BrandStatus;
  isDemo: boolean;
  description?: string;
  logo?: BrandLogo;
};

export type Brand = BrandSource & {
  productCount: number;
};

export type ProductColour = {
  id: string;
  slug: string;
  name: string;
  /** Frame/lens colour only — not a UI accent token. */
  hex?: string;
  available: boolean;
};

export type ProductImage = {
  id: string;
  role: ProductImageRole;
  alt: string;
  width: number;
  height: number;
  /** Omit until a legitimate asset exists. */
  src?: string;
};

export type ProductMeasurements = {
  lensMm?: number;
  bridgeMm?: number;
  templeMm?: number;
};

export type ProductVariant = {
  id: string;
  colourId: string;
  availability: Availability;
  sku?: string;
  size?: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  brandId: string;
  /** Display name. Optional so demo fixtures can keep using brand lookup. */
  brandName?: string;
  gender: Gender[];
  shape: Shape[];
  /** Structural only. Leave empty until styles are approved and data-backed. */
  style: Style[];
  colours: ProductColour[];
  price: number;
  currency: "GBP";
  availability: Availability;
  isNewArrival: boolean;
  isBestSeller: boolean;
  images: ProductImage[];
  isDemo: boolean;
  compareAtPrice?: number;
  variants?: ProductVariant[];
  sizes?: string[];
  measurements?: ProductMeasurements;
  description?: string;
  details?: string;
};

export type Catalogue = {
  brands: BrandSource[];
  products: Product[];
};

export type StorefrontCatalogueSource = "live" | "demo" | "empty";

export type CatalogueFilters = {
  genders: Gender[];
  brands: Brand[];
  shapes: Shape[];
  colours: ProductColour[];
  availability: Availability[];
  price: {
    min: number;
    max: number;
  };
};
