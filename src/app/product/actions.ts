"use server";

import {
  getStorefrontProductsByIds,
  prepareAddToBag,
} from "@/services/product";
import type { MappedStorefrontProduct } from "@/contracts";
import type { AddToBagInput, AddToBagResult } from "@/types/pdp";

export async function addToBagAction(input: AddToBagInput): Promise<AddToBagResult> {
  return prepareAddToBag(input);
}

export async function loadProductsByIdsAction(
  ids: string[],
): Promise<MappedStorefrontProduct[]> {
  return getStorefrontProductsByIds(ids);
}
