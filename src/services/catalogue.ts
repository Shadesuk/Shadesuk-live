import { demoCatalogue } from "@/data/catalogue";
import { brandPath, productPath } from "@/lib/navigation";
import {
  AVAILABILITIES,
  GENDERS,
  SHAPES,
  type Availability,
  type Brand,
  type BrandSource,
  type CatalogueFilters,
  type Gender,
  type Product,
  type ProductColour,
  type ProductImage,
  type ProductImageRole,
  type Shape,
} from "@/types/catalogue";

const IMAGE_FALLBACK: Record<ProductImageRole, string> = {
  front: "Product image",
  side: "Product image",
  detail: "Product detail",
  back: "Product image",
  temple: "Product image",
  "on-model": "On-model image",
  packaging: "Product image",
};

function hasAsset(image: ProductImage): boolean {
  return Boolean(image.src);
}

export function getProducts(): Product[] {
  return demoCatalogue.products;
}

function withProductCount(brand: BrandSource): Brand {
  return {
    ...brand,
    productCount: demoCatalogue.products.filter(
      (product) => product.brandId === brand.id,
    ).length,
  };
}

export function getBrands(): Brand[] {
  return demoCatalogue.brands.map(withProductCount);
}

export function getPublishedBrands(): Brand[] {
  return getBrands().filter((brand) => brand.status === "active");
}

export function getBrandIndex(): Brand[] {
  return getPublishedBrands();
}

export function getBrandBySlug(slug: string): Brand | undefined {
  const brand = demoCatalogue.brands.find((item) => item.slug === slug);
  return brand ? withProductCount(brand) : undefined;
}

export function getBrandProducts(brandSlugOrId: string): Product[] {
  return getProductsByBrand(brandSlugOrId);
}

export function getBrandHref(brand: Pick<Brand, "slug">): string {
  return brandPath(brand.slug);
}

/** Compact header/menu links. Empty when the catalogue is large enough for /brands. */
export function getMenuBrandLinks(limit = 6): Array<{ href: string; label: string }> {
  const brands = getPublishedBrands().filter((brand) => brand.productCount > 0);
  if (brands.length > limit) {
    return [];
  }
  return brands.map((brand) => ({
    href: brandPath(brand.slug),
    label: brand.name,
  }));
}

export function getShapes(): Shape[] {
  return [...SHAPES];
}

export function getBrandById(id: string): Brand | undefined {
  const brand = demoCatalogue.brands.find((item) => item.id === id);
  return brand ? withProductCount(brand) : undefined;
}

export function getBrandName(product: Product): string {
  return getBrandById(product.brandId)?.name ?? product.brandId;
}

export function getProductBySlug(slug: string): Product | undefined {
  return demoCatalogue.products.find((product) => product.slug === slug);
}

export function getProductHref(product: Product): string {
  return productPath(product.slug);
}

export function getColourCount(product: Product): number {
  return product.colours.length;
}

export function getAvailableColours(product: Product): ProductColour[] {
  return product.colours.filter((colour) => colour.available);
}

export function isProductAvailable(product: Product): boolean {
  return product.availability === "in_stock";
}

export function getAvailabilityLabel(availability: Availability): string {
  if (availability === "sold_out") {
    return "Sold out";
  }
  if (availability === "out_of_stock") {
    return "Out of stock";
  }
  return "In stock";
}

export function getPrimaryImage(product: Product): ProductImage | undefined {
  return (
    product.images.find((image) => image.role === "front" && hasAsset(image)) ??
    product.images.find((image) => hasAsset(image))
  );
}

export function getSecondaryImage(product: Product): ProductImage | undefined {
  const primary = getPrimaryImage(product);
  return product.images.find(
    (image) => hasAsset(image) && image.id !== primary?.id,
  );
}

export function getImageFallbackLabel(role: ProductImageRole = "front"): string {
  return IMAGE_FALLBACK[role];
}

export function getNewArrivals(): Product[] {
  return demoCatalogue.products.filter((product) => product.isNewArrival);
}

export function getBestSellers(): Product[] {
  return demoCatalogue.products.filter((product) => product.isBestSeller);
}

export function getHomepageFeatured(limit = 4): Product[] {
  return getProducts().slice(0, limit);
}

export function getEditorialProduct(): Product | undefined {
  return (
    getBestSellers().find((product) => isProductAvailable(product)) ??
    getProducts().find((product) => isProductAvailable(product))
  );
}

export function getPopulatedShapes(): Shape[] {
  return SHAPES.filter((shape) => getProductsByShape(shape).length > 0);
}

export function getProductsByGender(gender: Gender): Product[] {
  return demoCatalogue.products.filter((product) =>
    product.gender.includes(gender),
  );
}

export function getProductsByShape(shape: Shape): Product[] {
  return demoCatalogue.products.filter((product) =>
    product.shape.includes(shape),
  );
}

export function getProductsByBrand(brandSlugOrId: string): Product[] {
  const brand = demoCatalogue.brands.find(
    (item) => item.slug === brandSlugOrId || item.id === brandSlugOrId,
  );
  if (!brand) {
    return [];
  }
  return demoCatalogue.products.filter((product) => product.brandId === brand.id);
}

export function getAvailableFilters(
  products: Product[] = getProducts(),
): CatalogueFilters {
  const colourMap = new Map<string, ProductColour>();
  const genderSet = new Set<Gender>();
  const brandIds = new Set<string>();
  const shapeSet = new Set<Shape>();
  let min = Number.POSITIVE_INFINITY;
  let max = 0;

  for (const product of products) {
    min = Math.min(min, product.price);
    max = Math.max(max, product.price);
    for (const gender of product.gender) {
      genderSet.add(gender);
    }
    brandIds.add(product.brandId);
    for (const shape of product.shape) {
      shapeSet.add(shape);
    }
    for (const colour of product.colours) {
      colourMap.set(colour.id, colour);
    }
  }

  return {
    genders: GENDERS.filter((gender) => genderSet.has(gender)),
    brands: getBrands().filter((brand) => brandIds.has(brand.id)),
    shapes: SHAPES.filter((shape) => shapeSet.has(shape)),
    colours: [...colourMap.values()],
    availability: [...AVAILABILITIES],
    price: {
      min: Number.isFinite(min) ? min : 0,
      max,
    },
  };
}

export function assertDemoCatalogueIntegrity(products = getProducts()): void {
  for (const brand of demoCatalogue.brands) {
    if (!brand.isDemo) {
      throw new Error(`Demo brand ${brand.slug} must be marked isDemo.`);
    }
    if (brand.description) {
      throw new Error(
        `Demo brand ${brand.slug} must not invent a brand description.`,
      );
    }
    if (brand.logo) {
      throw new Error(`Demo brand ${brand.slug} must not invent a brand logo.`);
    }
  }

  for (const product of products) {
    if (product.style.length > 0) {
      throw new Error(
        `Demo product ${product.slug} must not invent style values.`,
      );
    }
    if (!product.isDemo) {
      throw new Error(`Demo product ${product.slug} must be marked isDemo.`);
    }
    for (const shape of product.shape) {
      if (!SHAPES.includes(shape)) {
        throw new Error(`Unsupported public shape on ${product.slug}: ${shape}`);
      }
    }
    if (product.images.some((image) => image.src)) {
      throw new Error(
        `Demo product ${product.slug} must not invent product photography.`,
      );
    }
  }
}
