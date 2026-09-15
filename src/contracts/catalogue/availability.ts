import type { Availability } from "@/types/catalogue";
import type { ProductVariantRow } from "./schema";

export function isSelectableVariant(variant: ProductVariantRow): boolean {
  return variant.status === "available" && variant.stock_quantity > 0;
}

export function isPurchasableStatus(variant: ProductVariantRow): boolean {
  return variant.status === "available";
}

/**
 * Product-level availability for cards/PLP.
 * `out_of_stock` vs `sold_out` is not a DB column: available+zero stock →
 * out_of_stock; no available-status variants in the aggregate → sold_out.
 */
export function productAvailabilityFromVariants(
  variants: ProductVariantRow[],
): Availability {
  if (variants.some(isSelectableVariant)) {
    return "in_stock";
  }
  if (variants.some(isPurchasableStatus)) {
    return "out_of_stock";
  }
  return "sold_out";
}

export function variantAvailability(variant: ProductVariantRow): Availability {
  if (isSelectableVariant(variant)) {
    return "in_stock";
  }
  if (variant.status === "available") {
    return "out_of_stock";
  }
  return "sold_out";
}
