import type { ProductImage, ProductImageRole } from "@/types/catalogue";
import type { ProductImageRow, ProductImageType } from "./schema";

/**
 * Schema `product_image_type` vs locked storefront `ProductImageRole`.
 * `secondary` has no equal frontend role; it is the extra gallery/hover shot.
 */
export const IMAGE_TYPE_TO_ROLE: Record<ProductImageType, ProductImageRole> = {
  primary: "front",
  secondary: "side",
  detail: "detail",
  side: "side",
  lifestyle: "on-model",
};

export type CatalogueImageDto = {
  id: string;
  productId: string;
  variantId: string | null;
  storagePath: string;
  altText: string;
  sortOrder: number;
  imageType: ProductImageType;
  isPrimary: boolean;
  role: ProductImageRole;
};

export function toCatalogueImageDto(row: ProductImageRow): CatalogueImageDto {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    storagePath: row.storage_path,
    altText: row.alt_text,
    sortOrder: row.sort_order,
    imageType: row.image_type,
    isPrimary: row.is_primary,
    role: IMAGE_TYPE_TO_ROLE[row.image_type],
  };
}

export type ImageDimensionSource = {
  width: number;
  height: number;
};

/**
 * Storefront `ProductImage` requires width/height. PR #10 has neither.
 * Do not invent dimensions. Only project to Product.images when a caller
 * supplies measured asset metadata (3.4+).
 */
export function toStorefrontImages(
  rows: ProductImageRow[],
  dimensions?: ImageDimensionSource,
): ProductImage[] {
  if (!dimensions) {
    return [];
  }
  if (!Number.isInteger(dimensions.width) || dimensions.width <= 0) {
    return [];
  }
  if (!Number.isInteger(dimensions.height) || dimensions.height <= 0) {
    return [];
  }

  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    .map((row) => {
      const src = absoluteAssetUrl(row.storage_path);
      const image: ProductImage = {
        id: row.id,
        role: IMAGE_TYPE_TO_ROLE[row.image_type],
        alt: row.alt_text,
        width: dimensions.width,
        height: dimensions.height,
      };
      if (src) {
        image.src = src;
      }
      return image;
    });
}

function absoluteAssetUrl(storagePath: string): string | undefined {
  const trimmed = storagePath.trim();
  if (/^https:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}
