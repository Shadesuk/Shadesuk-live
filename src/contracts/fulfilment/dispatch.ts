import { isCancellationDispatchLock } from "../order/cancellation";
import type { OrderStatus, PaymentStatus } from "../order/schema";
import { ORDER_STATUSES } from "../order/schema";
import { isLegalOrderStatusTransition } from "../order/status";
import type { ShipmentStatus } from "./shipment";

/** Paid orders still before dispatch. Not a new order-status enum value. */
export const AWAITING_FULFILMENT_PAYMENT_STATUS = "captured" as const satisfies PaymentStatus;

export const AWAITING_FULFILMENT_ORDER_STATUSES = ["placed", "processing"] as const satisfies readonly OrderStatus[];

const PAST_DISPATCH = new Set<ShipmentStatus>([
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
]);

const DISPATCH_CONFIRMATION_ORDER_STATUSES = new Set<OrderStatus>([
  "dispatched",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "tracking_unavailable",
]);

export function isDispatchConfirmationOrderStatus(status: OrderStatus): boolean {
  return DISPATCH_CONFIRMATION_ORDER_STATUSES.has(status);
}

export function isAwaitingFulfilment(order: {
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  cancelledAt?: string | null;
  refundStatus?: string | null;
}): boolean {
  if (isCancellationDispatchLock(order)) {
    return false;
  }
  return (
    order.paymentStatus === AWAITING_FULFILMENT_PAYMENT_STATUS &&
    (AWAITING_FULFILMENT_ORDER_STATUSES as readonly OrderStatus[]).includes(order.orderStatus)
  );
}

export function isShipmentPastDispatch(status: ShipmentStatus): boolean {
  return PAST_DISPATCH.has(status);
}

/** Shared labels only. `pending` has no order-status equivalent. */
export function orderStatusForShipment(status: ShipmentStatus): OrderStatus | null {
  if (status === "pending") {
    return null;
  }
  return status;
}

/**
 * Shortest legal staff path, excluding the starting status.
 * `[]` means already there. `null` means the existing state machine cannot reach it.
 */
export function legalOrderStatusPath(from: OrderStatus, to: OrderStatus): OrderStatus[] | null {
  if (from === to) {
    return [];
  }
  const queue: OrderStatus[][] = [[from]];
  const seen = new Set<OrderStatus>([from]);
  while (queue.length > 0) {
    const path = queue.shift();
    if (!path) {
      break;
    }
    const current = path[path.length - 1];
    if (!current) {
      break;
    }
    for (const next of ORDER_STATUSES) {
      if (next === current || seen.has(next) || !isLegalOrderStatusTransition(current, next)) {
        continue;
      }
      const nextPath = [...path, next];
      if (next === to) {
        return nextPath.slice(1);
      }
      seen.add(next);
      queue.push(nextPath);
    }
  }
  return null;
}

/** Missing tracking is a normal shipment state, not a failed dispatch. */
export function resolveDispatchShipmentStatus(trackingNumber: string): ShipmentStatus {
  return trackingNumber.trim() ? "dispatched" : "tracking_unavailable";
}

export function canDispatchOrder(input: {
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  shipmentStatus: ShipmentStatus | null;
  cancelledAt?: string | null;
  refundStatus?: string | null;
}): boolean {
  if (isCancellationDispatchLock(input)) {
    return false;
  }
  if (input.paymentStatus !== AWAITING_FULFILMENT_PAYMENT_STATUS) {
    return false;
  }
  if (input.shipmentStatus && isShipmentPastDispatch(input.shipmentStatus)) {
    return false;
  }
  if (
    legalOrderStatusPath(input.orderStatus, "dispatched") === null &&
    legalOrderStatusPath(input.orderStatus, "tracking_unavailable") === null
  ) {
    return false;
  }
  return true;
}

export function isIdempotentDispatch(
  existing: {
    carrierName: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    status: ShipmentStatus;
  } | null,
  next: {
    carrierName: string;
    trackingNumber: string;
    trackingUrl: string;
    shipmentStatus: ShipmentStatus;
  },
): boolean {
  if (!existing) {
    return false;
  }
  if (isShipmentPastDispatch(existing.status)) {
    return true;
  }
  return (
    (existing.carrierName ?? "") === next.carrierName &&
    (existing.trackingNumber ?? "") === next.trackingNumber &&
    (existing.trackingUrl ?? "") === next.trackingUrl &&
    existing.status === next.shipmentStatus
  );
}
