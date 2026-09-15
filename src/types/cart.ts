import type { CartRevalidationIssue } from "@/contracts";

export const EMPTY_PUBLIC_CART: PublicCart = {
  items: [],
  itemCount: 0,
  subtotal: 0,
  currency: "GBP",
  issues: [],
};

export type PublicCartImage = {
  alt: string;
  width: number;
  height: number;
  src?: string;
};

export type PublicCartItem = {
  id: string;
  productId: string;
  slug: string;
  name: string;
  href: string;
  colourName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  currency: "GBP";
  sizeName?: string;
  image?: PublicCartImage;
  issue?: CartRevalidationIssue;
};

export type PublicCartIssue = {
  issue: CartRevalidationIssue;
  message: string;
  itemId?: string;
};

export type PublicCart = {
  items: PublicCartItem[];
  itemCount: number;
  subtotal: number;
  currency: "GBP";
  issues: PublicCartIssue[];
};

export type CartMutationResult =
  | { status: "ok"; cart: PublicCart }
  | { status: "error" };
