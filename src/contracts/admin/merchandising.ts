import { isUuid } from "@/lib/ids";
import { sanitizeAdminProductSearch } from "./products";

export const ADMIN_MERCHANDISING_SEARCH_MAX = 80;
export const ADMIN_MERCHANDISING_SEARCH_LIMIT = 12;
export const ADMIN_MERCHANDISING_LIST_MAX = 24;

export type AdminMerchandisingProductRef = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  imageSrc: string | null;
  imageAlt: string;
  imageWidth: number | null;
  imageHeight: number | null;
};

export type AdminMerchandisingView = {
  featuredEnabled: boolean;
  bestSellersEnabled: boolean;
  featured: AdminMerchandisingProductRef[];
  bestSellers: AdminMerchandisingProductRef[];
  flagship: AdminMerchandisingProductRef | null;
  newArrivals: AdminMerchandisingProductRef[];
};

export type AdminMerchandisingSaveInput = {
  featuredEnabled: boolean;
  bestSellersEnabled: boolean;
  featuredIds: string[];
  bestSellerIds: string[];
  flagshipId: string | null;
};

export function parseAdminMerchandisingSaveInput(form: FormData): {
  ok: true;
  value: AdminMerchandisingSaveInput;
} | {
  ok: false;
  message: string;
} {
  const featuredIds = uniqueUuids(form.getAll("featuredId"));
  const bestSellerIds = uniqueUuids(form.getAll("bestSellerId"));
  const flagshipRaw = String(form.get("flagshipId") ?? "").trim();
  if (flagshipRaw && !isUuid(flagshipRaw)) {
    return { ok: false, message: "Choose a published flagship product." };
  }
  if (featuredIds.length > ADMIN_MERCHANDISING_LIST_MAX || bestSellerIds.length > ADMIN_MERCHANDISING_LIST_MAX) {
    return { ok: false, message: "Too many products selected." };
  }
  return {
    ok: true,
    value: {
      featuredEnabled: form.get("featuredEnabled") === "on",
      bestSellersEnabled: form.get("bestSellersEnabled") === "on",
      featuredIds,
      bestSellerIds,
      flagshipId: flagshipRaw || null,
    },
  };
}

export function parseMerchandisingSearch(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return sanitizeAdminProductSearch(value).slice(0, ADMIN_MERCHANDISING_SEARCH_MAX);
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
