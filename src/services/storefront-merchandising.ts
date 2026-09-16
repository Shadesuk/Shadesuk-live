import "server-only";

import { HOMEPAGE_MERCHANDISING_ID } from "@/contracts/catalogue/merchandising";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import type { Product } from "@/types/catalogue";

export type StorefrontMerchandising = {
  featuredEnabled: boolean;
  bestSellersEnabled: boolean;
  featuredIds: string[];
  bestSellerIds: string[];
  flagshipId: string | null;
};

export async function loadStorefrontMerchandisingConfig(): Promise<StorefrontMerchandising> {
  const empty: StorefrontMerchandising = {
    featuredEnabled: false,
    bestSellersEnabled: false,
    featuredIds: [],
    bestSellerIds: [],
    flagshipId: null,
  };
  if (!isSupabaseConfigured()) {
    return empty;
  }
  try {
    const supabase = createSupabasePublicClient();
    const [config, featured, bestSellers] = await Promise.all([
      supabase
        .from("homepage_merchandising")
        .select("featured_enabled, best_sellers_enabled, flagship_product_id")
        .eq("id", HOMEPAGE_MERCHANDISING_ID)
        .maybeSingle(),
      supabase.from("homepage_featured_products").select("product_id, sort_order").order("sort_order"),
      supabase.from("homepage_best_seller_products").select("product_id, sort_order").order("sort_order"),
    ]);
    if (config.error || featured.error || bestSellers.error) {
      return empty;
    }
    return {
      featuredEnabled: Boolean(config.data?.featured_enabled),
      bestSellersEnabled: Boolean(config.data?.best_sellers_enabled),
      featuredIds: orderedIds(featured.data),
      bestSellerIds: orderedIds(bestSellers.data),
      flagshipId:
        config.data && typeof config.data.flagship_product_id === "string"
          ? config.data.flagship_product_id
          : null,
    };
  } catch {
    return empty;
  }
}

export function productsInOrder(products: Product[], ids: readonly string[]): Product[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  return ids
    .map((id) => byId.get(id))
    .filter((product): product is Product => Boolean(product && !product.isDemo));
}

export function getFlagshipProduct(products: Product[], flagshipId: string | null): Product | undefined {
  if (!flagshipId) {
    return undefined;
  }
  return products.find((product) => product.id === flagshipId && !product.isDemo);
}

export function getAutomaticNewArrivals(products: Product[], limit = 4): Product[] {
  return products
    .filter((product) => product.isNewArrival)
    .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? "") || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function orderedIds(data: unknown): string[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((row) =>
      row && typeof row === "object" && typeof (row as { product_id?: unknown }).product_id === "string"
        ? (row as { product_id: string }).product_id
        : "",
    )
    .filter(Boolean);
}
