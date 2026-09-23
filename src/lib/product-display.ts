import { productPath } from "@/lib/navigation";
import type {
  Availability,
  Product,
  ProductColour,
  ProductImage,
  ProductImageRole,
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

/** Display name from the product row. Does not look up a catalogue table. */
export function getProductBrandName(product: Product): string {
  const named = product.brandName?.trim();
  if (named) {
    return named;
  }
  return product.brandId;
}

export function getProductHref(product: Pick<Product, "slug">): string {
  return productPath(product.slug);
}

/** Compare-at is a sale only when it is higher than the selling price. */
export function getSaleCompareAtPrice(
  product: Pick<Product, "price" | "compareAtPrice">,
): number | undefined {
  const compare = product.compareAtPrice;
  if (compare == null || !(compare > product.price)) {
    return undefined;
  }
  return compare;
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
