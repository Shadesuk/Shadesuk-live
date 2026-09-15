"use server";

import { parseAddToBagInput, toPublicAddToBagResult } from "@/lib/add-to-bag";
import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import {
  addItemToGuestCart,
  getPublicCart,
  removeGuestCartItem,
  updateGuestCartQuantity,
} from "@/services/cart";
import type { CartMutationResult, PublicCart } from "@/types/cart";
import type { AddToBagInput, PublicAddToBagResult } from "@/types/pdp";

export async function addToBagAction(input: AddToBagInput): Promise<PublicAddToBagResult> {
  if (!(await cartActionOriginAllowed())) {
    return { status: "error" };
  }
  const parsed = parseAddToBagInput(input);
  if (!parsed) {
    return { status: "error" };
  }
  return toPublicAddToBagResult(await addItemToGuestCart(parsed));
}

export async function getCartAction(): Promise<CartMutationResult> {
  if (!(await cartActionOriginAllowed())) {
    return { status: "error" };
  }
  const cart = await getPublicCart();
  return { status: "ok", cart };
}

export async function updateCartQuantityAction(input: {
  itemId: string;
  quantity: number;
}): Promise<CartMutationResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error" };
  }
  if (typeof input.itemId !== "string" || typeof input.quantity !== "number") {
    return { status: "error" };
  }
  const cart = await updateGuestCartQuantity(input.itemId, input.quantity);
  if (!cart) {
    return { status: "error" };
  }
  return { status: "ok", cart };
}

export async function removeCartItemAction(input: {
  itemId: string;
}): Promise<CartMutationResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error" };
  }
  if (typeof input.itemId !== "string" || !input.itemId.trim()) {
    return { status: "error" };
  }
  const cart = await removeGuestCartItem(input.itemId);
  if (!cart) {
    return { status: "error" };
  }
  return { status: "ok", cart };
}

export async function loadCart(): Promise<PublicCart> {
  return getPublicCart();
}
