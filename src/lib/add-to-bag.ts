import { demoVariantId } from "@/lib/ids";
import {
  containsForbiddenCartOwnership,
  hasForbiddenOwnershipKey,
} from "@/lib/ownership-keys";
import { isProductAvailable } from "@/services/catalogue";
import type { Product, ProductVariant } from "@/types/catalogue";
import type { AddToBagInput, AddToBagResult, PublicAddToBagResult } from "@/types/pdp";

export const ADD_TO_BAG_QUANTITY_MAX = 10;

/**
 * Client may send product selection only. Ownership keys are rejected so a
 * guest session id / cart UUID cannot be smuggled in the action body.
 */
export function parseAddToBagInput(raw: unknown): AddToBagInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  if (hasForbiddenOwnershipKey(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const slug = typeof record.slug === "string" ? record.slug.trim() : "";
  const colourId = typeof record.colourId === "string" ? record.colourId.trim() : "";
  const quantity = typeof record.quantity === "number" ? record.quantity : Number.NaN;
  if (!slug || !colourId || !Number.isFinite(quantity)) {
    return null;
  }
  const size =
    typeof record.size === "string" && record.size.trim() ? record.size.trim() : undefined;
  return size ? { slug, colourId, quantity, size } : { slug, colourId, quantity };
}

export function toPublicAddToBagResult(result: AddToBagResult): PublicAddToBagResult {
  if (result.status === "unavailable") {
    return { status: "unavailable", availability: result.availability };
  }
  if (result.status === "added") {
    if (containsForbiddenCartOwnership(result.cart)) {
      return { status: "error" };
    }
    return { status: "added", cart: result.cart };
  }
  return { status: "error" };
}

export function evaluateAddToBag(
  product: Product | null | undefined,
  input: AddToBagInput,
): AddToBagResult {
  const quantity = Math.floor(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > ADD_TO_BAG_QUANTITY_MAX) {
    return { status: "error" };
  }
  if (!product) {
    return { status: "unavailable", availability: "sold_out" };
  }
  if (!isProductAvailable(product)) {
    return { status: "unavailable", availability: product.availability };
  }

  const colour = product.colours.find((item) => item.id === input.colourId);
  if (!colour) {
    return { status: "error" };
  }
  if (!colour.available) {
    return { status: "unavailable", availability: "out_of_stock" };
  }

  const variant = resolveSelectedVariant(product, input.colourId, input.size);
  if (product.variants && product.variants.length > 0 && !variant) {
    return { status: "error" };
  }
  if (variant && variant.availability !== "in_stock") {
    return { status: "unavailable", availability: variant.availability };
  }

  return { status: "ready" };
}

export function resolveSelectedVariant(
  product: Product,
  colourId: string,
  size?: string,
): ProductVariant | undefined {
  const variants = product.variants ?? [];
  if (variants.length === 0) {
    return undefined;
  }
  const byColour = variants.filter((item) => item.colourId === colourId);
  if (size) {
    return byColour.find((item) => item.size === size) ?? byColour[0];
  }
  return byColour[0];
}

export function resolveCartVariantId(
  product: Product,
  colourId: string,
  size?: string,
): string {
  const variant = resolveSelectedVariant(product, colourId, size);
  if (variant?.id) {
    return variant.id;
  }
  return demoVariantId(product.id, colourId, size);
}
