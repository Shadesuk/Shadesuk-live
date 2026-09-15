export const CART_STATUSES = [
  "active",
  "converted",
  "abandoned",
  "expired",
] as const;
export type CartStatus = (typeof CART_STATUSES)[number];

export type CartRow = {
  id: string;
  user_id: string | null;
  session_id: string | null;
  status: CartStatus;
  currency: "GBP";
  created_at: string;
  updated_at: string;
};

export type CartItemRow = {
  id: string;
  cart_id: string;
  product_variant_id: string;
  quantity: number;
  unit_price_minor: number;
  created_at: string;
  updated_at: string;
};

export type CartAggregate = {
  cart: CartRow;
  items: CartItemRow[];
};
