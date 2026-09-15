import type { ProductColour } from "@/types/catalogue";
import type { ProductVariantRow } from "./schema";
import { isSelectableVariant } from "./availability";
import { slugifyToken } from "./taxonomy";

/**
 * Colours are variant attributes (`colour_name`), not a colour table.
 * Hex is omitted — PR #10 has no swatch colour. Never invent #111111 etc.
 */
export function colourIdFromName(colourName: string): string | null {
  return slugifyToken(colourName);
}

export function deriveColours(
  variants: ProductVariantRow[],
  options: { selectableOnly: boolean },
): ProductColour[] {
  const byId = new Map<string, ProductColour>();

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
    byId.set(id, {
      id,
      slug: id,
      name: variant.colour_name.trim(),
      available: selectable,
    });
  }

  return [...byId.values()];
}

export function selectableColourCount(variants: ProductVariantRow[]): number {
  return deriveColours(variants, { selectableOnly: true }).length;
}
