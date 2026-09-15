/**
 * Live cart hydration uses the service-role client (RLS cannot see guest rows).
 * Unpublished products and non-available variants must not enter the bag.
 */
export function isLiveVariantEligibleForCart(input: {
  productStatus: string;
  variantStatus: string;
}): boolean {
  return input.productStatus === "published" && input.variantStatus === "available";
}
