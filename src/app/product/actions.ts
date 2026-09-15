"use server";

import { addToBagAction as addToBagFromCart } from "@/app/cart/actions";
import { getStorefrontProductsByIds } from "@/services/product";
import type { MappedStorefrontProduct } from "@/contracts";
import type { AddToBagInput, PublicAddToBagResult } from "@/types/pdp";

/**
 * Validates selection, binds the guest cart cookie, and writes a cart line
 * keyed by product_variant_id (or an unambiguous colour+size pair).
 * The session id is never returned in this payload.
 */
export async function addToBagAction(
  input: AddToBagInput,
): Promise<PublicAddToBagResult> {
  return addToBagFromCart(input);
}

export async function loadProductsByIdsAction(
  ids: string[],
): Promise<MappedStorefrontProduct[]> {
  return getStorefrontProductsByIds(ids);
}
