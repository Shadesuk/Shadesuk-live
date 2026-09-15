import { demoVariantId, isDemoVariantId, isUuid } from "@/lib/ids";
import {
  containsForbiddenCartOwnership,
  hasForbiddenOwnershipKey,
} from "@/lib/ownership-keys";
import { isProductAvailable } from "@/lib/product-display";
import type { Product, ProductVariant } from "@/types/catalogue";
import type { AddToBagInput, AddToBagResult, PublicAddToBagResult } from "@/types/pdp";

export const ADD_TO_BAG_QUANTITY_MAX = 10;
const VARIANT_ID_MAX_LENGTH = 200;

/**
 * Client may send product selection only. Ownership keys are rejected so a
 * guest session id / cart UUID cannot be smuggled in the action body.
 * Line identity is variantId (preferred) or colourId (+ size when needed).
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
  const quantity = typeof record.quantity === "number" ? record.quantity : Number.NaN;
  if (!slug || !Number.isFinite(quantity)) {
    return null;
  }

  const variantId = parseOptionalToken(record.variantId, VARIANT_ID_MAX_LENGTH);
  const colourId = parseOptionalToken(record.colourId, VARIANT_ID_MAX_LENGTH);
  const size = parseOptionalToken(record.size, VARIANT_ID_MAX_LENGTH);
  if (!variantId && !colourId) {
    return null;
  }

  const parsed: AddToBagInput = { slug, quantity };
  if (variantId) {
    parsed.variantId = variantId;
  }
  if (colourId) {
    parsed.colourId = colourId;
  }
  if (size) {
    parsed.size = size;
  }
  return parsed;
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

  const variants = product.variants ?? [];
  const variant = resolveSelectedVariant(product, input);
  if (variants.length > 0 && !variant) {
    return { status: "error" };
  }
  if (variant && variant.availability !== "in_stock") {
    return { status: "unavailable", availability: variant.availability };
  }

  const colourId = variant?.colourId ?? input.colourId;
  if (!colourId) {
    return { status: "error" };
  }
  const colour = product.colours.find((item) => item.id === colourId);
  if (!colour) {
    return { status: "error" };
  }
  if (!colour.available) {
    return { status: "unavailable", availability: "out_of_stock" };
  }

  return { status: "ready" };
}

export function resolveSelectedVariant(
  product: Product,
  input: Pick<AddToBagInput, "variantId" | "colourId" | "size">,
): ProductVariant | undefined {
  const variants = product.variants ?? [];
  if (variants.length === 0) {
    return undefined;
  }

  if (input.variantId) {
    if (isDemoVariantId(input.variantId)) {
      return undefined;
    }
    const byId = variants.find((item) => item.id === input.variantId);
    if (!byId) {
      return undefined;
    }
    if (input.colourId && byId.colourId !== input.colourId) {
      return undefined;
    }
    if (input.size && byId.size && byId.size !== input.size) {
      return undefined;
    }
    return byId;
  }

  if (!input.colourId) {
    return undefined;
  }

  const byColour = variants.filter((item) => item.colourId === input.colourId);
  if (input.size) {
    const sized = byColour.filter((item) => item.size === input.size);
    if (sized.length === 1) {
      return sized[0];
    }
    if (sized.length === 0 && byColour.length === 1 && !byColour[0]?.size) {
      return byColour[0];
    }
    return undefined;
  }

  if (byColour.length === 1) {
    return byColour[0];
  }
  return undefined;
}

export function resolveCartVariantId(
  product: Product,
  input: Pick<AddToBagInput, "variantId" | "colourId" | "size">,
): string | null {
  const variants = product.variants ?? [];
  const variant = resolveSelectedVariant(product, input);
  if (variant?.id) {
    return variant.id;
  }
  if (variants.length > 0) {
    return null;
  }
  if (input.variantId && isUuid(input.variantId)) {
    return null;
  }
  if (!input.colourId) {
    return null;
  }
  return demoVariantId(product.id, input.colourId, input.size);
}

function parseOptionalToken(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    return undefined;
  }
  return trimmed;
}
