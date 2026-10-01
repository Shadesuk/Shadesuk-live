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
  assessPublishReadiness,
  type AdminProductSaveInput,
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
  "id, slug, name, brand, description, materials, whats_included, shape, gender, fit, disclosure, product_code, status, published_at, created_at, updated_at";
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
  | { status: "ok"; productId: string; detail?: AdminProductDetailView }
  | { status: "published"; productId: string; detail?: AdminProductDetailView }
  | {
      status: "invalid";
      errors: Record<string, string>;
      message?: string;
      committed?: boolean;
      detail?: AdminProductDetailView;
      productId?: string;
    }
  | {
      status: "error";
      message?: string;
      committed?: boolean;
      productId?: string;
      detail?: AdminProductDetailView;
    }
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
        productCode: typeof product.product_code === "string" ? product.product_code : "",
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
  role: AdminV1Role;
}): Promise<AdminProductMutationResult> {
  if (!canPublishProduct(input.role)) {
    return { status: "forbidden" };
  }
  return commitAdminProduct(input.payload);
}

export async function publishAdminProduct(input: {
  payload: AdminProductSaveInput;
  role: AdminV1Role;
}): Promise<AdminProductMutationResult> {
  if (!canPublishProduct(input.role)) {
    return { status: "forbidden" };
  }
  const saved = await commitAdminProduct(input.payload);
  if (saved.status !== "ok" || !saved.productId) {
    return saved;
  }
  const loaded = await loadAdminProductDetail(saved.productId);
  if (loaded.status !== "ok") {
    return {
      status: "error",
      committed: true,
      productId: saved.productId,
      message: "The product was saved. Reload the page before publishing.",
    };
  }
  const readiness = assessPublishReadiness({
    name: loaded.data.name,
    slug: loaded.data.slug,
    disclosure: loaded.data.disclosure,
    variants: loaded.data.variants,
    imageCount: loaded.data.images.length,
  });
  if (!readiness.ok) {
    const errors: Record<string, string> = {};
    for (const [key, value] of Object.entries(readiness.errors)) {
      if (value) {
        errors[key] = value;
      }
    }
    return {
      status: "invalid",
      errors,
      committed: true,
      detail: loaded.data,
      productId: saved.productId,
    };
  }
  const published = await callProductRpc("admin_publish_product", {
    p_product_id: saved.productId,
  });
  if (published.status === "invalid") {
    return {
      ...published,
      committed: true,
      detail: loaded.data,
      productId: saved.productId,
    };
  }
  if (published.status === "error") {
    return {
      status: "error",
      committed: true,
      detail: loaded.data,
      productId: saved.productId,
      message: published.message ?? "The product was saved, but publishing did not complete.",
    };
  }
  if (published.status !== "ok") {
    return published;
  }
  return reloadCommitted(saved.productId, "published");
}

export async function unpublishAdminProduct(input: {
  payload: AdminProductSaveInput;
  role: AdminV1Role;
}): Promise<AdminProductMutationResult> {
  if (!canUnpublishProduct(input.role)) {
    return { status: "forbidden" };
  }
  const saved = await commitAdminProduct(input.payload);
  if (saved.status !== "ok" || !saved.productId) {
    return saved;
  }
  const unpublished = await callProductRpc("admin_unpublish_product", {
    p_product_id: saved.productId,
  });
  if (unpublished.status === "invalid" || unpublished.status === "error") {
    return {
      ...unpublished,
      committed: true,
      productId: saved.productId,
      detail: saved.detail,
      message:
        unpublished.status === "error"
          ? unpublished.message ?? "The product was saved, but it could not be unpublished."
          : undefined,
    };
  }
  if (unpublished.status !== "ok") {
    return unpublished;
  }
  return reloadCommitted(saved.productId, "ok");
}

async function commitAdminProduct(payload: AdminProductSaveInput): Promise<AdminProductMutationResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    let allocatedSlug: string | null = null;
    if (!payload.id) {
      allocatedSlug = await allocateUniqueProductSlug(payload.name);
      if (!allocatedSlug) {
        return {
          status: "invalid",
          errors: {
            name: "Couldn't generate a unique product URL from this name. Change the name and try again.",
          },
        };
      }
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_save_product", {
      payload: adminSaveRpcPayload(payload, allocatedSlug),
    });
    if (error) {
      return { status: "error", message: error.message };
    }
    const parsed = readRpcBody(data);
    if (!parsed) {
      return { status: "error" };
    }
    if (parsed.status === "ok" && isUuid(parsed.productId)) {
      return reloadCommitted(parsed.productId, "ok");
    }
    return mutationFromRpc(parsed);
  } catch {
    return { status: "error" };
  }
}

async function reloadCommitted(
  productId: string,
  status: "ok" | "published",
): Promise<AdminProductMutationResult> {
  const loaded = await loadAdminProductDetail(productId);
  if (loaded.status !== "ok") {
    return {
      status: "error",
      committed: true,
      productId,
      message: "The product was saved. Reload the page to see the latest version.",
    };
  }
  return { status, productId, detail: loaded.data };
}

function adminSaveRpcPayload(payload: AdminProductSaveInput, allocatedSlug: string | null) {
  const imageIds = new Set([
    ...Object.keys(payload.imageAlts),
    ...Object.keys(payload.imageVariantIds),
  ]);
  return {
    id: payload.id,
    updatedAt: payload.updatedAt,
    allocatedSlug,
    name: payload.name,
    productCode: payload.productCode,
    brand: payload.brand,
    description: payload.description,
    materials: payload.materials,
    whatsIncluded: payload.whatsIncluded,
    gender: encodeTaxonomy(payload.genders),
    shape: encodeTaxonomy(payload.shapes),
    fit: payload.fit,
    disclosure: payload.disclosure,
    variants: payload.variants.map((variant) => ({
      clientKey: variant.clientKey,
      id: variant.id,
      sku: variant.sku,
      colourName: variant.colourName,
      sizeName: variant.sizeName,
      priceMinor: variant.priceMinor,
      compareAtMinor: variant.compareAtMinor,
      stockQuantity: variant.stockQuantity,
      status: variant.status,
      lensWidthMm: variant.lensWidthMm,
      bridgeWidthMm: variant.bridgeWidthMm,
      templeLengthMm: variant.templeLengthMm,
    })),
    collectionIds: payload.collectionIds,
    imageOrder: payload.imageOrder,
    images: [...imageIds].map((id) => ({
      id,
      altPresent: Object.prototype.hasOwnProperty.call(payload.imageAlts, id),
      alt: payload.imageAlts[id] ?? "",
      variantKeyPresent: Object.prototype.hasOwnProperty.call(payload.imageVariantIds, id),
      variantKey: payload.imageVariantIds[id] ?? "",
    })),
  };
}

async function callProductRpc(
  fn: "admin_publish_product" | "admin_unpublish_product",
  args: { p_product_id: string },
): Promise<AdminProductMutationResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      return { status: "error" };
    }
    const parsed = readRpcBody(data);
    if (!parsed) {
      return { status: "error" };
    }
    if (parsed.status === "ok") {
      return { status: "ok", productId: parsed.productId || args.p_product_id };
    }
    return mutationFromRpc(parsed);
  } catch {
    return { status: "error" };
  }
}

function readRpcBody(data: unknown): {
  status: string;
  productId: string;
  field: string;
  code: string;
  rolledBack: boolean;
  message: string;
  sqlstate: string;
} | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const row = data as Record<string, unknown>;
  return {
    status: typeof row.status === "string" ? row.status : "",
    productId: typeof row.productId === "string" ? row.productId : "",
    field: typeof row.field === "string" ? row.field : "",
    code: typeof row.code === "string" ? row.code : "",
    rolledBack: row.rolledBack === true,
    message: typeof row.message === "string" ? row.message.slice(0, 500) : "",
    sqlstate: typeof row.sqlstate === "string" ? row.sqlstate : "",
  };
}

function mutationFromRpc(parsed: {
  status: string;
  productId: string;
  field: string;
  code: string;
  rolledBack: boolean;
  message: string;
  sqlstate: string;
}): AdminProductMutationResult {
  if (parsed.status === "forbidden") {
    return { status: "forbidden" };
  }
  if (parsed.status === "not_found") {
    return { status: "not_found" };
  }
  if (parsed.status === "stale") {
    return { status: "stale" };
  }
  if (parsed.status === "invalid") {
    const errors = rpcFieldErrors(parsed.code, parsed.field);
    const exact = parsed.message
      ? parsed.sqlstate
        ? `${parsed.message} (${parsed.sqlstate})`
        : parsed.message
      : "";
    return {
      status: "invalid",
      errors,
      message: exact || Object.values(errors)[0],
    };
  }
  return {
    status: "error",
    message: parsed.message
      ? parsed.sqlstate
        ? `${parsed.message} (${parsed.sqlstate})`
        : parsed.message
      : undefined,
  };
}

function rpcFieldErrors(code: string, field: string): Record<string, string> {
  if (code === "sku_taken" || field === "sku") {
    return { sku: "That SKU is already in use." };
  }
  if (code === "sku_options") {
    return { variants: "Each colour and size combination can only exist once." };
  }
  if (code === "slug_taken" || field === "slug") {
    return {
      name: "Couldn't generate a unique product URL from this name. Change the name and try again.",
    };
  }
  if (code === "product_code_invalid") {
    return { productCode: "Enter a product code of up to 12 letters, numbers, and hyphens." };
  }
  if (code === "product_code_taken" || field === "productCode") {
    return { productCode: "That product code is already in use. Choose a different code." };
  }
  if (code === "image_variant" || field === "images") {
    return { images: "An image points at a variant that is not part of this save." };
  }
  if (code === "variant_referenced") {
    return { variants: "A variant could not be removed because it is referenced by existing records." };
  }
  if (code === "publish_variants") {
    return {
      variants: "Publish needs at least one saved variant with a SKU, colour, price, and available status.",
    };
  }
  if (code === "publish_images") {
    return { images: "Publish needs at least one saved image." };
  }
  if (code === "publish_incomplete") {
    return { name: "Publish needs a saved product name, URL, and disclosure." };
  }
  if (code === "variant_invalid" && field === "price") {
    return { price: "Enter a valid price in pounds and pence." };
  }
  return { variants: "The product could not be saved." };
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
      const removed = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([objectPath]);
      if (removed.error) {
        return {
          status: "error",
          message: "The image was uploaded to storage but was not saved on the product.",
        };
      }
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
    const ordered = ids.filter((id) => isUuid(id));
    const { data, error } = await supabase.rpc("admin_reorder_product_images", {
      p_product_id: input.productId,
      p_image_order: ordered,
    });
    if (error) {
      return { status: "error" };
    }
    const parsed = readRpcBody(data);
    if (!parsed || parsed.status !== "ok") {
      return parsed ? mutationFromRpc(parsed) : { status: "error" };
    }
    return { status: "ok", productId: input.productId };
  } catch {
    return { status: "error" };
  }
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
    newArrival: input.status === "published" && isNewArrivalFromPublishedAt(input.publishedAt),
    newArrivalDaysRemaining: input.status === "published" ? newArrivalDaysRemaining(input.publishedAt) : null,
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
      variant.lensWidthMm != null || variant.bridgeWidthMm != null || variant.templeLengthMm != null,
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
