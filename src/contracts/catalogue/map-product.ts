import type { Product, ProductMeasurements, ProductVariant } from "@/types/catalogue";
import { minorToMajorGbp } from "../money";
import { productAvailabilityFromVariants, variantAvailability } from "./availability";
import { brandIdForProduct, deriveBrandSource } from "./brand";
import { deriveColours } from "./colour";
import { toStorefrontImages, type ImageDimensionSource } from "./image";
import { merchandisingFlagsFromState } from "./merchandising";
import type { ProductAggregate, ProductVariantRow } from "./schema";
import { parseGenderTokens, parseShapeTokens, slugifyToken } from "./taxonomy";

export type StorefrontProjection = "card" | "pdp";

export type MapProductOptions = {
  projection: StorefrontProjection;
  /** Required before Product.images.src/width/height can be filled. */
  imageDimensions?: ImageDimensionSource;
  bestSellerIds?: ReadonlySet<string>;
  nowMs?: number;
};

/**
 * PDP-only fields from the catalogue row that the card type does not use.
 * Blank `disclosure` is omitted so the PDP can fall back to the locked copy.
 */
export type PdpCatalogueFields = {
  materials?: string;
  whatsIncluded?: string;
  fit?: string;
  sku?: string;
  disclosure?: string;
};

export type MappedStorefrontProduct = Product & {
  pdp?: PdpCatalogueFields;
};

export function mapProductAggregateToStorefront(
  aggregate: ProductAggregate,
  options: MapProductOptions,
): MappedStorefrontProduct | null {
  const { product, variants, images } = aggregate;
  if (product.status !== "published") {
    return null;
  }

  const cardVariant = pickCardPriceVariant(variants);
  if (!cardVariant) {
    return null;
  }

  const merchandising = merchandisingFlagsFromState({
    productId: product.id,
    publishedAt: product.published_at,
    bestSellerIds: options.bestSellerIds ?? new Set(),
    nowMs: options.nowMs,
  });
  const storefrontVariants = variants
    .filter((variant) => variant.status !== "draft" && variant.status !== "archived")
    .map(toStorefrontVariant);
  const colourIdByVariantId = new Map(
    variants.map((variant) => [variant.id, slugifyToken(variant.colour_name) ?? undefined]),
  );
  const storefrontImages = toStorefrontImages(images, options.imageDimensions).map((image) => {
    const row = images.find((item) => item.id === image.id);
    if (!row?.variant_id) {
      return image;
    }
    const colourId = colourIdByVariantId.get(row.variant_id);
    return {
      ...image,
      variantId: row.variant_id,
      ...(colourId ? { colourId } : {}),
    };
  });
  const colours = deriveColours(variants, {
    selectableOnly: options.projection === "card",
    images: storefrontImages,
  });

  const derivedBrand = deriveBrandSource(product.brand);
  const mapped: MappedStorefrontProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brandId: brandIdForProduct(product.brand),
    brandName: derivedBrand?.name,
    gender: parseGenderTokens(product.gender),
    shape: parseShapeTokens(product.shape),
    style: [],
    colours,
    price: minorToMajorGbp(cardVariant.price_minor),
    currency: "GBP",
    availability: productAvailabilityFromVariants(variants),
    isNewArrival: merchandising.isNewArrival,
    isBestSeller: merchandising.isBestSeller,
    images: storefrontImages,
    isDemo: false,
    variants: storefrontVariants,
    updatedAt: product.updated_at,
  };

  if (product.published_at) {
    mapped.publishedAt = product.published_at;
  }

  const compareAt = cardVariant.compare_at_price_minor;
  if (compareAt != null) {
    mapped.compareAtPrice = minorToMajorGbp(compareAt);
  }

  const sizes = distinctSizes(variants);
  if (sizes.length > 0) {
    mapped.sizes = sizes;
  }

  const measurements = sharedMeasurements(variants);
  if (measurements) {
    mapped.measurements = measurements;
  }

  const description = blankToUndefined(product.description);
  if (description) {
    mapped.description = description;
  }

  if (options.projection === "pdp") {
    mapped.pdp = pdpFields(product, cardVariant);
  }

  return mapped;
}

export function pickCardPriceVariant(
  variants: ProductVariantRow[],
): ProductVariantRow | undefined {
  const selectable = variants.filter(
    (variant) => variant.status === "available" && variant.stock_quantity > 0,
  );
  const priced = selectable.length > 0 ? selectable : variants.filter((variant) => variant.status === "available");
  const pool = priced.length > 0 ? priced : variants;
  if (pool.length === 0) {
    return undefined;
  }
  return pool.reduce((lowest, variant) =>
    variant.price_minor < lowest.price_minor ? variant : lowest,
  );
}

function toStorefrontVariant(variant: ProductVariantRow): ProductVariant {
  const mapped: ProductVariant = {
    id: variant.id,
    colourId: slugifyToken(variant.colour_name) ?? variant.id,
    availability: variantAvailability(variant),
  };
  const sku = blankToUndefined(variant.sku);
  if (sku) {
    mapped.sku = sku;
  }
  const size = blankToUndefined(variant.size_name);
  if (size) {
    mapped.size = size;
  }
  return mapped;
}

function distinctSizes(variants: ProductVariantRow[]): string[] {
  const sizes: string[] = [];
  const seen = new Set<string>();
  for (const variant of variants) {
    const size = blankToUndefined(variant.size_name);
    if (!size) {
      continue;
    }
    const key = size.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sizes.push(size);
  }
  return sizes;
}

function sharedMeasurements(
  variants: ProductVariantRow[],
): ProductMeasurements | undefined {
  const source = variants.find(
    (variant) =>
      variant.lens_width_mm != null ||
      variant.bridge_width_mm != null ||
      variant.temple_length_mm != null,
  );
  if (!source) {
    return undefined;
  }

  const same = variants.every((variant) => {
    if (
      variant.lens_width_mm == null &&
      variant.bridge_width_mm == null &&
      variant.temple_length_mm == null
    ) {
      return true;
    }
    return (
      variant.lens_width_mm === source.lens_width_mm &&
      variant.bridge_width_mm === source.bridge_width_mm &&
      variant.temple_length_mm === source.temple_length_mm
    );
  });
  if (!same) {
    return undefined;
  }

  const measurements: ProductMeasurements = {};
  if (source.lens_width_mm != null) {
    measurements.lensMm = source.lens_width_mm;
  }
  if (source.bridge_width_mm != null) {
    measurements.bridgeMm = source.bridge_width_mm;
  }
  if (source.temple_length_mm != null) {
    measurements.templeMm = source.temple_length_mm;
  }
  return measurements;
}

function pdpFields(
  product: ProductAggregate["product"],
  variant: ProductVariantRow,
): PdpCatalogueFields {
  const fields: PdpCatalogueFields = {};
  const materials = blankToUndefined(product.materials);
  const included = blankToUndefined(product.whats_included);
  const fit = blankToUndefined(product.fit);
  const sku = blankToUndefined(variant.sku);
  const disclosure = blankToUndefined(product.disclosure);
  if (materials) {
    fields.materials = materials;
  }
  if (included) {
    fields.whatsIncluded = included;
  }
  if (fit) {
    fields.fit = fit;
  }
  if (sku) {
    fields.sku = sku;
  }
  if (disclosure) {
    fields.disclosure = disclosure;
  }
  return fields;
}

function blankToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
