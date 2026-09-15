import { isProductAvailable } from "@/services/catalogue";
import type { Product } from "@/types/catalogue";
import type { AddToBagInput, AddToBagResult } from "@/types/pdp";

export const ADD_TO_BAG_QUANTITY_MAX = 10;

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
