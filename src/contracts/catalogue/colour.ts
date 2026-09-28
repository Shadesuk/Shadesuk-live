import type { ColourThumbnail, ProductColour, ProductImage } from "@/types/catalogue";
import type { ProductVariantRow } from "./schema";
import { isSelectableVariant } from "./availability";
import { slugifyToken } from "./taxonomy";

/**
 * Colours are variant attributes (`colour_name`), not a colour table.
 * Hex is omitted — there is no swatch colour column. Never invent #111111.
 * A swatch thumbnail is the first valid image already mapped to that colour.
 */
export function colourIdFromName(colourName: string): string | null {
  return slugifyToken(colourName);
}

/** Storefront images whose variant maps to this colour, in catalogue order. */
export function imagesMappedToColour(
  images: readonly ProductImage[],
  colourId: string,
): ProductImage[] {
  if (!colourId) {
    return [];
  }
  return images.filter((image) => image.colourId === colourId);
}

export function isValidColourImage(image: ProductImage): boolean {
  const src = image.src?.trim();
  return Boolean(
    src &&
      Number.isFinite(image.width) &&
      image.width > 0 &&
      Number.isFinite(image.height) &&
      image.height > 0,
  );
}

/** First usable image for a colour. Shared, unmapped images are not candidates. */
export function firstValidColourImage(
  images: readonly ProductImage[],
  colourId: string,
): ProductImage | undefined {
  return imagesMappedToColour(images, colourId).find(isValidColourImage);
}

export function deriveColours(
  variants: ProductVariantRow[],
  options: { selectableOnly: boolean; images?: readonly ProductImage[] },
): ProductColour[] {
  const byId = new Map<string, ProductColour>();
  const images = options.images ?? [];

  for (const variant of variants) {
    if (variant.status === "draft" || variant.status === "archived") {
      continue;
    }
    const selectable = isSelectableVariant(variant);
    if (options.selectableOnly && !selectable) {
      continue;
    }
    const id = colourIdFromName(variant.colour_name);
    if (!id) {
      continue;
    }
    const existing = byId.get(id);
    if (existing) {
      existing.available = existing.available || selectable;
      continue;
    }
    const thumbnail = colourThumbnail(firstValidColourImage(images, id));
    byId.set(id, {
      id,
      slug: id,
      name: variant.colour_name.trim(),
      available: selectable,
      ...(thumbnail ? { thumbnail } : {}),
    });
  }

  return [...byId.values()];
}

function colourThumbnail(image: ProductImage | undefined): ColourThumbnail | undefined {
  const src = image?.src?.trim();
  if (!image || !src) {
    return undefined;
  }
  return {
    src,
    alt: image.alt,
    width: image.width,
    height: image.height,
  };
}

export function selectableColourCount(variants: ProductVariantRow[]): number {
  return deriveColours(variants, { selectableOnly: true }).length;
}
