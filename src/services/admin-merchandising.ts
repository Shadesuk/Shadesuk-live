import "server-only";

import {
  ADMIN_MERCHANDISING_LIST_MAX,
  ADMIN_MERCHANDISING_SEARCH_LIMIT,
  parseMerchandisingSearch,
  type AdminMerchandisingProductRef,
  type AdminMerchandisingSaveInput,
  type AdminMerchandisingView,
} from "@/contracts/admin/merchandising";
import { canAccessMerchandising, type AdminV1Role } from "@/contracts/admin/roles";
import { cataloguePublicImageUrl } from "@/contracts/catalogue/image";
import { HOMEPAGE_MERCHANDISING_ID, isNewArrivalFromPublishedAt } from "@/contracts/catalogue/merchandising";
import { isUuid } from "@/lib/ids";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminMerchandisingLoadResult =
  | { status: "ok"; data: AdminMerchandisingView }
  | { status: "error" }
  | { status: "forbidden" };

export type AdminMerchandisingMutationResult =
  | { status: "ok" }
  | { status: "invalid"; message: string }
  | { status: "error" }
  | { status: "forbidden" };

export async function loadAdminMerchandising(
  role: AdminV1Role,
): Promise<AdminMerchandisingLoadResult> {
  if (!canAccessMerchandising(role)) {
    return { status: "forbidden" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const [config, featured, bestSellers, newArrivals] = await Promise.all([
      supabase
        .from("homepage_merchandising")
        .select("featured_enabled, best_sellers_enabled, flagship_product_id")
        .eq("id", HOMEPAGE_MERCHANDISING_ID)
        .maybeSingle(),
      supabase
        .from("homepage_featured_products")
        .select("product_id, sort_order")
        .order("sort_order"),
      supabase
        .from("homepage_best_seller_products")
        .select("product_id, sort_order")
        .order("sort_order"),
      supabase
        .from("products")
        .select("id, slug, name, brand, status, published_at")
        .eq("status", "published")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(40),
    ]);
    if (config.error || featured.error || bestSellers.error || newArrivals.error) {
      return { status: "error" };
    }
    const featuredIds = idsFromOrder(featured.data);
    const bestSellerIds = idsFromOrder(bestSellers.data);
    const flagshipId =
      config.data && typeof config.data.flagship_product_id === "string"
        ? config.data.flagship_product_id
        : null;
    const needed = [...new Set([...featuredIds, ...bestSellerIds, ...(flagshipId ? [flagshipId] : [])])];
    const refs = await loadProductRefs(needed);
    const byId = new Map(refs.map((item) => [item.id, item]));
    const arrivalRows = (Array.isArray(newArrivals.data) ? newArrivals.data : []).filter(
      (row) =>
        row &&
        typeof row.id === "string" &&
        row.status === "published" &&
        isNewArrivalFromPublishedAt(typeof row.published_at === "string" ? row.published_at : null),
    );
    const arrivalRefs = await loadProductRefs(arrivalRows.map((row) => String(row.id)));
    return {
      status: "ok",
      data: {
        featuredEnabled: Boolean(config.data?.featured_enabled),
        bestSellersEnabled: Boolean(config.data?.best_sellers_enabled),
        featured: featuredIds.map((id) => byId.get(id)).filter((item): item is AdminMerchandisingProductRef => Boolean(item)),
        bestSellers: bestSellerIds
          .map((id) => byId.get(id))
          .filter((item): item is AdminMerchandisingProductRef => Boolean(item)),
        flagship: flagshipId ? byId.get(flagshipId) ?? null : null,
        newArrivals: arrivalRefs,
      },
    };
  } catch {
    return { status: "error" };
  }
}

export async function saveAdminMerchandising(input: {
  payload: AdminMerchandisingSaveInput;
  role: AdminV1Role;
}): Promise<AdminMerchandisingMutationResult> {
  if (!canAccessMerchandising(input.role)) {
    return { status: "forbidden" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const published = await publishedProductIds([
      ...input.payload.featuredIds,
      ...input.payload.bestSellerIds,
      ...(input.payload.flagshipId ? [input.payload.flagshipId] : []),
    ]);
    if (published.status !== "ok") {
      return published;
    }
    const allowed = published.ids;
    const featuredIds = input.payload.featuredIds.filter((id) => allowed.has(id)).slice(0, ADMIN_MERCHANDISING_LIST_MAX);
    const bestSellerIds = input.payload.bestSellerIds
      .filter((id) => allowed.has(id))
      .slice(0, ADMIN_MERCHANDISING_LIST_MAX);
    const flagshipId =
      input.payload.flagshipId && allowed.has(input.payload.flagshipId) ? input.payload.flagshipId : null;
    if (
      featuredIds.length !== input.payload.featuredIds.length ||
      bestSellerIds.length !== input.payload.bestSellerIds.length ||
      Boolean(input.payload.flagshipId) !== Boolean(flagshipId)
    ) {
      return { status: "invalid", message: "Only published products can be merchandised." };
    }

    const supabase = await createSupabaseServerClient();
    const config = await supabase.from("homepage_merchandising").upsert({
      id: HOMEPAGE_MERCHANDISING_ID,
      featured_enabled: input.payload.featuredEnabled,
      best_sellers_enabled: input.payload.bestSellersEnabled,
      flagship_product_id: flagshipId,
      updated_at: new Date().toISOString(),
    });
    if (config.error) {
      return { status: "error" };
    }
    const featuredClear = await supabase.from("homepage_featured_products").delete().gte("sort_order", 0);
    const bestClear = await supabase.from("homepage_best_seller_products").delete().gte("sort_order", 0);
    if (featuredClear.error || bestClear.error) {
      return { status: "error" };
    }
    if (featuredIds.length > 0) {
      const inserted = await supabase.from("homepage_featured_products").insert(
        featuredIds.map((productId, sortOrder) => ({ product_id: productId, sort_order: sortOrder })),
      );
      if (inserted.error) {
        return { status: "error" };
      }
    }
    if (bestSellerIds.length > 0) {
      const inserted = await supabase.from("homepage_best_seller_products").insert(
        bestSellerIds.map((productId, sortOrder) => ({ product_id: productId, sort_order: sortOrder })),
      );
      if (inserted.error) {
        return { status: "error" };
      }
    }
    return { status: "ok" };
  } catch {
    return { status: "error" };
  }
}

export async function searchPublishedProductsForMerchandising(input: {
  q: string;
  excludeIds: string[];
  role: AdminV1Role;
}): Promise<{ status: "ok"; products: AdminMerchandisingProductRef[] } | { status: "error" } | { status: "forbidden" }> {
  if (!canAccessMerchandising(input.role)) {
    return { status: "forbidden" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  const q = parseMerchandisingSearch(input.q);
  try {
    const supabase = await createSupabaseServerClient();
    let request = supabase
      .from("products")
      .select("id, slug, name, brand, status")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(ADMIN_MERCHANDISING_SEARCH_LIMIT);
    if (q) {
      const pattern = `%${q}%`;
      const skuMatch = await supabase
        .from("product_variants")
        .select("product_id")
        .ilike("sku", pattern)
        .limit(50);
      const skuIds = [
        ...new Set(
          (Array.isArray(skuMatch.data) ? skuMatch.data : [])
            .map((row) => (row && typeof row.product_id === "string" ? row.product_id : ""))
            .filter(Boolean),
        ),
      ];
      const clauses = [`name.ilike."${pattern}"`, `brand.ilike."${pattern}"`, `slug.ilike."${pattern}"`];
      if (skuIds.length > 0) {
        clauses.push(`id.in.(${skuIds.join(",")})`);
      }
      request = request.or(clauses.join(","));
    }
    const { data, error } = await request;
    if (error) {
      return { status: "error" };
    }
    const ids = (Array.isArray(data) ? data : [])
      .map((row) => (row && typeof row.id === "string" ? row.id : ""))
      .filter((id) => id && !input.excludeIds.includes(id));
    return { status: "ok", products: await loadProductRefs(ids) };
  } catch {
    return { status: "error" };
  }
}

async function publishedProductIds(
  ids: string[],
): Promise<{ status: "ok"; ids: Set<string> } | { status: "error" } | { status: "invalid"; message: string }> {
  const unique = [...new Set(ids.filter((id) => isUuid(id)))];
  if (unique.length === 0) {
    return { status: "ok", ids: new Set() };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("products").select("id, status").in("id", unique).eq("status", "published");
  if (error) {
    return { status: "error" };
  }
  return {
    status: "ok",
    ids: new Set(
      (Array.isArray(data) ? data : [])
        .map((row) => (row && typeof row.id === "string" ? row.id : ""))
        .filter(Boolean),
    ),
  };
}

async function loadProductRefs(ids: string[]): Promise<AdminMerchandisingProductRef[]> {
  const unique = [...new Set(ids.filter((id) => isUuid(id)))];
  if (unique.length === 0) {
    return [];
  }
  const supabase = await createSupabaseServerClient();
  const [products, images] = await Promise.all([
    supabase.from("products").select("id, slug, name, brand, status").in("id", unique).eq("status", "published"),
    supabase
      .from("product_images")
      .select("product_id, storage_path, alt_text, sort_order, is_primary, width, height")
      .in("product_id", unique)
      .order("sort_order"),
  ]);
  const byId = new Map<string, AdminMerchandisingProductRef>();
  for (const row of Array.isArray(products.data) ? products.data : []) {
    if (!row || typeof row.id !== "string" || typeof row.name !== "string" || typeof row.slug !== "string") {
      continue;
    }
    byId.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      brand: typeof row.brand === "string" ? row.brand : null,
      imageSrc: null,
      imageAlt: row.name,
      imageWidth: null,
      imageHeight: null,
    });
  }
  for (const row of Array.isArray(images.data) ? images.data : []) {
    if (!row || typeof row.product_id !== "string") {
      continue;
    }
    const current = byId.get(row.product_id);
    if (!current || current.imageSrc) {
      continue;
    }
    if (typeof row.storage_path !== "string") {
      continue;
    }
    current.imageSrc = cataloguePublicImageUrl(row.storage_path) ?? null;
    current.imageAlt = typeof row.alt_text === "string" && row.alt_text ? row.alt_text : current.name;
    current.imageWidth = typeof row.width === "number" ? row.width : null;
    current.imageHeight = typeof row.height === "number" ? row.height : null;
  }
  return unique.map((id) => byId.get(id)).filter((item): item is AdminMerchandisingProductRef => Boolean(item));
}

function idsFromOrder(data: unknown): string[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((row) => (row && typeof row === "object" && typeof (row as { product_id?: unknown }).product_id === "string"
      ? (row as { product_id: string }).product_id
      : ""))
    .filter(Boolean);
}
