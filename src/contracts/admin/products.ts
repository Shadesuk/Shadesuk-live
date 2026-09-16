import {
  CATALOGUE_STATUSES,
  PRODUCT_IMAGE_TYPES,
  VARIANT_STATUSES,
  type CatalogueStatus,
  type ProductImageType,
  type VariantStatus,
} from "../catalogue/schema";
import { productAvailabilityFromVariants } from "../catalogue/availability";
import { slugifyToken } from "../catalogue/taxonomy";
import { GENDERS, SHAPES, type Availability, type Gender, type Shape } from "@/types/catalogue";
import { isNonNegativeInteger, majorToMinorGbp } from "../money";

export const ADMIN_PRODUCTS_PAGE_SIZE = 20;
export const ADMIN_PRODUCT_SEARCH_MAX = 80;
export const ADMIN_PRODUCT_TEXT_MAX = 120;
export const ADMIN_PRODUCT_LONG_TEXT_MAX = 4000;
export const ADMIN_PRODUCT_SKU_MAX = 64;
export const ADMIN_DEFAULT_DISCLOSURE = "High-quality 1:1 Superclone";

export const ADMIN_PRODUCT_LIST_STATUSES = ["all", ...CATALOGUE_STATUSES] as const;
export type AdminProductListStatus = (typeof ADMIN_PRODUCT_LIST_STATUSES)[number];

export const ADMIN_PRODUCT_AVAILABILITY_FILTERS = [
  "all",
  "in_stock",
  "out_of_stock",
  "sold_out",
] as const;
export type AdminProductAvailabilityFilter = (typeof ADMIN_PRODUCT_AVAILABILITY_FILTERS)[number];

export const ADMIN_CATALOGUE_STATUS_LABELS = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
} as const satisfies Record<CatalogueStatus, string>;

export const ADMIN_VARIANT_STATUS_LABELS = {
  draft: "Draft",
  available: "Available",
  unavailable: "Unavailable",
  archived: "Archived",
} as const satisfies Record<VariantStatus, string>;

export const ADMIN_PRODUCT_IMAGE_TYPE_LABELS = {
  primary: "Primary",
  secondary: "Secondary",
  detail: "Detail",
  side: "Side",
  lifestyle: "Lifestyle",
} as const satisfies Record<ProductImageType, string>;

export const ADMIN_PRODUCT_AVAILABILITY_LABELS = {
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  sold_out: "Sold out",
} as const satisfies Record<Availability, string>;

export type AdminProductListQuery = {
  q: string;
  status: CatalogueStatus | null;
  availability: AdminProductAvailabilityFilter;
  brand: string;
  page: number;
};

export type AdminProductListItem = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  status: CatalogueStatus;
  priceMinor: number | null;
  compareAtMinor: number | null;
  availability: Availability;
  variantCount: number;
  stockQuantity: number;
  imageSrc: string | null;
  imageAlt: string;
  imageWidth: number | null;
  imageHeight: number | null;
};

export type AdminProductCollectionOption = {
  id: string;
  slug: string;
  name: string;
};

export type AdminProductImageView = {
  id: string;
  storagePath: string;
  src: string | null;
  altText: string;
  sortOrder: number;
  imageType: ProductImageType;
  isPrimary: boolean;
  variantId: string | null;
  width: number | null;
  height: number | null;
};

export type AdminProductVariantView = {
  id: string;
  sku: string;
  colourName: string;
  sizeName: string | null;
  priceMinor: number;
  compareAtMinor: number | null;
  stockQuantity: number;
  status: VariantStatus;
  lensWidthMm: number | null;
  bridgeWidthMm: number | null;
  templeLengthMm: number | null;
};

export type AdminProductDetailView = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  description: string;
  materials: string;
  whatsIncluded: string;
  genders: Gender[];
  shapes: Shape[];
  fit: string;
  disclosure: string;
  status: CatalogueStatus;
  updatedAt: string;
  variants: AdminProductVariantView[];
  images: AdminProductImageView[];
  collectionIds: string[];
  collections: AdminProductCollectionOption[];
};

export type AdminProductVariantInput = {
  id: string | null;
  sku: string;
  colourName: string;
  sizeName: string | null;
  priceMinor: number;
  compareAtMinor: number | null;
  stockQuantity: number;
  status: VariantStatus;
  lensWidthMm: number | null;
  bridgeWidthMm: number | null;
  templeLengthMm: number | null;
};

export type AdminProductSaveInput = {
  id: string | null;
  updatedAt: string | null;
  name: string;
  slug: string;
  brand: string;
  description: string;
  materials: string;
  whatsIncluded: string;
  genders: Gender[];
  shapes: Shape[];
  fit: string;
  disclosure: string;
  variants: AdminProductVariantInput[];
  collectionIds: string[];
  imageOrder: string[];
  imageAlts: Record<string, string>;
  imageVariantIds: Record<string, string | null>;
};

export type AdminProductField =
  | "name"
  | "slug"
  | "brand"
  | "description"
  | "materials"
  | "whatsIncluded"
  | "gender"
  | "shape"
  | "fit"
  | "disclosure"
  | "variants"
  | "price"
  | "sale"
  | "sku"
  | "status"
  | "images"
  | "collections";

export type AdminProductIntent = "save" | "publish" | "unpublish" | "archive" | "delete";

export function parseAdminProductListQuery(
  params: Record<string, string | string[] | undefined>,
): AdminProductListQuery {
  const pageRaw = Number.parseInt(readParam(params.page) || "1", 10);
  const statusRaw = readParam(params.status);
  const availabilityRaw = readParam(params.availability);
  return {
    q: sanitizeAdminProductSearch(readParam(params.q)),
    status: isCatalogueStatus(statusRaw) ? statusRaw : null,
    availability: isAvailabilityFilter(availabilityRaw) ? availabilityRaw : "all",
    brand: sanitizeAdminProductSearch(readParam(params.brand)).slice(0, ADMIN_PRODUCT_TEXT_MAX),
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export function adminProductListQueryString(
  query: AdminProductListQuery,
  page = query.page,
): string {
  const params = new URLSearchParams();
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.availability !== "all") {
    params.set("availability", query.availability);
  }
  if (query.brand) {
    params.set("brand", query.brand);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function sanitizeAdminProductSearch(value: string): string {
  return value
    .trim()
    .slice(0, ADMIN_PRODUCT_SEARCH_MAX)
    .replace(/["\\,()%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCatalogueStatus(value: string | null | undefined): value is CatalogueStatus {
  return CATALOGUE_STATUSES.includes(value as CatalogueStatus);
}

export function isVariantStatus(value: string | null | undefined): value is VariantStatus {
  return VARIANT_STATUSES.includes(value as VariantStatus);
}

export function isProductImageType(value: string | null | undefined): value is ProductImageType {
  return PRODUCT_IMAGE_TYPES.includes(value as ProductImageType);
}

export function isAvailabilityFilter(
  value: string | null | undefined,
): value is AdminProductAvailabilityFilter {
  return ADMIN_PRODUCT_AVAILABILITY_FILTERS.includes(value as AdminProductAvailabilityFilter);
}

export function adminCatalogueStatusLabel(status: CatalogueStatus): string {
  return ADMIN_CATALOGUE_STATUS_LABELS[status];
}

export function adminProductSlugFromName(name: string): string {
  return slugifyToken(name) ?? "";
}

export function isProductSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function suggestedVariantSku(
  productSlug: string,
  colourName: string,
  sizeName: string | null,
): string {
  const parts = [productSlug, slugifyToken(colourName), sizeName ? slugifyToken(sizeName) : null].filter(
    (part): part is string => Boolean(part),
  );
  return parts.join("-").toUpperCase().slice(0, ADMIN_PRODUCT_SKU_MAX);
}

export function variantCombinations(
  colours: string[],
  sizes: string[],
): Array<{ colourName: string; sizeName: string | null }> {
  const uniqueColours = uniqueLabels(colours);
  const uniqueSizes = uniqueLabels(sizes);
  if (uniqueColours.length === 0) {
    return [];
  }
  if (uniqueSizes.length === 0) {
    return uniqueColours.map((colourName) => ({ colourName, sizeName: null }));
  }
  return uniqueColours.flatMap((colourName) =>
    uniqueSizes.map((sizeName) => ({ colourName, sizeName })),
  );
}

export function parseGbpMajorInput(
  value: unknown,
): { ok: true; minor: number } | { ok: false } {
  if (typeof value !== "string") {
    return { ok: false };
  }
  const trimmed = value.trim().replace(/^£/, "").replace(/,/g, "");
  if (!trimmed) {
    return { ok: false };
  }
  const amount = Number(trimmed);
  try {
    return { ok: true, minor: majorToMinorGbp(amount) };
  } catch {
    return { ok: false };
  }
}

export function parseOptionalGbpMajorInput(
  value: unknown,
): { ok: true; minor: number | null } | { ok: false } {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: true, minor: null };
  }
  const parsed = parseGbpMajorInput(value);
  if (!parsed.ok) {
    return { ok: false };
  }
  return parsed;
}

export function formatGbpMajorInput(amountMinor: number | null | undefined): string {
  if (amountMinor == null || !isNonNegativeInteger(amountMinor)) {
    return "";
  }
  const major = amountMinor / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}

export function encodeTaxonomy(values: readonly string[]): string | null {
  const unique = uniqueLabels(values.map((value) => value.trim().toLowerCase()));
  return unique.length > 0 ? unique.join(",") : null;
}

export function parseProductGenders(value: unknown): Gender[] {
  if (Array.isArray(value)) {
    return GENDERS.filter((gender) => value.includes(gender));
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  const tokens = value.split(",").map((part) => part.trim());
  return GENDERS.filter((gender) => tokens.includes(gender));
}

export function parseProductShapes(value: unknown): Shape[] {
  if (Array.isArray(value)) {
    return SHAPES.filter((shape) => value.includes(shape));
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  const tokens = value.split(",").map((part) => part.trim());
  return SHAPES.filter((shape) => tokens.includes(shape));
}

export function parseAdminProductSaveInput(form: FormData): {
  ok: true;
  value: AdminProductSaveInput;
  intent: AdminProductIntent;
} | {
  ok: false;
  errors: Partial<Record<AdminProductField, string>>;
  values: Record<string, string>;
  intent: AdminProductIntent;
} {
  const intent = parseIntent(form.get("intent"));
  const values = formValuesFrom(form);
  const errors: Partial<Record<AdminProductField, string>> = {};
  const idRaw = readOptionalText(form.get("productId"), 36);
  if (intent === "archive" || intent === "delete") {
    if (!idRaw) {
      return { ok: false, errors: { status: "Choose a product first." }, values, intent };
    }
    return {
      ok: true,
      intent,
      value: emptyProductSave(idRaw),
    };
  }
  const name = readOptionalText(form.get("name"), ADMIN_PRODUCT_TEXT_MAX);
  const slugRaw = readOptionalText(form.get("slug"), ADMIN_PRODUCT_TEXT_MAX).toLowerCase();
  const slug = slugRaw || adminProductSlugFromName(name);
  const brand = readOptionalText(form.get("brand"), ADMIN_PRODUCT_TEXT_MAX);
  const description = readOptionalText(form.get("description"), ADMIN_PRODUCT_LONG_TEXT_MAX);
  const materials = readOptionalText(form.get("materials"), ADMIN_PRODUCT_LONG_TEXT_MAX);
  const whatsIncluded = readOptionalText(form.get("whatsIncluded"), ADMIN_PRODUCT_LONG_TEXT_MAX);
  const fit = readOptionalText(form.get("fit"), ADMIN_PRODUCT_TEXT_MAX);
  const disclosure =
    readOptionalText(form.get("disclosure"), ADMIN_PRODUCT_TEXT_MAX) || ADMIN_DEFAULT_DISCLOSURE;
  const genders = parseProductGenders(form.getAll("gender"));
  const shapes = parseProductShapes(form.getAll("shape"));
  const updatedAt = readOptionalText(form.get("updatedAt"), 40) || null;

  if (!name) {
    errors.name = "Enter a product name.";
  }
  if (!slug || !isProductSlug(slug)) {
    errors.slug = "Enter a lowercase URL-safe slug.";
  }
  if (!disclosure) {
    errors.disclosure = "Enter a disclosure.";
  }

  const variants = parseVariantInputs(form, errors);
  if (intent === "publish" && variants.length === 0) {
    errors.variants = "Add at least one variant before publishing.";
  }
  if (intent === "publish") {
    const publishable = variants.some(
      (variant) => variant.status === "available" && variant.sku && variant.colourName,
    );
    if (!publishable) {
      errors.variants = "Publish needs at least one available variant with a colour and SKU.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, values, intent };
  }

  return {
    ok: true,
    intent,
    value: {
      id: idRaw || null,
      updatedAt,
      name,
      slug,
      brand,
      description,
      materials,
      whatsIncluded,
      genders,
      shapes,
      fit,
      disclosure,
      variants,
      collectionIds: form
        .getAll("collectionId")
        .map((value) => (typeof value === "string" ? value : ""))
        .filter((value) => /^[0-9a-f-]{36}$/i.test(value)),
      imageOrder: readOptionalText(form.get("imageOrder"), 2000)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
      imageAlts: readKeyedMap(form, "imageAlt"),
      imageVariantIds: Object.fromEntries(
        Object.entries(readKeyedMap(form, "imageVariant")).map(([key, value]) => [
          key,
          value || null,
        ]),
      ),
    },
  };
}

export function availabilityFromVariants(
  variants: Array<{ status: VariantStatus; stock_quantity: number }>,
): Availability {
  return productAvailabilityFromVariants(
    variants.map((variant) => ({
      id: "x",
      product_id: "x",
      sku: "x",
      colour_name: "x",
      size_name: null,
      price_minor: 0,
      compare_at_price_minor: null,
      currency: "GBP",
      lens_width_mm: null,
      bridge_width_mm: null,
      temple_length_mm: null,
      stock_quantity: variant.stock_quantity,
      status: variant.status,
      created_at: "",
      updated_at: "",
    })),
  );
}

export { CATALOGUE_STATUSES, PRODUCT_IMAGE_TYPES, VARIANT_STATUSES, GENDERS, SHAPES };

function emptyProductSave(id: string): AdminProductSaveInput {
  return {
    id,
    updatedAt: null,
    name: "",
    slug: "",
    brand: "",
    description: "",
    materials: "",
    whatsIncluded: "",
    genders: [],
    shapes: [],
    fit: "",
    disclosure: ADMIN_DEFAULT_DISCLOSURE,
    variants: [],
    collectionIds: [],
    imageOrder: [],
    imageAlts: {},
    imageVariantIds: {},
  };
}

function parseIntent(value: unknown): AdminProductIntent {
  if (
    value === "publish" ||
    value === "unpublish" ||
    value === "archive" ||
    value === "delete"
  ) {
    return value;
  }
  return "save";
}

function parseVariantInputs(
  form: FormData,
  errors: Partial<Record<AdminProductField, string>>,
): AdminProductVariantInput[] {
  const count = Number.parseInt(String(form.get("variantCount") ?? "0"), 10);
  const total = Number.isInteger(count) && count > 0 ? Math.min(count, 80) : 0;
  const variants: AdminProductVariantInput[] = [];
  const seen = new Set<string>();
  const skus = new Set<string>();
  for (let index = 0; index < total; index += 1) {
    const prefix = `variant_${index}_`;
    const colourName = readOptionalText(form.get(`${prefix}colourName`), ADMIN_PRODUCT_TEXT_MAX);
    const sizeName = readOptionalText(form.get(`${prefix}sizeName`), ADMIN_PRODUCT_TEXT_MAX) || null;
    const sku = readOptionalText(form.get(`${prefix}sku`), ADMIN_PRODUCT_SKU_MAX);
    const statusRaw = readOptionalText(form.get(`${prefix}status`), 24);
    const stockRaw = Number.parseInt(String(form.get(`${prefix}stock`) ?? "0"), 10);
    const price = parseGbpMajorInput(form.get(`${prefix}price`));
    const compare = parseOptionalGbpMajorInput(form.get(`${prefix}compareAt`));
    const lens = parseOptionalMm(form.get(`${prefix}lens`));
    const bridge = parseOptionalMm(form.get(`${prefix}bridge`));
    const temple = parseOptionalMm(form.get(`${prefix}temple`));
    if (!colourName && !sku && !price.ok) {
      continue;
    }
    if (!colourName) {
      errors.variants = "Each variant needs a colour.";
      continue;
    }
    if (!sku) {
      errors.sku = "Each variant needs a SKU.";
      continue;
    }
    if (!price.ok) {
      errors.price = "Enter a valid price in pounds and pence.";
      continue;
    }
    if (!compare.ok) {
      errors.sale = "Enter a valid compare-at price, or leave it blank.";
      continue;
    }
    if (compare.minor != null && compare.minor < price.minor) {
      errors.sale = "Sale price must not exceed the regular price.";
      continue;
    }
    if (!isVariantStatus(statusRaw)) {
      errors.variants = "Choose a valid variant status.";
      continue;
    }
    if (!Number.isInteger(stockRaw) || stockRaw < 0) {
      errors.variants = "Stock must be a whole number of 0 or more.";
      continue;
    }
    if (statusRaw === "available" && stockRaw === 0) {
      // Allowed: available + 0 stock is out_of_stock, not purchasable.
    }
    const key = `${colourName.toLowerCase()}::${(sizeName ?? "").toLowerCase()}`;
    if (seen.has(key)) {
      errors.variants = "Each colour and size combination can only exist once.";
      continue;
    }
    seen.add(key);
    const skuKey = sku.toLowerCase();
    if (skus.has(skuKey)) {
      errors.sku = "SKUs must be unique.";
      continue;
    }
    skus.add(skuKey);
    variants.push({
      id: readOptionalText(form.get(`${prefix}id`), 36) || null,
      sku,
      colourName,
      sizeName,
      priceMinor: price.minor,
      compareAtMinor: compare.minor,
      stockQuantity: stockRaw,
      status: statusRaw,
      lensWidthMm: lens,
      bridgeWidthMm: bridge,
      templeLengthMm: temple,
    });
  }
  return variants;
}

function parseOptionalMm(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function uniqueLabels(values: string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const value of values) {
    const trimmed = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    labels.push(trimmed);
  }
  return labels;
}

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }
  return typeof value === "string" ? value : "";
}

function readOptionalText(value: unknown, max: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function readKeyedMap(form: FormData, prefix: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith(`${prefix}:`) || typeof value !== "string") {
      continue;
    }
    result[key.slice(prefix.length + 1)] = readOptionalText(value, ADMIN_PRODUCT_TEXT_MAX);
  }
  return result;
}

function formValuesFrom(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }
  return values;
}
