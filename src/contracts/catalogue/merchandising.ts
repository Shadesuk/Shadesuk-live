/**
 * Homepage merchandising is Superadmin-controlled, except New Arrivals
 * which are derived from products.published_at (first successful publish).
 *
 * Collection slugs are not the V1 merchandising source of truth.
 * merchandisingFromCollectionSlugs remains for legacy fixture mapping only.
 */
export const MERCHANDISING_COLLECTION_SLUGS = {
  newArrivals: "new-arrivals",
  bestSellers: "best-sellers",
} as const;

export const NEW_ARRIVAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const HOMEPAGE_MERCHANDISING_ID = "homepage";

export type MerchandisingFlags = {
  isNewArrival: boolean;
  isBestSeller: boolean;
};

export type MerchandisingMembership = {
  featuredIds: readonly string[];
  bestSellerIds: readonly string[];
  flagshipId: string | null;
  featuredEnabled: boolean;
  bestSellersEnabled: boolean;
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

export function isNewArrivalFromPublishedAt(
  publishedAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!publishedAt) {
    return false;
  }
  const publishedMs = Date.parse(publishedAt);
  if (!Number.isFinite(publishedMs)) {
    return false;
  }
  const elapsed = nowMs - publishedMs;
  return elapsed >= 0 && elapsed <= NEW_ARRIVAL_WINDOW_MS;
}

export function newArrivalDaysRemaining(
  publishedAt: string | null | undefined,
  nowMs = Date.now(),
): number | null {
  if (!publishedAt || !isNewArrivalFromPublishedAt(publishedAt, nowMs)) {
    return null;
  }
  const publishedMs = Date.parse(publishedAt);
  if (!Number.isFinite(publishedMs)) {
    return null;
  }
  const remainingMs = NEW_ARRIVAL_WINDOW_MS - (nowMs - publishedMs);
  return Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

export function merchandisingFlagsFromState(
  input: {
    productId: string;
    publishedAt: string | null | undefined;
    bestSellerIds: ReadonlySet<string>;
    nowMs?: number;
  },
): MerchandisingFlags {
  return {
    isNewArrival: isNewArrivalFromPublishedAt(input.publishedAt, input.nowMs),
    isBestSeller: input.bestSellerIds.has(input.productId),
  };
}
