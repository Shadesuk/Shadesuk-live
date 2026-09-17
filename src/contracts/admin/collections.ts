import {
  CATALOGUE_STATUSES,
  type CatalogueStatus,
} from "../catalogue/schema";
import { slugifyToken } from "../catalogue/taxonomy";
import { SHAPES } from "@/types/catalogue";
import { isUuid } from "@/lib/ids";
import {
  ADMIN_PRODUCT_LONG_TEXT_MAX,
  ADMIN_PRODUCT_SEARCH_MAX,
  ADMIN_PRODUCT_TEXT_MAX,
  isProductSlug,
  nextUniqueProductSlug,
  sanitizeAdminProductSearch,
} from "./products";

export const ADMIN_COLLECTIONS_PAGE_SIZE = 20;
export const ADMIN_COLLECTION_SEARCH_MAX = ADMIN_PRODUCT_SEARCH_MAX;
export const ADMIN_COLLECTION_NAME_MAX = ADMIN_PRODUCT_TEXT_MAX;
export const ADMIN_COLLECTION_DESCRIPTION_MAX = 800;
export const ADMIN_COLLECTION_PRODUCT_SEARCH_LIMIT = 12;

export const ADMIN_COLLECTION_VISIBILITY_FILTERS = [
  "all",
  "visible",
  "hidden",
  "archived",
] as const;
export type AdminCollectionVisibilityFilter =
  (typeof ADMIN_COLLECTION_VISIBILITY_FILTERS)[number];

export type AdminCollectionVisibility = "visible" | "hidden";

export const RESERVED_COLLECTION_SLUGS: readonly string[] = [
  "shop",
  "men",
  "women",
  "unisex",
  "new-arrivals",
  "best-sellers",
  ...SHAPES,
];

export const ADMIN_COLLECTION_STATUS_LABELS = {
  published: "Visible",
  draft: "Hidden",
  archived: "Archived",
} as const satisfies Record<CatalogueStatus, string>;

export type AdminCollectionListQuery = {
  q: string;
  visibility: AdminCollectionVisibilityFilter;
  page: number;
};

export type AdminCollectionListItem = {
  id: string;
  name: string;
  slug: string;
  status: CatalogueStatus;
  productCount: number;
  updatedAt: string;
  imageSrc: string | null;
};

export type AdminCollectionProductRef = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  sku: string | null;
  status: CatalogueStatus;
  imageSrc: string | null;
  imageAlt: string;
  imageWidth: number | null;
  imageHeight: number | null;
};

export type AdminCollectionDetailView = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imagePath: string | null;
  imageSrc: string | null;
  status: CatalogueStatus;
  updatedAt: string;
  products: AdminCollectionProductRef[];
};

export type AdminCollectionSaveInput = {
  id: string | null;
  updatedAt: string | null;
  name: string;
  slug: string;
  description: string;
  visibility: AdminCollectionVisibility;
  productIds: string[];
};

export type AdminCollectionField = "name" | "slug" | "description" | "visibility" | "products";
export type AdminCollectionIntent = "save" | "archive" | "delete";

export function isCollectionVisibilityFilter(
  value: string | null | undefined,
): value is AdminCollectionVisibilityFilter {
  return ADMIN_COLLECTION_VISIBILITY_FILTERS.includes(
    value as AdminCollectionVisibilityFilter,
  );
}

export function collectionStatusFromVisibility(
  visibility: AdminCollectionVisibility,
): Exclude<CatalogueStatus, "archived"> {
  return visibility === "visible" ? "published" : "draft";
}

export function collectionVisibilityFromStatus(
  status: CatalogueStatus,
): AdminCollectionVisibility | "archived" {
  if (status === "published") {
    return "visible";
  }
  if (status === "archived") {
    return "archived";
  }
  return "hidden";
}

export function statusesForVisibilityFilter(
  visibility: AdminCollectionVisibilityFilter,
): CatalogueStatus[] | null {
  if (visibility === "visible") {
    return ["published"];
  }
  if (visibility === "hidden") {
    return ["draft"];
  }
  if (visibility === "archived") {
    return ["archived"];
  }
  return null;
}

export function adminCollectionSlugFromName(name: string): string {
  return slugifyToken(name) ?? "";
}

export function isCollectionSlug(value: string): boolean {
  return isProductSlug(value);
}

export function isReservedCollectionSlug(slug: string): boolean {
  return RESERVED_COLLECTION_SLUGS.includes(slug);
}

export function nextUniqueCollectionSlug(
  base: string,
  taken: ReadonlySet<string>,
): string | null {
  const blocked = new Set([...taken, ...RESERVED_COLLECTION_SLUGS]);
  return nextUniqueProductSlug(base, blocked);
}

export function parseAdminCollectionListQuery(
  params: Record<string, string | string[] | undefined>,
): AdminCollectionListQuery {
  const pageRaw = Number.parseInt(readParam(params.page) || "1", 10);
  const visibilityRaw = readParam(params.visibility);
  return {
    q: sanitizeAdminProductSearch(readParam(params.q)).slice(0, ADMIN_COLLECTION_SEARCH_MAX),
    visibility: isCollectionVisibilityFilter(visibilityRaw) ? visibilityRaw : "all",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export function adminCollectionListQueryString(
  query: AdminCollectionListQuery,
  page = query.page,
): string {
  const params = new URLSearchParams();
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.visibility !== "all") {
    params.set("visibility", query.visibility);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function parseAdminCollectionSaveInput(form: FormData): {
  ok: true;
  intent: AdminCollectionIntent;
  value: AdminCollectionSaveInput;
} | {
  ok: false;
  intent: AdminCollectionIntent;
  errors: Partial<Record<AdminCollectionField, string>>;
  values: Record<string, string>;
} {
  const intentRaw = String(form.get("intent") ?? "save");
  const intent: AdminCollectionIntent =
    intentRaw === "archive" || intentRaw === "delete" ? intentRaw : "save";
  const idRaw = String(form.get("id") ?? "").trim();
  const updatedAt = String(form.get("updatedAt") ?? "").trim() || null;
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const visibilityRaw = String(form.get("visibility") ?? "hidden");
  const visibility: AdminCollectionVisibility = visibilityRaw === "visible" ? "visible" : "hidden";
  const productIds = uniqueUuids(form.getAll("productId"));
  const values = {
    id: idRaw,
    name,
    description,
    visibility,
  };

  if (intent === "archive" || intent === "delete") {
    if (!idRaw || !isUuid(idRaw)) {
      return { ok: false, intent, errors: { name: "This collection could not be found." }, values };
    }
    return {
      ok: true,
      intent,
      value: {
        id: idRaw,
        updatedAt,
        name,
        slug: "",
        description,
        visibility,
        productIds,
      },
    };
  }

  const errors: Partial<Record<AdminCollectionField, string>> = {};
  if (!name) {
    errors.name = "Enter a collection name.";
  } else if (name.length > ADMIN_COLLECTION_NAME_MAX) {
    errors.name = `Use ${ADMIN_COLLECTION_NAME_MAX} characters or fewer.`;
  }
  if (description.length > ADMIN_COLLECTION_DESCRIPTION_MAX) {
    errors.description = `Use ${ADMIN_COLLECTION_DESCRIPTION_MAX} characters or fewer.`;
  }
  const slug = adminCollectionSlugFromName(name);
  if (!slug || !isCollectionSlug(slug)) {
    errors.slug = "The name must produce a valid public URL.";
  } else if (!idRaw && isReservedCollectionSlug(slug)) {
    errors.slug = "That URL is reserved for an existing storefront collection.";
  }
  if (idRaw && !isUuid(idRaw)) {
    errors.name = "This collection could not be found.";
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, intent, errors, values };
  }

  return {
    ok: true,
    intent,
    value: {
      id: idRaw || null,
      updatedAt,
      name,
      slug,
      description,
      visibility,
      productIds,
    },
  };
}

function uniqueUuids(values: FormDataEntryValue[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || !isUuid(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    ids.push(value);
  }
  return ids;
}

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export { CATALOGUE_STATUSES, ADMIN_PRODUCT_LONG_TEXT_MAX };
