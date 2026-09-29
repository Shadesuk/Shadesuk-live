export const ORDER_STATUSES = [
  "placed",
  "processing",
  "dispatched",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
  "tracking_unavailable",
  "checkout",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "created",
  "authorized",
  "captured",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type OrderRow = {
  id: string;
  order_reference: string;
  user_id: string | null;
  customer_email: string;
  customer_first_name: string;
  customer_last_name: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  currency: "GBP";
  subtotal_minor: number;
  shipping_minor: number;
  total_minor: number;
  delivery_address: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_variant_id: string | null;
  sku: string;
  product_name: string;
  colour_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
  product_snapshot: Record<string, unknown> | null;
  created_at: string;
};

export type OrderEventRow = {
  id: string;
  order_id: string;
  event_type: string;
  old_status: OrderStatus | null;
  new_status: OrderStatus | null;
  actor_user_id: string | null;
  metadata: Record<string, unknown> | null;
  customer_visible: boolean;
  created_at: string;
};
