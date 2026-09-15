import type { Availability } from "@/types/catalogue";
import { lineTotalMinor, minorToMajorGbp, STORE_CURRENCY } from "../money";
import type { CartItemRow, CartRow, CartStatus } from "./schema";
import type { CartOwner } from "./session";

/**
 * Storefront cart view. Display money is major units; authority remains minor.
 * `unitPriceMinor` is the snapshotted add-to-bag price and must be revalidated
 * against the live variant before payment.
 */
export type CartItemView = {
  id: string;
  variantId: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  unitPrice: number;
  lineTotal: number;
  currency: typeof STORE_CURRENCY;
};

export type CartRevalidationIssue =
  | "price_changed"
  | "variant_unavailable"
  | "product_removed"
  | "quantity_exceeds_stock";

export type CartItemReconciliation = {
  itemId: string;
  variantId: string;
  issue: CartRevalidationIssue;
  liveUnitPriceMinor?: number;
  liveAvailability?: Availability;
};

export type CartView = {
  id: string;
  owner: CartOwner;
  status: CartStatus;
  currency: typeof STORE_CURRENCY;
  items: CartItemView[];
  subtotalMinor: number;
  subtotal: number;
  issues: CartItemReconciliation[];
};

export type CartMergeConflict =
  | "same_variant_quantities_summed"
  | "variant_sold_out_dropped"
  | "quantity_capped_to_stock"
  | "price_changed_retained_pending_revalidation"
  | "product_removed_dropped";

/**
 * Locked merge policy for 3.6 / 3.7. Guest lines move onto the account cart.
 * Never drop a guest line silently: every drop is a conflict the UI must show.
 */
export const CART_MERGE_POLICY = {
  sameVariant: "sum_quantities_then_cap_to_stock",
  soldOut: "drop_with_notice",
  priceChanged: "keep_line_revalidate_before_payment",
  productRemoved: "drop_with_notice",
  guestCartAfterMerge: "converted",
} as const;

export function toCartItemView(row: CartItemRow): CartItemView {
  const line = lineTotalMinor(row.unit_price_minor, row.quantity);
  return {
    id: row.id,
    variantId: row.product_variant_id,
    quantity: row.quantity,
    unitPriceMinor: row.unit_price_minor,
    lineTotalMinor: line,
    unitPrice: minorToMajorGbp(row.unit_price_minor),
    lineTotal: minorToMajorGbp(line),
    currency: STORE_CURRENCY,
  };
}

export function toCartView(input: {
  cart: CartRow;
  items: CartItemRow[];
  owner: CartOwner;
  issues?: CartItemReconciliation[];
}): CartView {
  const items = input.items.map(toCartItemView);
  const subtotalMinor = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  return {
    id: input.cart.id,
    owner: input.owner,
    status: input.cart.status,
    currency: STORE_CURRENCY,
    items,
    subtotalMinor,
    subtotal: minorToMajorGbp(subtotalMinor),
    issues: input.issues ?? [],
  };
}

export function assertCartOwnerMatchesRow(cart: CartRow, owner: CartOwner): boolean {
  if (owner.kind === "guest") {
    return cart.user_id === null && cart.session_id === owner.sessionId;
  }
  return cart.session_id === null && cart.user_id === owner.userId;
}
