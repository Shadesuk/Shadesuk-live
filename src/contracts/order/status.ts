import type { OrderStatus } from "./schema";

/** Customer-facing labels from account_order_tracking.md. */
export const CUSTOMER_ORDER_STATUS_LABELS = {
  placed: "ORDER PLACED",
  processing: "PROCESSING",
  dispatched: "DISPATCHED",
  in_transit: "IN TRANSIT",
  out_for_delivery: "OUT FOR DELIVERY",
  delivered: "DELIVERED",
  exception: "EXCEPTION",
  tracking_unavailable: "TRACKING NOT AVAILABLE",
} as const satisfies Record<OrderStatus, string>;

export type CustomerOrderStatusLabel =
  (typeof CUSTOMER_ORDER_STATUS_LABELS)[OrderStatus];

const FORWARD: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  placed: ["processing", "exception"],
  processing: ["dispatched", "exception", "tracking_unavailable"],
  dispatched: ["in_transit", "exception", "tracking_unavailable"],
  in_transit: ["out_for_delivery", "delivered", "exception"],
  out_for_delivery: ["delivered", "exception"],
  tracking_unavailable: ["dispatched", "in_transit", "exception"],
  exception: ["processing", "in_transit", "out_for_delivery", "delivered"],
};

export function isLegalOrderStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return FORWARD[from]?.includes(to) ?? false;
}

export function customerOrderStatusLabel(status: OrderStatus): CustomerOrderStatusLabel {
  return CUSTOMER_ORDER_STATUS_LABELS[status];
}
