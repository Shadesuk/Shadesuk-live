import type { Product, ProductMeasurements, ProductVariant } from "@/types/catalogue";
import { minorToMajorGbp } from "../money";
import { productAvailabilityFromVariants, variantAvailability } from "./availability";
import { brandIdForProduct } from "./brand";
import { deriveColours } from "./colour";
import { toStorefrontImages, type ImageDimensionSource } from "./image";
import { merchandisingFromCollectionSlugs } from "./merchandising";
import type { ProductAggregate, ProductVariantRow } from "./schema";
import { parseGenderTokens, parseShapeTokens, slugifyToken } from "./taxonomy";

export type StorefrontProjection = "card" | "pdp";

export type MapProductOptions = {
  projection: StorefrontProjection;
  /** Required before Product.images.src/width/height can be filled. */
  imageDimensions?: ImageDimensionSource;
};

/**
 * PDP-only fields from PR #10 that the card type does not use.
 * `disclosure` is intentionally absent: the PDP component is global, not CMS copy.
 */
export type PdpCatalogueFields = {
  materials?: string;
  whatsIncluded?: string;
  fit?: string;
  sku?: string;
};

export type MappedStorefrontProduct = Product & {
  pdp?: PdpCatalogueFields;
};

export function mapProductAggregateToStorefront(
  aggregate: ProductAggregate,
  options: MapProductOptions,
): MappedStorefrontProduct | null {
  const { product, variants, images, collectionSlugs } = aggregate;
  if (product.status !== "published") {
    return null;
  }

  const cardVariant = pickCardPriceVariant(variants);
  if (!cardVariant) {
    return null;
  }

  const merchandising = merchandisingFromCollectionSlugs(collectionSlugs);
  const colours = deriveColours(variants, {
    selectableOnly: options.projection === "card",
  });
  const storefrontVariants = variants
    .filter((variant) => variant.status !== "draft" && variant.status !== "archived")
    .map(toStorefrontVariant);

  const mapped: MappedStorefrontProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brandId: brandIdForProduct(product.brand),
    gender: parseGenderTokens(product.gender),
    shape: parseShapeTokens(product.shape),
    style: [],
    colours,
    price: minorToMajorGbp(cardVariant.price_minor),
    currency: "GBP",
    availability: productAvailabilityFromVariants(variants),
    isNewArrival: merchandising.isNewArrival,
    isBestSeller: merchandising.isBestSeller,
    images: toStorefrontImages(images, options.imageDimensions),
    isDemo: false,
    variants: storefrontVariants,
  };

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
  return fields;
}

function blankToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
