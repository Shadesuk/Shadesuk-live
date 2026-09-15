import type { Availability } from "@/types/catalogue";
import type { PublicCart } from "@/types/cart";

export type ProductDataSource = "live" | "demo";

/**
 * Line identity is `variantId` (preferred) or an unambiguous colour+size pair.
 * Colour alone is not unique on live catalogue rows that share a colour across sizes.
 */
export type AddToBagInput = {
  slug: string;
  quantity: number;
  variantId?: string;
  colourId?: string;
  size?: string;
};

export type AddToBagResult =
  | { status: "added"; cart: PublicCart }
  | { status: "ready" }
  | { status: "unavailable"; availability: Availability }
  | { status: "error" };

export type PublicAddToBagResult =
  | { status: "added"; cart: PublicCart }
  | { status: "unavailable"; availability: Availability }
  | { status: "error" };
