import "server-only";

import {
  mapProductAggregateToStorefront,
  type CatalogueStatus,
  type MapProductOptions,
  type MappedStorefrontProduct,
  type ProductAggregate,
  type ProductImageRow,
  type ProductImageType,
  type ProductRow,
  type ProductVariantRow,
  type VariantStatus,
} from "@/contracts";
import { deriveBrandSource, deriveBrandsFromProducts } from "@/contracts";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { loadStorefrontMerchandisingConfig } from "@/services/storefront-merchandising";
import type { Brand } from "@/types/catalogue";

const PRODUCT_COLUMNS =
  "id, slug, name, brand, description, details, materials, whats_included, shape, gender, fit, disclosure, status, published_at, created_at, updated_at";
const VARIANT_COLUMNS =
  "id, product_id, sku, colour_name, size_name, price_minor, compare_at_price_minor, currency, lens_width_mm, bridge_width_mm, temple_length_mm, stock_quantity, status, created_at, updated_at";
const IMAGE_COLUMNS =
  "id, product_id, variant_id, storage_path, alt_text, sort_order, image_type, is_primary, width, height, created_at, updated_at";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATALOGUE_STATUSES = new Set<CatalogueStatus>([
  "draft",
  "published",
  "archived",
]);
const VARIANT_STATUSES = new Set<VariantStatus>([
  "draft",
  "available",
  "unavailable",
  "archived",
]);
const IMAGE_TYPES = new Set<ProductImageType>([
  "primary",
  "secondary",
  "detail",
  "side",
  "lifestyle",
]);

export type LiveStorefrontProduct = {
  product: MappedStorefrontProduct;
  brandName: string;
};

/**
 * Published catalogue reads through the anon/publishable key and RLS.
 * Never use the service-role client here: unpublished rows must not leak
 * to an unauthenticated storefront request.
 */
export async function fetchLiveProductBySlug(
  slug: string,
  projection: MapProductOptions["projection"],
): Promise<LiveStorefrontProduct | null> {
  const trimmed = slug.trim();
  if (!trimmed || !isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("slug", trimmed)
      .eq("status", "published")
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = parseProductRow(data);
    if (!row || row.status !== "published") {
      return null;
    }

    const mapped = await mapPublishedRow(row, projection);
    return mapped;
  } catch {
    return null;
  }
}

export async function fetchLiveProductsByIds(
  ids: string[],
  projection: MapProductOptions["projection"],
): Promise<MappedStorefrontProduct[]> {
  const unique = [...new Set(ids.filter((id) => UUID_PATTERN.test(id)))];
  if (unique.length === 0 || !isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("status", "published")
      .in("id", unique);

    if (error || !data) {
      return [];
    }

    const rows = data
      .map(parseProductRow)
      .filter((row): row is ProductRow => Boolean(row && row.status === "published"));

    const mapped = await mapPublishedRows(rows, projection);
    const byId = new Map(mapped.map((product) => [product.id, product]));
    return unique
      .map((id) => byId.get(id))
      .filter((product): product is MappedStorefrontProduct => Boolean(product));
  } catch {
    return [];
  }
}

export async function fetchLiveRelatedProducts(
  product: MappedStorefrontProduct,
  limit = 4,
): Promise<MappedStorefrontProduct[]> {
  const shape = product.shape[0];
  if (!shape || !isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("status", "published")
      .neq("slug", product.slug)
      .ilike("shape", `%${shape}%`)
      .limit(12);

    if (error || !data) {
      return [];
    }

    const rows = data
      .map(parseProductRow)
      .filter((row): row is ProductRow => Boolean(row && row.status === "published"));
    const mapped = await mapPublishedRows(rows, "card");
    return mapped
      .filter((item) => item.shape.includes(shape) && item.slug !== product.slug)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export type LivePublishedCatalogue = {
  products: MappedStorefrontProduct[];
  brands: Brand[];
};

export type LiveCatalogueResult =
  | { ok: true; catalogue: LivePublishedCatalogue }
  | { ok: false; reason: "unconfigured" | "error" };

const PUBLISHED_PAGE_SIZE = 100;
const PUBLISHED_MAX_ROWS = 2000;

const SNAPSHOT_TTL_MS = 60_000;
const ERROR_TTL_MS = 5_000;

type SnapshotCacheEntry = {
  expiresAt: number;
  value: LiveCatalogueResult;
};

let snapshotCache: SnapshotCacheEntry | null = null;
let snapshotInflight: Promise<LiveCatalogueResult> | null = null;

/**
 * Published card-projection catalogue for PLP, search, home rails, and
 * brand/collection membership. Anon/publishable key + RLS only.
 *
 * Process-local TTL cache so `/api/search/suggest` (and other readers) do not
 * re-page up to PUBLISHED_MAX_ROWS on every keystroke. Published-only stays.
 */
export async function fetchLivePublishedCatalogue(): Promise<LiveCatalogueResult> {
  const now = Date.now();
  if (snapshotCache && snapshotCache.expiresAt > now) {
    return snapshotCache.value;
  }
  if (snapshotInflight) {
    return snapshotInflight;
  }

  snapshotInflight = loadLivePublishedCatalogue()
    .then((value) => {
      const ttl = value.ok ? SNAPSHOT_TTL_MS : ERROR_TTL_MS;
      snapshotCache = { expiresAt: Date.now() + ttl, value };
      return value;
    })
    .finally(() => {
      snapshotInflight = null;
    });

  return snapshotInflight;
}

export function resetLivePublishedCatalogueCacheForTests(): void {
  snapshotCache = null;
  snapshotInflight = null;
}

async function loadLivePublishedCatalogue(): Promise<LiveCatalogueResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: "unconfigured" };
  }

  try {
    const rows = await fetchAllPublishedProductRows();
    const products = await mapPublishedRows(rows, "card");
    const derived = deriveBrandsFromProducts(rows);
    const brands: Brand[] = derived.map((brand) => ({
      ...brand,
      productCount: products.filter((product) => product.brandId === brand.id).length,
    }));
    return { ok: true, catalogue: { products, brands } };
  } catch {
    return { ok: false, reason: "error" };
  }
}

async function fetchAllPublishedProductRows(): Promise<ProductRow[]> {
  const supabase = createSupabasePublicClient();
  const rows: ProductRow[] = [];
  let from = 0;

  while (from < PUBLISHED_MAX_ROWS) {
    const to = Math.min(from + PUBLISHED_PAGE_SIZE - 1, PUBLISHED_MAX_ROWS - 1);
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const page = (data ?? [])
      .map(parseProductRow)
      .filter((row): row is ProductRow => Boolean(row && row.status === "published"));
    rows.push(...page);

    if (!data || data.length < PUBLISHED_PAGE_SIZE) {
      break;
    }
    from += PUBLISHED_PAGE_SIZE;
  }

  return rows;
}

async function mapPublishedRow(
  row: ProductRow,
  projection: MapProductOptions["projection"],
): Promise<LiveStorefrontProduct | null> {
  const [mapped] = await mapPublishedRows([row], projection);
  if (!mapped) {
    return null;
  }
  return {
    product: mapped,
    brandName: deriveBrandSource(row.brand)?.name ?? "",
  };
}

async function mapPublishedRows(
  rows: ProductRow[],
  projection: MapProductOptions["projection"],
): Promise<MappedStorefrontProduct[]> {
  if (rows.length === 0) {
    return [];
  }

  const productIds = rows.map((row) => row.id);
  const [variants, images, merchandising] = await Promise.all([
    fetchVariants(productIds),
    fetchImages(productIds),
    loadStorefrontMerchandisingConfig(),
  ]);

  const variantsByProduct = groupBy(variants, (variant) => variant.product_id);
  const imagesByProduct = groupBy(images, (image) => image.product_id);
  const bestSellerIds = new Set(
    merchandising.bestSellersEnabled ? merchandising.bestSellerIds : [],
  );

  return rows
    .map((product) => {
      const aggregate: ProductAggregate = {
        product,
        variants: variantsByProduct.get(product.id) ?? [],
        images: imagesByProduct.get(product.id) ?? [],
        collectionSlugs: [],
      };
      return mapProductAggregateToStorefront(aggregate, { projection, bestSellerIds });
    })
    .filter((product): product is MappedStorefrontProduct => Boolean(product));
}

async function fetchVariants(productIds: string[]): Promise<ProductVariantRow[]> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select(VARIANT_COLUMNS)
    .in("product_id", productIds);

  if (error || !data) {
    return [];
  }
  return data
    .map(parseVariantRow)
    .filter((row): row is ProductVariantRow => Boolean(row));
}

async function fetchImages(productIds: string[]): Promise<ProductImageRow[]> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("product_images")
    .select(IMAGE_COLUMNS)
    .in("product_id", productIds);

  if (error || !data) {
    return [];
  }
  return data
    .map(parseImageRow)
    .filter((row): row is ProductImageRow => Boolean(row));
}

function parseProductRow(value: unknown): ProductRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const status = value.status;
  if (typeof status !== "string" || !CATALOGUE_STATUSES.has(status as CatalogueStatus)) {
    return null;
  }
  const id = asString(value.id);
  const slug = asString(value.slug);
  const name = asString(value.name);
  const createdAt = asString(value.created_at);
  const updatedAt = asString(value.updated_at);
  const disclosure = asString(value.disclosure);
  if (!id || !slug || !name || !createdAt || !updatedAt || disclosure == null) {
    return null;
  }

  return {
    id,
    slug,
    name,
    brand: asNullableString(value.brand),
    description: asNullableString(value.description),
    details: asJsonObject(value.details),
    materials: asNullableString(value.materials),
    whats_included: asNullableString(value.whats_included),
    shape: asNullableString(value.shape),
    gender: asNullableString(value.gender),
    fit: asNullableString(value.fit),
    disclosure,
    status: status as CatalogueStatus,
    created_at: createdAt,
    updated_at: updatedAt,
    published_at: asNullableString(value.published_at),
  };
}

function parseVariantRow(value: unknown): ProductVariantRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const status = value.status;
  if (typeof status !== "string" || !VARIANT_STATUSES.has(status as VariantStatus)) {
    return null;
  }
  const id = asString(value.id);
  const productId = asString(value.product_id);
  const sku = asString(value.sku);
  const colourName = asString(value.colour_name);
  const createdAt = asString(value.created_at);
  const updatedAt = asString(value.updated_at);
  const priceMinor = asInteger(value.price_minor);
  const stockQuantity = asInteger(value.stock_quantity);
  if (
    !id ||
    !productId ||
    !sku ||
    !colourName ||
    !createdAt ||
    !updatedAt ||
    priceMinor == null ||
    stockQuantity == null ||
    value.currency !== "GBP"
  ) {
    return null;
  }

  return {
    id,
    product_id: productId,
    sku,
    colour_name: colourName,
    size_name: asNullableString(value.size_name),
    price_minor: priceMinor,
    compare_at_price_minor: asInteger(value.compare_at_price_minor),
    currency: "GBP",
    lens_width_mm: asInteger(value.lens_width_mm),
    bridge_width_mm: asInteger(value.bridge_width_mm),
    temple_length_mm: asInteger(value.temple_length_mm),
    stock_quantity: stockQuantity,
    status: status as VariantStatus,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function parseImageRow(value: unknown): ProductImageRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const imageType = value.image_type;
  if (typeof imageType !== "string" || !IMAGE_TYPES.has(imageType as ProductImageType)) {
    return null;
  }
  const id = asString(value.id);
  const productId = asString(value.product_id);
  const storagePath = asString(value.storage_path);
  const altText = typeof value.alt_text === "string" ? value.alt_text : null;
  const createdAt = asString(value.created_at);
  const updatedAt = asString(value.updated_at);
  const sortOrder = asInteger(value.sort_order);
  if (
    !id ||
    !productId ||
    storagePath == null ||
    altText == null ||
    !createdAt ||
    !updatedAt ||
    sortOrder == null
  ) {
    return null;
  }

  return {
    id,
    product_id: productId,
    variant_id: asNullableString(value.variant_id),
    storage_path: storagePath,
    alt_text: altText,
    sort_order: sortOrder,
    image_type: imageType as ProductImageType,
    is_primary: typeof value.is_primary === "boolean" ? value.is_primary : false,
    width: asInteger(value.width),
    height: asInteger(value.height),
    created_at: createdAt,
    updated_at: updatedAt,
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNullableString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  return typeof value === "string" ? value : null;
}

function asInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  return null;
}

function asJsonObject(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }
  return value;
}
