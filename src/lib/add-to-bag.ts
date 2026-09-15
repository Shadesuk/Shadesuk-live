import { isProductAvailable } from "@/services/catalogue";
import type { Product } from "@/types/catalogue";
import type { AddToBagInput, AddToBagResult } from "@/types/pdp";

export const ADD_TO_BAG_QUANTITY_MAX = 10;

const OWNERSHIP_KEYS = new Set([
  "sessionid",
  "session_id",
  "cartid",
  "cart_id",
  "userid",
  "user_id",
  "owner",
]);

/**
 * Client may send product selection only. Ownership keys are rejected so a
 * guest session id / cart UUID cannot be smuggled in the action body.
 */
export function parseAddToBagInput(raw: unknown): AddToBagInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (OWNERSHIP_KEYS.has(key.toLowerCase())) {
      return null;
    }
  }
  const slug = typeof record.slug === "string" ? record.slug.trim() : "";
  const colourId = typeof record.colourId === "string" ? record.colourId.trim() : "";
  const quantity = typeof record.quantity === "number" ? record.quantity : Number.NaN;
  if (!slug || !colourId || !Number.isFinite(quantity)) {
    return null;
  }
  return { slug, colourId, quantity };
}

export function toPublicAddToBagResult(result: AddToBagResult): AddToBagResult {
  if (result.status === "unavailable") {
    return { status: "unavailable", availability: result.availability };
  }
  return { status: result.status };
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

  const variant = product.variants?.find((item) => item.colourId === colour.id);
  if (variant && variant.availability !== "in_stock") {
    return { status: "unavailable", availability: variant.availability };
  }

  return { status: "deferred" };
}
