import type { Availability } from "@/types/catalogue";
import type { PublicCart } from "@/types/cart";

export type ProductDataSource = "live" | "demo";

export type AddToBagInput = {
  slug: string;
  colourId: string;
  quantity: number;
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
