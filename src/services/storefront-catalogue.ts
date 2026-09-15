import { cache } from "react";
import "server-only";

import { isDemoCatalogueEnabled, isDemoCatalogueForced } from "@/lib/demo-catalogue-mode";
import { menuBrandLinksFrom } from "@/lib/menu-brands";
import {
  getDemoBrands,
  getDemoProducts,
  hydrateDemoProduct,
} from "@/services/catalogue";
import { fetchLivePublishedCatalogue } from "@/services/live-catalogue";
import type { Brand, Product, Shape, StorefrontCatalogueSource } from "@/types/catalogue";
import { SHAPES } from "@/types/catalogue";
import { isProductAvailable } from "@/lib/product-display";

export type { StorefrontCatalogueSource };

export type StorefrontCatalogue = {
  source: StorefrontCatalogueSource;
  products: Product[];
  brands: Brand[];
  unavailable: boolean;
};

export class StorefrontCatalogueUnavailableError extends Error {
  constructor() {
    super("Storefront catalogue is unavailable.");
    this.name = "StorefrontCatalogueUnavailableError";
  }
}

function emptyCatalogue(unavailable = false): StorefrontCatalogue {
  return {
    source: "empty",
    products: [],
    brands: [],
    unavailable,
  };
}

function demoCatalogueSnapshot(): StorefrontCatalogue {
  const products = getDemoProducts().map(hydrateDemoProduct);
  return {
    source: "demo",
    products,
    brands: getDemoBrands(),
    unavailable: false,
  };
}

async function loadStorefrontCatalogue(): Promise<StorefrontCatalogue> {
  if (isDemoCatalogueForced()) {
    return demoCatalogueSnapshot();
  }

  const live = await fetchLivePublishedCatalogue();

  if (live.ok) {
    return {
      source: "live",
      products: live.catalogue.products,
      brands: live.catalogue.brands,
      unavailable: false,
    };
  }

  if (isDemoCatalogueEnabled()) {
    return demoCatalogueSnapshot();
  }

  if (live.reason === "error") {
    return emptyCatalogue(true);
  }

  return emptyCatalogue(false);
}

export const getStorefrontCatalogue = cache(loadStorefrontCatalogue);

export async function requireStorefrontCatalogue(): Promise<StorefrontCatalogue> {
  const catalogue = await getStorefrontCatalogue();
  if (catalogue.unavailable) {
    throw new StorefrontCatalogueUnavailableError();
  }
  return catalogue;
}

export function getHomepageFeaturedFrom(
  products: Product[],
  limit = 4,
): Product[] {
  return products.slice(0, limit);
}

export function getBestSellersFrom(products: Product[]): Product[] {
  return products.filter((product) => product.isBestSeller);
}

export function getNewArrivalsFrom(products: Product[]): Product[] {
  return products.filter((product) => product.isNewArrival);
}

export function getEditorialProductFrom(products: Product[]): Product | undefined {
  return (
    getBestSellersFrom(products).find((product) => isProductAvailable(product)) ??
    products.find((product) => isProductAvailable(product))
  );
}

export function getPopulatedShapesFrom(products: Product[]): Shape[] {
  return SHAPES.filter(
    (shape) => products.some((product) => product.shape.includes(shape)),
  );
}

export function getMenuBrandLinksFromCatalogue(brands: Brand[], limit = 6) {
  return menuBrandLinksFrom(brands, limit);
}

export function getBrandBySlugFrom(
  brands: Brand[],
  slug: string,
): Brand | undefined {
  return brands.find((brand) => brand.slug === slug && brand.status === "active");
}
