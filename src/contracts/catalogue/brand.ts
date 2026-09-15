import type { BrandSource } from "@/types/catalogue";
import type { ProductRow } from "./schema";
import { slugifyToken } from "./taxonomy";

/**
 * There is no `brands` table in PR #10. Brand identity is derived from
 * `products.brand` text on published rows. `Brand.id` is the derived slug,
 * not a UUID, until a brands table exists.
 */
export type DerivedBrand = BrandSource & {
  derivedFrom: "products.brand";
};

export function deriveBrandSource(
  brandName: string | null | undefined,
): DerivedBrand | null {
  const name = brandName?.trim() ?? "";
  const slug = slugifyToken(name);
  if (!name || !slug) {
    return null;
  }

  return {
    id: slug,
    slug,
    name,
    status: "active",
    isDemo: false,
    derivedFrom: "products.brand",
  };
}

export function deriveBrandsFromProducts(products: ProductRow[]): DerivedBrand[] {
  const bySlug = new Map<string, DerivedBrand>();
  for (const product of products) {
    if (product.status !== "published") {
      continue;
    }
    const brand = deriveBrandSource(product.brand);
    if (!brand) {
      continue;
    }
    bySlug.set(brand.slug, brand);
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
}

export function brandIdForProduct(brandName: string | null | undefined): string {
  return deriveBrandSource(brandName)?.id ?? "";
}
