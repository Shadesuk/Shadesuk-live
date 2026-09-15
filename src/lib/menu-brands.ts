import { brandPath } from "@/lib/navigation";
import type { Brand } from "@/types/catalogue";

export type MenuBrandLink = {
  href: string;
  label: string;
};

/** Compact header/menu links. Empty when the catalogue is large enough for /brands. */
export function menuBrandLinksFrom(
  brands: Brand[],
  limit = 6,
): MenuBrandLink[] {
  const published = brands.filter(
    (brand) => brand.status === "active" && brand.productCount > 0,
  );
  if (published.length > limit) {
    return [];
  }
  return published.map((brand) => ({
    href: brandPath(brand.slug),
    label: brand.name,
  }));
}
