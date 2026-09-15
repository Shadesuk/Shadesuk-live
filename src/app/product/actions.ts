"use server";

import {
  parseAddToBagInput,
  toPublicAddToBagResult,
} from "@/lib/add-to-bag";
import { ensureGuestCartSessionCookie } from "@/lib/guest-cart-cookie";
import {
  getStorefrontProductsByIds,
  prepareAddToBag,
} from "@/services/product";
import type { MappedStorefrontProduct } from "@/contracts";
import type { AddToBagInput, AddToBagResult } from "@/types/pdp";

/**
 * Validates selection and, on success, binds a guest cart session via the
 * httpOnly cookie (PR #13). Cart rows are not written here (3.6). The session
 * id is never returned in this payload.
 */
export async function addToBagAction(input: AddToBagInput): Promise<AddToBagResult> {
  const parsed = parseAddToBagInput(input);
  if (!parsed) {
    return { status: "error" };
  }

  const result = toPublicAddToBagResult(await prepareAddToBag(parsed));
  if (result.status === "deferred") {
    await ensureGuestCartSessionCookie();
  }
  return result;
}

export async function loadProductsByIdsAction(
  ids: string[],
): Promise<MappedStorefrontProduct[]> {
  return getStorefrontProductsByIds(ids);
}
