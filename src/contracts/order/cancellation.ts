import { isShipmentConfirmationStatus, type ShipmentStatus } from "../fulfilment/shipment";
import { isRefundStatus, type OrderStatus, type PaymentStatus, type RefundStatus } from "./schema";

/** Operational window. The server clock is authoritative. */
export const CANCELLATION_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Display deadline for a manual refund. The state does not change when this passes. */
export const REFUND_DEADLINE_MS = 3 * 24 * 60 * 60 * 1000;

/** Inside the last day of the 3-day window the alert is approaching, not overdue. */
export const REFUND_APPROACHING_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

export const CANCELLATION_EVENT_REQUESTED = "order_cancellation_requested";
export const CANCELLATION_EVENT_REFUND = "order_cancellation_refund";
export const ORDER_REFUND_MARKED_EVENT = "order_refund_marked";

export const REFUND_URGENCIES = ["pending", "approaching", "overdue"] as const;
export type RefundUrgency = (typeof REFUND_URGENCIES)[number];

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
 * Failed payments and checkout attempts are not cancellable purchases.
 * An unpaid placed order can be cancelled and does not create a refund obligation.
 * This window does not remove statutory UK consumer rights.
 */
export function evaluateCancellationEligibility(input: {
  createdAt: string;
  now?: Date;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  shipmentStatus?: ShipmentStatus | null;
  shippedAt?: string | null;
  cancelledAt?: string | null;
  refundStatus?: RefundStatus | null;
}): CancellationDecision {
  const now = input.now ?? new Date();
  if (
    input.cancelledAt ||
    input.refundStatus === "refund_pending" ||
    input.refundStatus === "refunded" ||
    input.paymentStatus === "cancelled" ||
    input.paymentStatus === "refunded"
  ) {
    return { eligible: false, reason: "already_cancelled" };
  }
  if (input.paymentStatus === "partially_refunded") {
    return { eligible: false, reason: "already_adjusted" };
  }
  if (
    input.orderStatus === "checkout" ||
    (input.paymentStatus !== "captured" &&
      input.paymentStatus !== "created" &&
      input.paymentStatus !== "authorized")
  ) {
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

export type CancellationSettlement =
  | { orderState: "cancelled"; refundStatus: "refund_pending" }
  | { orderState: "cancelled"; refundStatus: null };

/**
 * Paid capture becomes a manual refund obligation. Unpaid cancellation does not.
 * Neither outcome marks the refund as completed.
 */
export function cancellationSettlement(paymentStatus: PaymentStatus): CancellationSettlement | null {
  if (paymentStatus === "captured") {
    return { orderState: "cancelled", refundStatus: "refund_pending" };
  }
  if (paymentStatus === "created" || paymentStatus === "authorized") {
    return { orderState: "cancelled", refundStatus: null };
  }
  return null;
}

/** Account and guest actions may reach the cancellation RPC for these payments. */
export function isCustomerCancellationAttemptAllowed(
  paymentStatus: string | null | undefined,
): boolean {
  return (
    paymentStatus === "captured" ||
    paymentStatus === "created" ||
    paymentStatus === "authorized" ||
    paymentStatus === "cancelled" ||
    paymentStatus === "refunded" ||
    paymentStatus === "partially_refunded"
  );
}

/**
 * A cancelled or refund-tracked order cannot be dispatched, even when payment
 * still reads as captured. This does not contact PayPal.
 */
export function isCancellationDispatchLock(input: {
  cancelledAt?: string | null;
  refundStatus?: RefundStatus | string | null;
}): boolean {
  return (
    Boolean(input.cancelledAt) ||
    input.refundStatus === "refund_pending" ||
    input.refundStatus === "refunded"
  );
}

export function refundDueAt(cancelledAt: string): Date | null {
  const cancelled = Date.parse(cancelledAt);
  if (!Number.isFinite(cancelled)) {
    return null;
  }
  return new Date(cancelled + REFUND_DEADLINE_MS);
}

export function refundObligationUrgency(cancelledAt: string, now: Date): RefundUrgency | null {
  const cancelled = Date.parse(cancelledAt);
  if (!Number.isFinite(cancelled)) {
    return null;
  }
  const elapsed = now.getTime() - cancelled;
  if (elapsed >= REFUND_DEADLINE_MS) {
    return "overdue";
  }
  if (elapsed >= REFUND_APPROACHING_AFTER_MS) {
    return "approaching";
  }
  return "pending";
}

export function isPendingRefundAlert(refundStatus: RefundStatus | string | null | undefined): boolean {
  return refundStatus === "refund_pending";
}

export function countPendingRefundAlerts(
  rows: ReadonlyArray<{ refundStatus: RefundStatus | string | null | undefined }>,
): number {
  return rows.filter((row) => isPendingRefundAlert(row.refundStatus)).length;
}

export type PendingRefundAlert = {
  id: string;
  orderReference: string;
  amountMinor: number;
  cancelledAt: string;
  dueAt: string;
  urgency: RefundUrgency;
  href: string;
};

export function toPendingRefundAlert(input: {
  id: string;
  orderReference: string;
  amountMinor: number;
  cancelledAt: string;
  now?: Date;
  href: string;
}): PendingRefundAlert | null {
  if (!input.id || !input.orderReference.trim() || !Number.isInteger(input.amountMinor) || input.amountMinor < 0) {
    return null;
  }
  const due = refundDueAt(input.cancelledAt);
  const urgency = refundObligationUrgency(input.cancelledAt, input.now ?? new Date());
  if (!due || !urgency) {
    return null;
  }
  return {
    id: input.id,
    orderReference: input.orderReference.trim(),
    amountMinor: input.amountMinor,
    cancelledAt: input.cancelledAt,
    dueAt: due.toISOString(),
    urgency,
    href: input.href,
  };
}

export type MarkRefundedDecision =
  | { ok: true; duplicate: boolean }
  | { ok: false; reason: "unauthorized" | "not_cancelled" | "not_pending" };

/**
 * Admin confirmation is the only path from REFUND_PENDING to REFUNDED.
 * An order that is already REFUNDED is a no-op and must not record a second event.
 */
export function decideMarkRefunded(input: {
  actorIsAdmin: boolean;
  cancelledAt: string | null;
  refundStatus: RefundStatus | null;
}): MarkRefundedDecision {
  if (!input.actorIsAdmin) {
    return { ok: false, reason: "unauthorized" };
  }
  if (input.refundStatus === "refunded" && input.cancelledAt) {
    return { ok: true, duplicate: true };
  }
  if (!input.cancelledAt) {
    return { ok: false, reason: "not_cancelled" };
  }
  if (input.refundStatus !== "refund_pending") {
    return { ok: false, reason: "not_pending" };
  }
  return { ok: true, duplicate: false };
}

export function shouldRecordRefundMarkedEvent(decision: MarkRefundedDecision): boolean {
  return decision.ok && !decision.duplicate;
}

export function readRefundStatus(value: unknown): RefundStatus | null {
  return isRefundStatus(value) ? value : null;
}

export function sanitizeCancellationReason(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  return cleaned.length > 0 ? cleaned : null;
}
