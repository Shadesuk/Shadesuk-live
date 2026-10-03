import { isShipmentConfirmationStatus, type ShipmentStatus } from "../fulfilment/shipment";
import type { OrderStatus, PaymentStatus } from "./schema";

/** Operational window. The server clock is authoritative. */
export const CANCELLATION_WINDOW_MS = 12 * 60 * 60 * 1000;

export const CANCELLATION_EVENT_REQUESTED = "order_cancellation_requested";
export const CANCELLATION_EVENT_REFUND = "order_cancellation_refund";

export const CANCELLATION_REASONS = [
  "eligible",
  "already_cancelled",
  "window_closed",
  "already_shipped",
  "not_a_purchase",
  "already_adjusted",
] as const;

export type CancellationIneligibleReason = Exclude<(typeof CANCELLATION_REASONS)[number], "eligible">;

export type CancellationDecision =
  | { eligible: true }
  | { eligible: false; reason: CancellationIneligibleReason };

const SHIPPED_ORDER_STATUSES = new Set<OrderStatus>([
  "dispatched",
  "in_transit",
  "out_for_delivery",
  "delivered",
]);

export function isWithinCancellationWindow(createdAt: string, now: Date): boolean {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) {
    return false;
  }
  return now.getTime() - created < CANCELLATION_WINDOW_MS;
}

export function isShippingConfirmationIssued(input: {
  orderStatus: OrderStatus;
  shipmentStatus: ShipmentStatus | null;
  shippedAt: string | null;
}): boolean {
  if (SHIPPED_ORDER_STATUSES.has(input.orderStatus)) {
    return true;
  }
  if (input.shippedAt) {
    return true;
  }
  return input.shipmentStatus != null && isShipmentConfirmationStatus(input.shipmentStatus);
}

/**
 * Customer cancellation closes at the earlier of 12 hours after creation and
 * shipping confirmation. A pending or exception shipment is not confirmation.
 * Failed, unpaid, and checkout attempts are not purchases.
 * This window does not remove statutory UK consumer rights.
 */
export function evaluateCancellationEligibility(input: {
  createdAt: string;
  now?: Date;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  shipmentStatus?: ShipmentStatus | null;
  shippedAt?: string | null;
}): CancellationDecision {
  const now = input.now ?? new Date();
  if (input.paymentStatus === "cancelled" || input.paymentStatus === "refunded") {
    return { eligible: false, reason: "already_cancelled" };
  }
  if (input.paymentStatus === "partially_refunded") {
    return { eligible: false, reason: "already_adjusted" };
  }
  if (input.paymentStatus !== "captured" || input.orderStatus === "checkout") {
    return { eligible: false, reason: "not_a_purchase" };
  }
  if (!isWithinCancellationWindow(input.createdAt, now)) {
    return { eligible: false, reason: "window_closed" };
  }
  if (
    isShippingConfirmationIssued({
      orderStatus: input.orderStatus,
      shipmentStatus: input.shipmentStatus ?? null,
      shippedAt: input.shippedAt ?? null,
    })
  ) {
    return { eligible: false, reason: "already_shipped" };
  }
  return { eligible: true };
}

export function sanitizeCancellationReason(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  return cleaned.length > 0 ? cleaned : null;
}
