/**
 * PR #10 has no is_new_arrival / is_best_seller columns.
 * Merchandising flags are membership in published collections whose slugs
 * match the locked storefront routes.
 */
export const MERCHANDISING_COLLECTION_SLUGS = {
  newArrivals: "new-arrivals",
  bestSellers: "best-sellers",
} as const;

export type MerchandisingFlags = {
  isNewArrival: boolean;
  isBestSeller: boolean;
};

export function merchandisingFromCollectionSlugs(
  collectionSlugs: readonly string[],
): MerchandisingFlags {
  const slugs = new Set(collectionSlugs);
  return {
    isNewArrival: slugs.has(MERCHANDISING_COLLECTION_SLUGS.newArrivals),
    isBestSeller: slugs.has(MERCHANDISING_COLLECTION_SLUGS.bestSellers),
  };
}
