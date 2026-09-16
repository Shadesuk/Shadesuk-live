import "server-only";

import {
  ADMIN_PRODUCTS_PAGE_SIZE,
  availabilityFromVariants,
  encodeTaxonomy,
  nextUniqueProductSlug,
  parseAdminFit,
  parseProductGenders,
  parseProductShapes,
  adminProductSlugFromName,
  isProductSlug,
  type AdminProductCollectionOption,
  type AdminProductDetailView,
  type AdminProductImageView,
  type AdminProductListItem,
  type AdminProductListQuery,
  type AdminProductPlacementView,
  type AdminProductSaveInput,
  type AdminProductVariantInput,
  type AdminProductVariantView,
} from "@/contracts/admin/products";
import { newArrivalDaysRemaining, isNewArrivalFromPublishedAt } from "@/contracts/catalogue/merchandising";
import { pickCardPriceVariant } from "@/contracts/catalogue/map-product";
import { cataloguePublicImageUrl } from "@/contracts/catalogue/image";
import {
  canArchiveProduct,
  canDeleteProduct,
  canPublishProduct,
  canUnpublishProduct,
  type AdminV1Role,
} from "@/contracts/admin/roles";
import type { CatalogueStatus, ProductImageType, VariantStatus } from "@/contracts/catalogue/schema";
import { isUuid } from "@/lib/ids";
import { processAdminProductImage } from "@/lib/admin-product-image";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PRODUCT_IMAGES_BUCKET } from "@/contracts/catalogue/image";

const PRODUCT_LIST_COLUMNS =
  "id, slug, name, brand, status, updated_at, created_at";
const PRODUCT_DETAIL_COLUMNS =
  "id, slug, name, brand, description, materials, whats_included, shape, gender, fit, disclosure, status, published_at, created_at, updated_at";
const VARIANT_COLUMNS =
  "id, product_id, sku, colour_name, size_name, price_minor, compare_at_price_minor, currency, lens_width_mm, bridge_width_mm, temple_length_mm, stock_quantity, status, created_at, updated_at";
const IMAGE_COLUMNS =
  "id, product_id, variant_id, storage_path, alt_text, sort_order, image_type, is_primary, width, height, created_at, updated_at";

export type AdminProductsLoadResult<T> =
  | { status: "ok"; data: T }
  | { status: "error" }
  | { status: "not_found" };

export type AdminProductListResult = {
  products: AdminProductListItem[];
  total: number;
  page: number;
  pageCount: number;
  brands: string[];
};

export type AdminProductMutationResult =
  | { status: "ok"; productId: string }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "error"; message?: string }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "stale" };

export async function loadAdminProductList(
  query: AdminProductListQuery,
): Promise<AdminProductsLoadResult<AdminProductListResult>> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const brandsResult = await supabase
      .from("products")
      .select("brand")
      .not("brand", "is", null)
      .order("brand")
      .limit(200);
    const brands = uniqueBrands(brandsResult.data);

    const from = (query.page - 1) * ADMIN_PRODUCTS_PAGE_SIZE;
    const to = from + ADMIN_PRODUCTS_PAGE_SIZE - 1;
    let request = supabase
      .from("products")
      .select(PRODUCT_LIST_COLUMNS, { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(from, to);
    if (query.status) {
      request = request.eq("status", query.status);
    }
    if (query.brand) {
      request = request.eq("brand", query.brand);
    }
    if (query.q) {
      const pattern = `%${query.q}%`;
      const skuMatch = await supabase
        .from("product_variants")
        .select("product_id")
        .ilike("sku", pattern)
        .limit(200);
      const skuIds = [
        ...new Set(
          (Array.isArray(skuMatch.data) ? skuMatch.data : [])
            .map((row) => (row && typeof row.product_id === "string" ? row.product_id : ""))
            .filter(Boolean),
        ),
      ];
      const clauses = [
        `name.ilike."${pattern}"`,
        `brand.ilike."${pattern}"`,
        `slug.ilike."${pattern}"`,
      ];
      if (skuIds.length > 0) {
        clauses.push(`id.in.(${skuIds.join(",")})`);
      }
      request = request.or(clauses.join(","));
    }
    if (query.availability !== "all") {
      const availabilityIds = await productIdsForAvailability(query.availability);
      if (availabilityIds.length === 0) {
        return {
          status: "ok",
          data: { products: [], total: 0, page: query.page, pageCount: 1, brands },
        };
      }
      request = request.in("id", availabilityIds);
    }
    const { data, error, count } = await request;
    if (error) {
      return { status: "error" };
    }
    const rows = Array.isArray(data) ? data : [];
    const ids = rows.map((row) => (row && typeof row.id === "string" ? row.id : "")).filter(Boolean);
    const [variants, images] = ids.length
      ? await Promise.all([
          supabase.from("product_variants").select(VARIANT_COLUMNS).in("product_id", ids),
          supabase
            .from("product_images")
            .select(IMAGE_COLUMNS)
            .in("product_id", ids)
            .order("sort_order"),
        ])
      : [{ data: [] }, { data: [] }];

    const variantsByProduct = groupBy(
      Array.isArray(variants.data) ? variants.data : [],
      (row) => (row && typeof row.product_id === "string" ? row.product_id : ""),
    );
    const imagesByProduct = groupBy(
      Array.isArray(images.data) ? images.data : [],
      (row) => (row && typeof row.product_id === "string" ? row.product_id : ""),
    );

    const products: AdminProductListItem[] = [];
    for (const row of rows) {
      const parsed = parseListProduct(row, variantsByProduct.get(row.id) ?? [], imagesByProduct.get(row.id) ?? []);
      if (parsed) {
        products.push(parsed);
      }
    }
    const total = typeof count === "number" ? count : 0;
    return {
      status: "ok",
      data: {
        products,
        total,
        page: query.page,
        pageCount: Math.max(1, Math.ceil(total / ADMIN_PRODUCTS_PAGE_SIZE)),
        brands,
      },
    };
  } catch {
    return { status: "error" };
  }
}

export async function loadAdminNewProduct(): Promise<
  AdminProductsLoadResult<Pick<AdminProductDetailView, "collections">>
> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const collections = await supabase.from("collections").select("id, slug, name, status").order("name");
    const options: AdminProductCollectionOption[] = [];
    for (const row of Array.isArray(collections.data) ? collections.data : []) {
      if (
        row &&
        typeof row.id === "string" &&
        typeof row.slug === "string" &&
        typeof row.name === "string"
      ) {
        options.push({ id: row.id, slug: row.slug, name: row.name });
      }
    }
    return { status: "ok", data: { collections: options } };
  } catch {
    return { status: "error" };
  }
}

export async function loadAdminProductDetail(
  id: string,
): Promise<AdminProductsLoadResult<AdminProductDetailView>> {
  if (!isUuid(id)) {
    return { status: "not_found" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const productResult = await supabase
      .from("products")
      .select(PRODUCT_DETAIL_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (productResult.error) {
      return { status: "error" };
    }
    if (!productResult.data) {
      return { status: "not_found" };
    }
    const [variants, images, links, collections] = await Promise.all([
      supabase.from("product_variants").select(VARIANT_COLUMNS).eq("product_id", id).order("created_at"),
      supabase.from("product_images").select(IMAGE_COLUMNS).eq("product_id", id).order("sort_order"),
      supabase.from("product_collections").select("collection_id").eq("product_id", id),
      supabase.from("collections").select("id, slug, name, status").order("name"),
    ]);
    if (variants.error || images.error) {
      return { status: "error" };
    }
    const collectionOptions: AdminProductCollectionOption[] = [];
    for (const row of Array.isArray(collections.data) ? collections.data : []) {
      if (
        row &&
        typeof row.id === "string" &&
        typeof row.slug === "string" &&
        typeof row.name === "string"
      ) {
        collectionOptions.push({ id: row.id, slug: row.slug, name: row.name });
      }
    }
    const collectionIds = (Array.isArray(links.data) ? links.data : [])
      .map((row) => (row && typeof row.collection_id === "string" ? row.collection_id : ""))
      .filter(Boolean);
    const variantViews: AdminProductVariantView[] = [];
    for (const row of Array.isArray(variants.data) ? variants.data : []) {
      const parsed = parseVariantView(row);
      if (parsed) {
        variantViews.push(parsed);
      }
    }
    const imageViews: AdminProductImageView[] = [];
    for (const row of Array.isArray(images.data) ? images.data : []) {
      const parsed = parseImageView(row);
      if (parsed) {
        imageViews.push(parsed);
      }
    }
    const product = productResult.data as Record<string, unknown>;
    if (typeof product.name !== "string" || typeof product.slug !== "string") {
      return { status: "error" };
    }
    const measurements = sharedVariantMeasurements(variantViews);
    const publishedAt =
      typeof product.published_at === "string" ? product.published_at : null;
    const placement = await loadProductPlacement({
      productId: id,
      status: product.status as CatalogueStatus,
      publishedAt,
      collectionNames: collectionOptions
        .filter((collection) => collectionIds.includes(collection.id))
        .map((collection) => collection.name),
    });
    return {
      status: "ok",
      data: {
        id,
        slug: product.slug,
        name: product.name,
        brand: typeof product.brand === "string" ? product.brand : "",
        description: typeof product.description === "string" ? product.description : "",
        materials: typeof product.materials === "string" ? product.materials : "",
        whatsIncluded: typeof product.whats_included === "string" ? product.whats_included : "",
        genders: parseProductGenders(typeof product.gender === "string" ? product.gender : ""),
        shapes: parseProductShapes(typeof product.shape === "string" ? product.shape : ""),
        fit: parseAdminFit(typeof product.fit === "string" ? product.fit : ""),
        lensWidthMm: measurements.lensWidthMm,
        bridgeWidthMm: measurements.bridgeWidthMm,
        templeLengthMm: measurements.templeLengthMm,
        disclosure: typeof product.disclosure === "string" ? product.disclosure : "",
        status: product.status as CatalogueStatus,
        publishedAt,
        updatedAt: typeof product.updated_at === "string" ? product.updated_at : "",
        variants: variantViews,
        images: imageViews,
        collectionIds,
        collections: collectionOptions,
        placement,
      },
    };
  } catch {
    return { status: "error" };
  }
}

export async function saveAdminProduct(input: {
  payload: AdminProductSaveInput;
  intent: "save" | "publish" | "unpublish";
  role: AdminV1Role;
}): Promise<AdminProductMutationResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  if (input.intent === "publish" && !canPublishProduct(input.role)) {
    return { status: "forbidden" };
  }
  if (input.intent === "unpublish" && !canUnpublishProduct(input.role)) {
    return { status: "forbidden" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const now = new Date().toISOString();
    const nextStatus = nextCatalogueStatus(input.intent);
    const productFields = {
      name: input.payload.name,
      brand: input.payload.brand || null,
      description: input.payload.description || null,
      materials: input.payload.materials || null,
      whats_included: input.payload.whatsIncluded || null,
      gender: encodeTaxonomy(input.payload.genders),
      shape: encodeTaxonomy(input.payload.shapes),
      fit: input.payload.fit || null,
      disclosure: input.payload.disclosure,
      updated_at: now,
    };

    if (!input.payload.id) {
      const slug = await allocateUniqueProductSlug(input.payload.name);
      if (!slug) {
        return {
          status: "invalid",
          errors: {
            name: "Couldn't generate a unique product URL from this name. Change the name and try again.",
          },
        };
      }
      const created = await supabase
        .from("products")
        .insert({
          ...productFields,
          slug,
          status: nextStatus === "published" ? "published" : "draft",
        })
        .select("id")
        .maybeSingle();
      if (created.error || !created.data || typeof created.data.id !== "string") {
        return uniqueOrError(created.error, "slug");
      }
      const productId = created.data.id;
      const variants = await persistVariants(productId, [], input.payload.variants);
      if (variants.status !== "ok") {
        return variants;
      }
      const collections = await persistCollections(productId, input.payload.collectionIds);
      if (collections.status !== "ok") {
        return collections;
      }
      return { status: "ok", productId };
    }

    if (!isUuid(input.payload.id)) {
      return { status: "not_found" };
    }
    const current = await supabase
      .from("products")
      .select("id, status, updated_at, slug, published_at")
      .eq("id", input.payload.id)
      .maybeSingle();
    if (current.error) {
      return { status: "error" };
    }
    if (!current.data) {
      return { status: "not_found" };
    }
    if (
      input.payload.updatedAt &&
      typeof current.data.updated_at === "string" &&
      current.data.updated_at !== input.payload.updatedAt
    ) {
      return { status: "stale" };
    }
    const currentStatus = current.data.status as CatalogueStatus;
    if (currentStatus === "archived" && input.role !== "superadmin") {
      return { status: "forbidden" };
    }
    const status =
      nextStatus ?? (currentStatus === "archived" ? "archived" : currentStatus);
    if (status === "archived" && currentStatus !== "archived" && !canArchiveProduct(input.role)) {
      return { status: "forbidden" };
    }
    const updated = await supabase
      .from("products")
      .update({ ...productFields, status })
      .eq("id", input.payload.id)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) {
      return uniqueOrError(updated.error, "slug");
    }
    const existingVariants = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", input.payload.id);
    const existingIds = (Array.isArray(existingVariants.data) ? existingVariants.data : [])
      .map((row) => (row && typeof row.id === "string" ? row.id : ""))
      .filter(Boolean);
    const variants = await persistVariants(input.payload.id, existingIds, input.payload.variants);
    if (variants.status !== "ok") {
      return variants;
    }
    const collections = await persistCollections(input.payload.id, input.payload.collectionIds);
    if (collections.status !== "ok") {
      return collections;
    }
    const images = await persistImageMetadata(input.payload);
    if (images.status !== "ok") {
      return images;
    }
    return { status: "ok", productId: input.payload.id };
  } catch {
    return { status: "error" };
  }
}

export async function archiveAdminProduct(input: {
  productId: string;
  role: AdminV1Role;
}): Promise<AdminProductMutationResult> {
  if (!canArchiveProduct(input.role) || !isUuid(input.productId)) {
    return { status: "forbidden" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const updated = await supabase
      .from("products")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", input.productId)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) {
      return { status: "error" };
    }
    return { status: "ok", productId: input.productId };
  } catch {
    return { status: "error" };
  }
}

export async function deleteAdminProduct(input: {
  productId: string;
  role: AdminV1Role;
}): Promise<AdminProductMutationResult> {
  if (!canDeleteProduct(input.role) || !isUuid(input.productId)) {
    return { status: "forbidden" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const orders = await supabase
      .from("order_items")
      .select("id")
      .eq("product_id", input.productId)
      .limit(1);
    if (orders.error) {
      return { status: "error" };
    }
    if (Array.isArray(orders.data) && orders.data.length > 0) {
      return {
        status: "invalid",
        errors: {
          status: "This product cannot be deleted because it appears on existing orders.",
        },
      };
    }
    const variantRows = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", input.productId);
    const variantIds = (Array.isArray(variantRows.data) ? variantRows.data : [])
      .map((row) => (row && typeof row.id === "string" ? row.id : ""))
      .filter(Boolean);
    if (variantIds.length > 0) {
      const carts = await supabase
        .from("cart_items")
        .select("id")
        .in("product_variant_id", variantIds)
        .limit(1);
      if (carts.error) {
        return { status: "error" };
      }
      if (Array.isArray(carts.data) && carts.data.length > 0) {
        return {
          status: "invalid",
          errors: {
            status: "This product cannot be deleted because it is in an active cart.",
          },
        };
      }
    }
    const images = await supabase
      .from("product_images")
      .select("id, storage_path")
      .eq("product_id", input.productId);
    const imageDelete = await supabase.from("product_images").delete().eq("product_id", input.productId);
    if (imageDelete.error) {
      return { status: "error" };
    }
    const productDelete = await supabase.from("products").delete().eq("id", input.productId).select("id");
    if (productDelete.error) {
      return {
        status: "invalid",
        errors: {
          status: "This product could not be deleted because related records still exist.",
        },
      };
    }
    const paths = (Array.isArray(images.data) ? images.data : [])
      .map((row) => (row && typeof row.storage_path === "string" ? row.storage_path : ""))
      .filter(Boolean)
      .map((path) => path.replace(new RegExp(`^${PRODUCT_IMAGES_BUCKET}/`), ""));
    if (paths.length > 0) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
    }
    return { status: "ok", productId: input.productId };
  } catch {
    return { status: "error" };
  }
}

export async function uploadAdminProductImage(input: {
  productId: string;
  file: File;
  altText: string;
  variantId: string | null;
}): Promise<AdminProductMutationResult> {
  if (!isUuid(input.productId)) {
    return { status: "not_found" };
  }
  if (input.variantId && !isUuid(input.variantId)) {
    return { status: "invalid", errors: { images: "Choose a valid variant." } };
  }
  const processed = await processAdminProductImage(input.file);
  if (!processed.ok) {
    return { status: "invalid", errors: { images: processed.message } };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const product = await supabase.from("products").select("id").eq("id", input.productId).maybeSingle();
    if (product.error) {
      return { status: "error" };
    }
    if (!product.data) {
      return { status: "not_found" };
    }
    const existing = await supabase
      .from("product_images")
      .select("id, variant_id, image_type, sort_order")
      .eq("product_id", input.productId)
      .order("sort_order");
    const rows = Array.isArray(existing.data) ? existing.data : [];
    const imageId = crypto.randomUUID();
    const objectPath = `${input.productId}/${imageId}.webp`;
    const uploaded = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(objectPath, processed.value.bytes, {
      contentType: processed.value.contentType,
      upsert: false,
    });
    if (uploaded.error) {
      return { status: "error" };
    }
    const hasProductPrimary = rows.some(
      (row) => row && row.image_type === "primary" && row.variant_id == null,
    );
    const imageType: ProductImageType =
      !input.variantId && !hasProductPrimary ? "primary" : "secondary";
    const inserted = await supabase.from("product_images").insert({
      id: imageId,
      product_id: input.productId,
      variant_id: input.variantId,
      storage_path: objectPath,
      alt_text: input.altText || "Product image",
      sort_order: rows.length,
      image_type: imageType,
      width: processed.value.width,
      height: processed.value.height,
    });
    if (inserted.error) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([objectPath]);
      return { status: "error" };
    }
    return { status: "ok", productId: input.productId };
  } catch {
    return { status: "error" };
  }
}

export async function deleteAdminProductImage(input: {
  productId: string;
  imageId: string;
}): Promise<AdminProductMutationResult> {
  if (!isUuid(input.productId) || !isUuid(input.imageId)) {
    return { status: "not_found" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const existing = await supabase
      .from("product_images")
      .select("id, storage_path")
      .eq("id", input.imageId)
      .eq("product_id", input.productId)
      .maybeSingle();
    if (existing.error) {
      return { status: "error" };
    }
    if (!existing.data) {
      return { status: "not_found" };
    }
    const removed = await supabase
      .from("product_images")
      .delete()
      .eq("id", input.imageId)
      .eq("product_id", input.productId);
    if (removed.error) {
      return { status: "error" };
    }
    if (typeof existing.data.storage_path === "string") {
      await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .remove([existing.data.storage_path.replace(new RegExp(`^${PRODUCT_IMAGES_BUCKET}/`), "")]);
    }
    return { status: "ok", productId: input.productId };
  } catch {
    return { status: "error" };
  }
}

export async function moveAdminProductImage(input: {
  productId: string;
  imageId: string;
  direction: "up" | "down";
}): Promise<AdminProductMutationResult> {
  if (!isUuid(input.productId) || !isUuid(input.imageId)) {
    return { status: "not_found" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const existing = await supabase
      .from("product_images")
      .select("id, sort_order, variant_id, image_type")
      .eq("product_id", input.productId)
      .order("sort_order");
    if (existing.error || !Array.isArray(existing.data)) {
      return { status: "error" };
    }
    const ids = existing.data
      .map((row) => (row && typeof row.id === "string" ? row.id : ""))
      .filter(Boolean);
    const index = ids.indexOf(input.imageId);
    const swapWith = input.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= ids.length) {
      return { status: "ok", productId: input.productId };
    }
    const current = ids[index];
    const other = ids[swapWith];
    if (!current || !other) {
      return { status: "ok", productId: input.productId };
    }
    ids[index] = other;
    ids[swapWith] = current;
    return applyProductImageOrder(input.productId, ids, existing.data);
  } catch {
    return { status: "error" };
  }
}

async function persistVariants(
  productId: string,
  existingIds: string[],
  variants: AdminProductVariantInput[],
): Promise<AdminProductMutationResult> {
  const supabase = await createSupabaseServerClient();
  const keep = new Set(variants.map((variant) => variant.id).filter((id): id is string => Boolean(id)));
  const remove = existingIds.filter((id) => !keep.has(id));
  if (remove.length > 0) {
    const detached = await supabase
      .from("product_images")
      .update({ variant_id: null })
      .eq("product_id", productId)
      .in("variant_id", remove);
    if (detached.error) {
      return { status: "error" };
    }
    const deleted = await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", productId)
      .in("id", remove);
    if (deleted.error) {
      return {
        status: "invalid",
        errors: {
          variants: "A variant could not be removed because it is referenced by existing records.",
        },
      };
    }
  }
  for (const variant of variants) {
    const payload = {
      product_id: productId,
      sku: variant.sku,
      colour_name: variant.colourName,
      size_name: variant.sizeName,
      price_minor: variant.priceMinor,
      compare_at_price_minor: variant.compareAtMinor,
      currency: "GBP" as const,
      stock_quantity: variant.stockQuantity,
      status: variant.status,
      lens_width_mm: variant.lensWidthMm,
      bridge_width_mm: variant.bridgeWidthMm,
      temple_length_mm: variant.templeLengthMm,
      updated_at: new Date().toISOString(),
    };
    if (variant.id && existingIds.includes(variant.id)) {
      const updated = await supabase
        .from("product_variants")
        .update(payload)
        .eq("id", variant.id)
        .eq("product_id", productId);
      if (updated.error) {
        return uniqueOrError(updated.error, "sku");
      }
    } else {
      const inserted = await supabase.from("product_variants").insert(payload);
      if (inserted.error) {
        return uniqueOrError(inserted.error, "sku");
      }
    }
  }
  return { status: "ok", productId };
}

async function persistCollections(
  productId: string,
  collectionIds: string[],
): Promise<AdminProductMutationResult> {
  const supabase = await createSupabaseServerClient();
  const removed = await supabase.from("product_collections").delete().eq("product_id", productId);
  if (removed.error) {
    return { status: "error" };
  }
  if (collectionIds.length === 0) {
    return { status: "ok", productId };
  }
  const inserted = await supabase.from("product_collections").insert(
    collectionIds.map((collectionId) => ({
      product_id: productId,
      collection_id: collectionId,
    })),
  );
  if (inserted.error) {
    return { status: "error" };
  }
  return { status: "ok", productId };
}

async function persistImageMetadata(payload: AdminProductSaveInput): Promise<AdminProductMutationResult> {
  if (!payload.id || payload.imageOrder.length === 0) {
    return { status: "ok", productId: payload.id ?? "" };
  }
  const supabase = await createSupabaseServerClient();
  const existing = await supabase
    .from("product_images")
    .select("id, variant_id, image_type, alt_text")
    .eq("product_id", payload.id)
    .order("sort_order");
  if (existing.error) {
    return { status: "error" };
  }
  const rows = Array.isArray(existing.data) ? existing.data : [];
  const order = payload.imageOrder.filter((id) => rows.some((row) => row && row.id === id));
  for (const row of rows) {
    if (row && typeof row.id === "string" && !order.includes(row.id)) {
      order.push(row.id);
    }
  }
  const demoted = await supabase
    .from("product_images")
    .update({ image_type: "secondary", updated_at: new Date().toISOString() })
    .eq("product_id", payload.id)
    .eq("image_type", "primary");
  if (demoted.error) {
    return { status: "error" };
  }
  const nextRows: Array<{ id: string; variant_id: string | null }> = [];
  for (const id of order) {
    const row = rows.find((item) => item && item.id === id);
    const submittedAlt = payload.imageAlts[id]?.trim();
    const existingAlt = row && typeof row.alt_text === "string" ? row.alt_text : "";
    const variantId = (
      Object.prototype.hasOwnProperty.call(payload.imageVariantIds, id)
        ? payload.imageVariantIds[id]
        : row && typeof row.variant_id === "string"
          ? row.variant_id
          : null
    ) ?? null;
    const updated = await supabase
      .from("product_images")
      .update({
        alt_text: submittedAlt || existingAlt || "Product image",
        variant_id: variantId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("product_id", payload.id);
    if (updated.error) {
      return { status: "error" };
    }
    nextRows.push({ id, variant_id: variantId });
  }
  return applyProductImageOrder(payload.id, order, nextRows);
}

async function applyProductImageOrder(
  productId: string,
  orderedIds: string[],
  existingRows: unknown[],
): Promise<AdminProductMutationResult> {
  const supabase = await createSupabaseServerClient();
  const rows = existingRows.filter(
    (row): row is { id: string; variant_id: string | null } =>
      Boolean(row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string"),
  );
  const firstUnassociated = orderedIds.find((id) => {
    const row = rows.find((item) => item.id === id);
    return Boolean(row && !row.variant_id);
  });
  const demoted = await supabase
    .from("product_images")
    .update({ image_type: "secondary", updated_at: new Date().toISOString() })
    .eq("product_id", productId)
    .eq("image_type", "primary");
  if (demoted.error) {
    return { status: "error" };
  }
  for (let sort = 0; sort < orderedIds.length; sort += 1) {
    const id = orderedIds[sort];
    if (!id) {
      continue;
    }
    const updated = await supabase
      .from("product_images")
      .update({
        sort_order: sort,
        image_type: id === firstUnassociated ? "primary" : "secondary",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("product_id", productId);
    if (updated.error) {
      return { status: "error" };
    }
  }
  return { status: "ok", productId };
}

function nextCatalogueStatus(
  intent: "save" | "publish" | "unpublish",
): CatalogueStatus | null {
  if (intent === "publish") {
    return "published";
  }
  if (intent === "unpublish") {
    return "draft";
  }
  return null;
}

async function allocateUniqueProductSlug(name: string): Promise<string | null> {
  const base = adminProductSlugFromName(name);
  if (!base || !isProductSlug(base)) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug")
    .or(`slug.eq."${base}",slug.like."${base}-%"`)
    .limit(200);
  if (error) {
    return null;
  }
  const taken = new Set(
    (Array.isArray(data) ? data : [])
      .map((row) => (row && typeof row.slug === "string" ? row.slug : ""))
      .filter(Boolean),
  );
  return nextUniqueProductSlug(base, taken);
}

async function loadProductPlacement(input: {
  productId: string;
  status: CatalogueStatus;
  publishedAt: string | null;
  collectionNames: string[];
}): Promise<AdminProductPlacementView> {
  const supabase = await createSupabaseServerClient();
  const [featured, bestSeller, config] = await Promise.all([
    supabase
      .from("homepage_featured_products")
      .select("product_id")
      .eq("product_id", input.productId)
      .maybeSingle(),
    supabase
      .from("homepage_best_seller_products")
      .select("product_id")
      .eq("product_id", input.productId)
      .maybeSingle(),
    supabase
      .from("homepage_merchandising")
      .select("flagship_product_id")
      .eq("id", "homepage")
      .maybeSingle(),
  ]);
  const flagshipId =
    config.data && typeof config.data.flagship_product_id === "string"
      ? config.data.flagship_product_id
      : null;
  return {
    status: input.status,
    collectionNames: input.collectionNames,
    featured: Boolean(featured.data),
    bestSeller: Boolean(bestSeller.data),
    flagship: flagshipId === input.productId,
    newArrival:
      input.status === "published" && isNewArrivalFromPublishedAt(input.publishedAt),
    newArrivalDaysRemaining:
      input.status === "published" ? newArrivalDaysRemaining(input.publishedAt) : null,
    publishedAt: input.publishedAt,
  };
}

function sharedVariantMeasurements(variants: AdminProductVariantView[]): {
  lensWidthMm: number | null;
  bridgeWidthMm: number | null;
  templeLengthMm: number | null;
} {
  const source = variants.find(
    (variant) =>
      variant.lensWidthMm != null ||
      variant.bridgeWidthMm != null ||
      variant.templeLengthMm != null,
  );
  if (!source) {
    return { lensWidthMm: null, bridgeWidthMm: null, templeLengthMm: null };
  }
  return {
    lensWidthMm: source.lensWidthMm,
    bridgeWidthMm: source.bridgeWidthMm,
    templeLengthMm: source.templeLengthMm,
  };
}

function uniqueOrError(
  error: { code?: string; message?: string } | null,
  field: "slug" | "sku",
): AdminProductMutationResult {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (text.includes("23505") || text.includes("duplicate") || text.includes("unique")) {
    return {
      status: "invalid",
      errors: {
        [field]:
          field === "slug"
            ? "Couldn't generate a unique product URL from this name. Change the name and try again."
            : "That SKU is already in use.",
      },
    };
  }
  return { status: "error" };
}

async function productIdsForAvailability(
  filter: "in_stock" | "out_of_stock" | "sold_out",
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select("product_id, status, stock_quantity");
  if (error || !Array.isArray(data)) {
    return [];
  }
  const byProduct = groupBy(data, (row) =>
    row && typeof row.product_id === "string" ? row.product_id : "",
  );
  const ids: string[] = [];
  for (const [productId, variants] of byProduct) {
    if (!productId) {
      continue;
    }
    const availability = availabilityFromVariants(
      variants.map((row) => ({
        status: (row && typeof row.status === "string" ? row.status : "draft") as VariantStatus,
        stock_quantity: row && typeof row.stock_quantity === "number" ? row.stock_quantity : 0,
      })),
    );
    if (availability === filter) {
      ids.push(productId);
    }
  }
  return ids;
}

function parseListProduct(
  product: Record<string, unknown>,
  variants: unknown[],
  images: unknown[],
): AdminProductListItem | null {
  if (typeof product.id !== "string" || typeof product.name !== "string" || typeof product.slug !== "string") {
    return null;
  }
  if (typeof product.status !== "string") {
    return null;
  }
  const variantRows = variants
    .map(parseVariantView)
    .filter((row): row is AdminProductVariantView => Boolean(row));
  const priced = pickCardPriceVariant(
    variantRows.map((variant) => ({
      id: variant.id,
      product_id: product.id as string,
      sku: variant.sku,
      colour_name: variant.colourName,
      size_name: variant.sizeName,
      price_minor: variant.priceMinor,
      compare_at_price_minor: variant.compareAtMinor,
      currency: "GBP" as const,
      lens_width_mm: variant.lensWidthMm,
      bridge_width_mm: variant.bridgeWidthMm,
      temple_length_mm: variant.templeLengthMm,
      stock_quantity: variant.stockQuantity,
      status: variant.status,
      created_at: "",
      updated_at: "",
    })),
  );
  const imageViews = images
    .map(parseImageView)
    .filter((row): row is AdminProductImageView => Boolean(row))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const primary = imageViews.find((image) => image.isPrimary) ?? imageViews[0] ?? null;
  const availability = availabilityFromVariants(
    variantRows.map((variant) => ({
      status: variant.status,
      stock_quantity: variant.stockQuantity,
    })),
  );
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: typeof product.brand === "string" ? product.brand : null,
    status: product.status as CatalogueStatus,
    priceMinor: priced?.price_minor ?? null,
    compareAtMinor: priced?.compare_at_price_minor ?? null,
    availability,
    variantCount: variantRows.length,
    stockQuantity: variantRows.reduce((sum, variant) => sum + variant.stockQuantity, 0),
    imageSrc: primary?.src ?? null,
    imageAlt: primary?.altText ?? product.name,
    imageWidth: primary?.width ?? null,
    imageHeight: primary?.height ?? null,
  };
}

function parseVariantView(value: unknown): AdminProductVariantView | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.sku !== "string" || typeof row.colour_name !== "string") {
    return null;
  }
  if (typeof row.price_minor !== "number" || typeof row.stock_quantity !== "number") {
    return null;
  }
  if (typeof row.status !== "string") {
    return null;
  }
  return {
    id: row.id,
    sku: row.sku,
    colourName: row.colour_name,
    sizeName: typeof row.size_name === "string" ? row.size_name : null,
    priceMinor: row.price_minor,
    compareAtMinor: typeof row.compare_at_price_minor === "number" ? row.compare_at_price_minor : null,
    stockQuantity: row.stock_quantity,
    status: row.status as VariantStatus,
    lensWidthMm: typeof row.lens_width_mm === "number" ? row.lens_width_mm : null,
    bridgeWidthMm: typeof row.bridge_width_mm === "number" ? row.bridge_width_mm : null,
    templeLengthMm: typeof row.temple_length_mm === "number" ? row.temple_length_mm : null,
  };
}

function parseImageView(value: unknown): AdminProductImageView | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.storage_path !== "string") {
    return null;
  }
  if (typeof row.alt_text !== "string" || typeof row.sort_order !== "number") {
    return null;
  }
  if (typeof row.image_type !== "string") {
    return null;
  }
  return {
    id: row.id,
    storagePath: row.storage_path,
    src: cataloguePublicImageUrl(row.storage_path) ?? null,
    altText: row.alt_text,
    sortOrder: row.sort_order,
    imageType: row.image_type as ProductImageType,
    isPrimary: Boolean(row.is_primary) || row.image_type === "primary",
    variantId: typeof row.variant_id === "string" ? row.variant_id : null,
    width: typeof row.width === "number" ? row.width : null,
    height: typeof row.height === "number" ? row.height : null,
  };
}

function uniqueBrands(data: unknown): string[] {
  const brands: string[] = [];
  const seen = new Set<string>();
  for (const row of Array.isArray(data) ? data : []) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const brand = (row as { brand?: unknown }).brand;
    if (typeof brand !== "string" || !brand.trim()) {
      continue;
    }
    const key = brand.trim();
    if (seen.has(key.toLowerCase())) {
      continue;
    }
    seen.add(key.toLowerCase());
    brands.push(key);
  }
  return brands.sort((a, b) => a.localeCompare(b, "en-GB"));
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    const current = grouped.get(id);
    if (current) {
      current.push(item);
    } else {
      grouped.set(id, [item]);
    }
  }
  return grouped;
}
