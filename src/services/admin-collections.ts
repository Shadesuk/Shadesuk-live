import "server-only";

import {
  ADMIN_COLLECTION_PRODUCT_SEARCH_LIMIT,
  ADMIN_COLLECTIONS_PAGE_SIZE,
  adminCollectionSlugFromName,
  collectionStatusFromVisibility,
  isCollectionSlug,
  isReservedCollectionSlug,
  nextUniqueCollectionSlug,
  statusesForVisibilityFilter,
  type AdminCollectionDetailView,
  type AdminCollectionListItem,
  type AdminCollectionListQuery,
  type AdminCollectionProductRef,
  type AdminCollectionSaveInput,
} from "@/contracts/admin/collections";
import {
  canArchiveCollection,
  canDeleteCollection,
  canManageCollections,
  type AdminV1Role,
} from "@/contracts/admin/roles";
import { cataloguePublicImageUrl, PRODUCT_IMAGES_BUCKET } from "@/contracts/catalogue/image";
import type { CatalogueStatus } from "@/contracts/catalogue/schema";
import { sanitizeAdminProductSearch } from "@/contracts/admin/products";
import { isUuid } from "@/lib/ids";
import { processAdminProductImage } from "@/lib/admin-product-image";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const COLLECTION_COLUMNS =
  "id, slug, name, description, image_path, status, sort_order, created_at, updated_at";

export type AdminCollectionsLoadResult<T> =
  | { status: "ok"; data: T }
  | { status: "error" }
  | { status: "not_found" };

export type AdminCollectionListResult = {
  collections: AdminCollectionListItem[];
  total: number;
  page: number;
  pageCount: number;
};

export type AdminCollectionMutationResult =
  | { status: "ok"; collectionId: string }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "error"; message?: string }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "stale" };

export async function loadAdminCollectionList(
  query: AdminCollectionListQuery,
): Promise<AdminCollectionsLoadResult<AdminCollectionListResult>> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const from = (query.page - 1) * ADMIN_COLLECTIONS_PAGE_SIZE;
    const to = from + ADMIN_COLLECTIONS_PAGE_SIZE - 1;
    let request = supabase
      .from("collections")
      .select(COLLECTION_COLUMNS, { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(from, to);
    const statuses = statusesForVisibilityFilter(query.visibility);
    if (statuses) {
      request = request.in("status", statuses);
    }
    if (query.q) {
      const pattern = `%${query.q}%`;
      request = request.or(`name.ilike."${pattern}",slug.ilike."${pattern}"`);
    }
    const { data, error, count } = await request;
    if (error) {
      return { status: "error" };
    }
    const rows = Array.isArray(data) ? data : [];
    const ids = rows
      .map((row) => (row && typeof row.id === "string" ? row.id : ""))
      .filter(Boolean);
    const counts = await productCountsByCollection(ids);
    const collections: AdminCollectionListItem[] = [];
    for (const row of rows) {
      const parsed = parseListCollection(row, counts.get(String(row.id)) ?? 0);
      if (parsed) {
        collections.push(parsed);
      }
    }
    const total = typeof count === "number" ? count : 0;
    return {
      status: "ok",
      data: {
        collections,
        total,
        page: query.page,
        pageCount: Math.max(1, Math.ceil(total / ADMIN_COLLECTIONS_PAGE_SIZE)),
      },
    };
  } catch {
    return { status: "error" };
  }
}

export async function loadAdminCollectionDetail(
  id: string,
): Promise<AdminCollectionsLoadResult<AdminCollectionDetailView>> {
  if (!isUuid(id)) {
    return { status: "not_found" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase.from("collections").select(COLLECTION_COLUMNS).eq("id", id).maybeSingle();
    if (result.error) {
      return { status: "error" };
    }
    if (!result.data) {
      return { status: "not_found" };
    }
    const links = await supabase.from("product_collections").select("product_id").eq("collection_id", id);
    if (links.error) {
      return { status: "error" };
    }
    const productIds = (Array.isArray(links.data) ? links.data : [])
      .map((row) => (row && typeof row.product_id === "string" ? row.product_id : ""))
      .filter(Boolean);
    const products = await loadAssignableProductRefs(productIds);
    const parsed = parseDetailCollection(result.data, products);
    if (!parsed) {
      return { status: "error" };
    }
    return { status: "ok", data: parsed };
  } catch {
    return { status: "error" };
  }
}

export async function saveAdminCollection(input: {
  payload: AdminCollectionSaveInput;
  role: AdminV1Role;
}): Promise<AdminCollectionMutationResult> {
  if (!canManageCollections(input.role)) {
    return { status: "forbidden" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const existing = input.payload.id
      ? await supabase
          .from("collections")
          .select("id, slug, status, updated_at")
          .eq("id", input.payload.id)
          .maybeSingle()
      : { data: null, error: null };
    if (existing.error) {
      return { status: "error" };
    }
    if (input.payload.id && !existing.data) {
      return { status: "not_found" };
    }
    if (
      input.payload.id &&
      input.payload.updatedAt &&
      existing.data &&
      typeof existing.data.updated_at === "string" &&
      existing.data.updated_at !== input.payload.updatedAt
    ) {
      return { status: "stale" };
    }

    const slug = await resolveCollectionSlug({
      requested: input.payload.slug || adminCollectionSlugFromName(input.payload.name),
      persisted: typeof existing.data?.slug === "string" ? existing.data.slug : null,
    });
    if (!slug) {
      return { status: "invalid", errors: { slug: "That URL is already in use." } };
    }

    const nextStatus = collectionStatusFromVisibility(input.payload.visibility);
    const existingStatus =
      existing.data && typeof existing.data.status === "string" ? existing.data.status : null;
    const status: CatalogueStatus =
      existingStatus === "archived" && !canArchiveCollection(input.role)
        ? "archived"
        : nextStatus;

    const assignable = await filterAssignableProductIds(input.payload.productIds);
    if (assignable.status !== "ok") {
      return assignable.status === "error"
        ? { status: "error" }
        : { status: "invalid", errors: { products: "Only catalogue products can be assigned." } };
    }

    const fields = {
      name: input.payload.name,
      slug,
      description: input.payload.description || null,
      status,
      updated_at: new Date().toISOString(),
    };

    let collectionId = input.payload.id;
    if (!collectionId) {
      const inserted = await supabase
        .from("collections")
        .insert(fields)
        .select("id")
        .maybeSingle();
      if (inserted.error || !inserted.data || typeof inserted.data.id !== "string") {
        return uniqueSlugError(inserted.error) ?? { status: "error" };
      }
      collectionId = inserted.data.id;
    } else {
      const updated = await supabase.from("collections").update(fields).eq("id", collectionId).select("id");
      if (updated.error) {
        return uniqueSlugError(updated.error) ?? { status: "error" };
      }
    }

    const replaced = await replaceCollectionProducts(collectionId, assignable.ids);
    if (replaced.status !== "ok") {
      return replaced;
    }
    return { status: "ok", collectionId };
  } catch {
    return { status: "error" };
  }
}

export async function archiveAdminCollection(input: {
  collectionId: string;
  role: AdminV1Role;
}): Promise<AdminCollectionMutationResult> {
  if (!canArchiveCollection(input.role)) {
    return { status: "forbidden" };
  }
  if (!isUuid(input.collectionId)) {
    return { status: "not_found" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const updated = await supabase
      .from("collections")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", input.collectionId)
      .select("id");
    if (updated.error) {
      return { status: "error" };
    }
    if (!Array.isArray(updated.data) || updated.data.length === 0) {
      return { status: "not_found" };
    }
    return { status: "ok", collectionId: input.collectionId };
  } catch {
    return { status: "error" };
  }
}

export async function deleteAdminCollection(input: {
  collectionId: string;
  role: AdminV1Role;
}): Promise<AdminCollectionMutationResult> {
  if (!canDeleteCollection(input.role)) {
    return { status: "forbidden" };
  }
  if (!isUuid(input.collectionId)) {
    return { status: "not_found" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const current = await supabase
      .from("collections")
      .select("id, image_path")
      .eq("id", input.collectionId)
      .maybeSingle();
    if (current.error) {
      return { status: "error" };
    }
    if (!current.data) {
      return { status: "not_found" };
    }
    const removed = await supabase.from("collections").delete().eq("id", input.collectionId).select("id");
    if (removed.error) {
      return { status: "error" };
    }
    const imagePath = typeof current.data.image_path === "string" ? current.data.image_path : "";
    if (imagePath) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([storageObjectPath(imagePath)]);
    }
    return { status: "ok", collectionId: input.collectionId };
  } catch {
    return { status: "error" };
  }
}

export async function uploadAdminCollectionImage(input: {
  collectionId: string;
  file: File;
}): Promise<AdminCollectionMutationResult> {
  if (!isUuid(input.collectionId)) {
    return { status: "not_found" };
  }
  const processed = await processAdminProductImage(input.file);
  if (!processed.ok) {
    return { status: "invalid", errors: { image: processed.message } };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const current = await supabase
      .from("collections")
      .select("id, image_path")
      .eq("id", input.collectionId)
      .maybeSingle();
    if (current.error) {
      return { status: "error" };
    }
    if (!current.data) {
      return { status: "not_found" };
    }
    const objectPath = `collections/${input.collectionId}/hero.webp`;
    const uploaded = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(objectPath, processed.value.bytes, {
      contentType: processed.value.contentType,
      upsert: true,
    });
    if (uploaded.error) {
      return { status: "error" };
    }
    const previous =
      typeof current.data.image_path === "string" ? storageObjectPath(current.data.image_path) : "";
    const updated = await supabase
      .from("collections")
      .update({ image_path: objectPath })
      .eq("id", input.collectionId)
      .select("id");
    if (updated.error) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([objectPath]);
      return { status: "error" };
    }
    if (previous && previous !== objectPath) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([previous]);
    }
    return { status: "ok", collectionId: input.collectionId };
  } catch {
    return { status: "error" };
  }
}

export async function deleteAdminCollectionImage(input: {
  collectionId: string;
}): Promise<AdminCollectionMutationResult> {
  if (!isUuid(input.collectionId)) {
    return { status: "not_found" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const current = await supabase
      .from("collections")
      .select("id, image_path")
      .eq("id", input.collectionId)
      .maybeSingle();
    if (current.error) {
      return { status: "error" };
    }
    if (!current.data) {
      return { status: "not_found" };
    }
    const previous =
      typeof current.data.image_path === "string" ? storageObjectPath(current.data.image_path) : "";
    const updated = await supabase
      .from("collections")
      .update({ image_path: null })
      .eq("id", input.collectionId)
      .select("id");
    if (updated.error) {
      return { status: "error" };
    }
    if (previous) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([previous]);
    }
    return { status: "ok", collectionId: input.collectionId };
  } catch {
    return { status: "error" };
  }
}

export async function searchAssignableCollectionProducts(input: {
  q: string;
  excludeIds: string[];
  role: AdminV1Role;
}): Promise<
  | { status: "ok"; products: AdminCollectionProductRef[] }
  | { status: "error" }
  | { status: "forbidden" }
> {
  if (!canManageCollections(input.role)) {
    return { status: "forbidden" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  const q = sanitizeAdminProductSearch(input.q);
  try {
    const supabase = await createSupabaseServerClient();
    let request = supabase
      .from("products")
      .select("id, slug, name, brand, status")
      .in("status", ["draft", "published"])
      .order("updated_at", { ascending: false })
      .limit(ADMIN_COLLECTION_PRODUCT_SEARCH_LIMIT);
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
    return { status: "ok", products: await loadAssignableProductRefs(ids) };
  } catch {
    return { status: "error" };
  }
}

async function resolveCollectionSlug(input: {
  requested: string;
  persisted: string | null;
}): Promise<string | null> {
  if (input.persisted && isCollectionSlug(input.persisted)) {
    return input.persisted;
  }
  if (!isCollectionSlug(input.requested) || isReservedCollectionSlug(input.requested)) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const existing = await supabase.from("collections").select("slug");
  const taken = new Set(
    (Array.isArray(existing.data) ? existing.data : [])
      .map((row) => (row && typeof row.slug === "string" ? row.slug : ""))
      .filter(Boolean),
  );
  return nextUniqueCollectionSlug(input.requested, taken);
}

async function replaceCollectionProducts(
  collectionId: string,
  productIds: string[],
): Promise<AdminCollectionMutationResult> {
  const supabase = await createSupabaseServerClient();
  const removed = await supabase.from("product_collections").delete().eq("collection_id", collectionId);
  if (removed.error) {
    return { status: "error" };
  }
  if (productIds.length === 0) {
    return { status: "ok", collectionId };
  }
  const inserted = await supabase.from("product_collections").insert(
    productIds.map((productId) => ({
      product_id: productId,
      collection_id: collectionId,
    })),
  );
  if (inserted.error) {
    return { status: "error" };
  }
  return { status: "ok", collectionId };
}

async function filterAssignableProductIds(
  ids: string[],
): Promise<{ status: "ok"; ids: string[] } | { status: "error" } | { status: "invalid" }> {
  const unique = [...new Set(ids.filter((id) => isUuid(id)))];
  if (unique.length === 0) {
    return { status: "ok", ids: [] };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, status")
    .in("id", unique)
    .in("status", ["draft", "published"]);
  if (error) {
    return { status: "error" };
  }
  const allowed = new Set(
    (Array.isArray(data) ? data : [])
      .map((row) => (row && typeof row.id === "string" ? row.id : ""))
      .filter(Boolean),
  );
  return { status: "ok", ids: unique.filter((id) => allowed.has(id)) };
}

async function productCountsByCollection(ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) {
    return counts;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("product_collections")
    .select("collection_id")
    .in("collection_id", ids);
  for (const row of Array.isArray(data) ? data : []) {
    if (!row || typeof row.collection_id !== "string") {
      continue;
    }
    counts.set(row.collection_id, (counts.get(row.collection_id) ?? 0) + 1);
  }
  return counts;
}

async function loadAssignableProductRefs(ids: string[]): Promise<AdminCollectionProductRef[]> {
  const unique = [...new Set(ids.filter((id) => isUuid(id)))];
  if (unique.length === 0) {
    return [];
  }
  const supabase = await createSupabaseServerClient();
  const [products, variants, images] = await Promise.all([
    supabase.from("products").select("id, slug, name, brand, status").in("id", unique),
    supabase.from("product_variants").select("product_id, sku").in("product_id", unique).order("created_at"),
    supabase
      .from("product_images")
      .select("product_id, storage_path, alt_text, sort_order, is_primary, width, height")
      .in("product_id", unique)
      .order("sort_order"),
  ]);
  const byId = new Map<string, AdminCollectionProductRef>();
  for (const row of Array.isArray(products.data) ? products.data : []) {
    if (
      !row ||
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      typeof row.slug !== "string" ||
      (row.status !== "draft" && row.status !== "published" && row.status !== "archived")
    ) {
      continue;
    }
    byId.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      brand: typeof row.brand === "string" ? row.brand : null,
      sku: null,
      status: row.status,
      imageSrc: null,
      imageAlt: row.name,
      imageWidth: null,
      imageHeight: null,
    });
  }
  for (const row of Array.isArray(variants.data) ? variants.data : []) {
    if (!row || typeof row.product_id !== "string" || typeof row.sku !== "string") {
      continue;
    }
    const current = byId.get(row.product_id);
    if (current && !current.sku) {
      current.sku = row.sku;
    }
  }
  for (const row of Array.isArray(images.data) ? images.data : []) {
    if (!row || typeof row.product_id !== "string") {
      continue;
    }
    const current = byId.get(row.product_id);
    if (!current || current.imageSrc || typeof row.storage_path !== "string") {
      continue;
    }
    current.imageSrc = cataloguePublicImageUrl(row.storage_path) ?? null;
    if (typeof row.alt_text === "string" && row.alt_text.trim()) {
      current.imageAlt = row.alt_text;
    }
    current.imageWidth = typeof row.width === "number" ? row.width : null;
    current.imageHeight = typeof row.height === "number" ? row.height : null;
  }
  return unique.map((id) => byId.get(id)).filter((item): item is AdminCollectionProductRef => Boolean(item));
}

function parseListCollection(row: Record<string, unknown>, productCount: number): AdminCollectionListItem | null {
  if (
    typeof row.id !== "string" ||
    typeof row.slug !== "string" ||
    typeof row.name !== "string" ||
    typeof row.updated_at !== "string" ||
    (row.status !== "draft" && row.status !== "published" && row.status !== "archived")
  ) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    productCount,
    updatedAt: row.updated_at,
    imageSrc: typeof row.image_path === "string" ? cataloguePublicImageUrl(row.image_path) ?? null : null,
  };
}

function parseDetailCollection(
  row: Record<string, unknown>,
  products: AdminCollectionProductRef[],
): AdminCollectionDetailView | null {
  if (
    typeof row.id !== "string" ||
    typeof row.slug !== "string" ||
    typeof row.name !== "string" ||
    typeof row.updated_at !== "string" ||
    (row.status !== "draft" && row.status !== "published" && row.status !== "archived")
  ) {
    return null;
  }
  const imagePath = typeof row.image_path === "string" ? row.image_path : null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: typeof row.description === "string" ? row.description : "",
    imagePath,
    imageSrc: imagePath ? cataloguePublicImageUrl(imagePath) ?? null : null,
    status: row.status,
    updatedAt: row.updated_at,
    products,
  };
}

function storageObjectPath(storagePath: string): string {
  return storagePath.replace(/^\/+/, "").replace(new RegExp(`^${PRODUCT_IMAGES_BUCKET}/`), "");
}

function uniqueSlugError(error: { code?: string; message?: string } | null): AdminCollectionMutationResult | null {
  const message = error?.message ?? "";
  if (error?.code === "23505" || message.includes("collections_slug") || message.toLowerCase().includes("duplicate")) {
    return { status: "invalid", errors: { slug: "That URL is already in use." } };
  }
  return null;
}
