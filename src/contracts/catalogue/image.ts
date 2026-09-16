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

export const PRODUCT_IMAGES_BUCKET = "product-images";

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
  width: number | null;
  height: number | null;
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
    width: row.width ?? null,
    height: row.height ?? null,
  };
}

export type ImageDimensionSource = {
  width: number;
  height: number;
};

export function cataloguePublicImageUrl(storagePath: string): string | undefined {
  const trimmed = storagePath.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^https:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!projectUrl) {
    return undefined;
  }
  try {
    const origin = new URL(projectUrl).origin;
    const objectPath = trimmed.replace(/^\/+/, "").replace(new RegExp(`^${PRODUCT_IMAGES_BUCKET}/`), "");
    return `${origin}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${objectPath}`;
  } catch {
    return undefined;
  }
}

export function dimensionsFromImageRow(row: ProductImageRow): ImageDimensionSource | null {
  const width = row.width ?? null;
  const height = row.height ?? null;
  if (!Number.isInteger(width) || !width || width <= 0) {
    return null;
  }
  if (!Number.isInteger(height) || !height || height <= 0) {
    return null;
  }
  return { width, height };
}

/**
 * Storefront `ProductImage` requires width/height. Rows without measured
 * dimensions are omitted. Relative storage paths become src only when a public
 * bucket URL can be resolved; otherwise src is omitted.
 */
export function toStorefrontImages(
  rows: ProductImageRow[],
  dimensions?: ImageDimensionSource,
): ProductImage[] {
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    .flatMap((row) => {
      const measured = dimensionsFromImageRow(row) ?? dimensions ?? null;
      if (!measured) {
        return [];
      }
      const src = cataloguePublicImageUrl(row.storage_path);
      const image: ProductImage = {
        id: row.id,
        role: IMAGE_TYPE_TO_ROLE[row.image_type],
        alt: row.alt_text,
        width: measured.width,
        height: measured.height,
      };
      if (src) {
        image.src = src;
      }
      return [image];
    });
}
