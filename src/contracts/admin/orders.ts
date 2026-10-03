import {
  adminOrderStatusLabel,
  dashboardPeriodRange,
  isOrderStatus,
  isPaymentStatus,
  isShipmentStatus,
} from "./dashboard";
import { toGuestDeliveryAddress, type GuestDeliveryAddressView } from "../order/dto";
import { isOrderReference, parseOrderReferenceInput } from "../order/reference";
import { isLegalOrderStatusTransition, legalOrderStatusTargets } from "../order/status";
import { isCommittedPurchase, COMMITTED_PURCHASE_PAYMENT_STATUSES } from "../order/lifecycle";
import { ORDER_REFUND_MARKED_EVENT } from "../order/cancellation";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type OrderStatus,
  type PaymentStatus,
  type RefundStatus,
} from "../order/schema";
import {
  AWAITING_FULFILMENT_ORDER_STATUSES,
  AWAITING_FULFILMENT_PAYMENT_STATUS,
  resolveDispatchShipmentStatus,
} from "../fulfilment/dispatch";
import { SHIPMENT_STATUSES, type ShipmentStatus } from "../fulfilment/shipment";
import { safeHttpUrl } from "@/lib/tracking-url";

export const ADMIN_ORDERS_PAGE_SIZE = 20;
export const ADMIN_ORDER_SEARCH_MAX = 80;
export const ADMIN_FULFILMENT_TEXT_MAX = 80;
export const ADMIN_TRACKING_URL_MAX = 500;

export const ADMIN_ORDER_LIST_PERIODS = ["all", "today", "7d", "30d"] as const;
export type AdminOrderListPeriod = (typeof ADMIN_ORDER_LIST_PERIODS)[number];

export const ADMIN_SHIPMENT_STATUS_LABELS = {
  pending: "Pending",
  dispatched: "Dispatched",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  exception: "Exception",
  tracking_unavailable: "Tracking unavailable",
} as const satisfies Record<ShipmentStatus, string>;

export const ADMIN_ORDER_EVENT_TYPES = {
  statusChanged: "order_status_changed",
  shipmentCreated: "shipment_created",
  shipmentUpdated: "shipment_updated",
} as const;

export type AdminOrderEventType =
  (typeof ADMIN_ORDER_EVENT_TYPES)[keyof typeof ADMIN_ORDER_EVENT_TYPES];

export const ADMIN_FULFILMENT_FILTERS = ["awaiting"] as const;
export type AdminFulfilmentFilter = (typeof ADMIN_FULFILMENT_FILTERS)[number];

export const ADMIN_DISPATCH_CARRIER_ERROR = "Enter a carrier.";
export const ADMIN_DISPATCH_UNPAID_ERROR = "Only paid orders can be dispatched.";
export const ADMIN_DISPATCH_BLOCKED_ERROR = "This order can’t be dispatched from its current status.";
export const DISPATCH_TRACKING_UNAVAILABLE_DESCRIPTION = "Tracking information is not available yet.";

export type AdminOrderListQuery = {
  q: string;
  status: OrderStatus | null;
  payment: PaymentStatus | null;
  fulfilment: AdminFulfilmentFilter | null;
  period: AdminOrderListPeriod;
  page: number;
};

export type AdminOrderListItem = {
  id: string;
  orderReference: string;
  customerName: string;
  customerEmail: string;
  guest: boolean;
  createdAt: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  totalMinor: number;
  cancelledAt?: string | null;
  refundStatus?: RefundStatus | null;
};

export type AdminOrderItemView = {
  id: string;
  productName: string;
  colourName: string;
  variantName: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
};

export type AdminTrackingEventView = {
  id: string;
  status: ShipmentStatus;
  description: string | null;
  occurredAt: string;
};

export type AdminShipmentView = {
  id: string;
  carrierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentStatus;
  events: AdminTrackingEventView[];
};

export type AdminOrderEventView = {
  id: string;
  eventType: string;
  label: string;
  oldStatus: OrderStatus | null;
  newStatus: OrderStatus | null;
  createdAt: string;
};

export type AdminOrderDetailView = {
  id: string;
  orderReference: string;
  createdAt: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  guest: boolean;
  customerName: string;
  customerEmail: string;
  delivery: GuestDeliveryAddressView | null;
  items: AdminOrderItemView[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  shipment: AdminShipmentView | null;
  events: AdminOrderEventView[];
  statusTargets: OrderStatus[];
  cancelledAt: string | null;
  refundStatus: RefundStatus | null;
  refundAmountMinor: number | null;
  refundPaymentReference: string | null;
  refundMarkedAt: string | null;
  refundMarkedBy: string | null;
};

export type AdminFulfilmentInput = {
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string;
  status: ShipmentStatus;
};

export type AdminFulfilmentField = "carrierName" | "trackingNumber" | "trackingUrl" | "status";

export function parseAdminOrderListQuery(
  params: Record<string, string | string[] | undefined>,
): AdminOrderListQuery {
  const q = sanitizeAdminOrderSearch(readParam(params.q));
  const statusRaw = readParam(params.status);
  const paymentRaw = readParam(params.payment);
  const periodRaw = readParam(params.period);
  const pageRaw = Number.parseInt(readParam(params.page) || "1", 10);
  const fulfilmentRaw = readParam(params.fulfilment);
  return {
    q,
    status: isOrderStatus(statusRaw) ? statusRaw : null,
    payment: isPaymentStatus(paymentRaw) ? paymentRaw : null,
    fulfilment: isAdminFulfilmentFilter(fulfilmentRaw) ? fulfilmentRaw : null,
    period: isAdminOrderListPeriod(periodRaw) ? periodRaw : "all",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export function adminOrderListQueryString(query: AdminOrderListQuery, page = query.page): string {
  const params = new URLSearchParams();
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.payment) {
    params.set("payment", query.payment);
  }
  if (query.fulfilment) {
    params.set("fulfilment", query.fulfilment);
  }
  if (query.period !== "all") {
    params.set("period", query.period);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function adminOrderListPeriodRange(
  period: AdminOrderListPeriod,
  now = new Date(),
): { startIso: string; endIso: string } | null {
  if (period === "all") {
    return null;
  }
  return dashboardPeriodRange(period, now);
}

export function sanitizeAdminOrderSearch(value: string): string {
  return value
    .trim()
    .slice(0, ADMIN_ORDER_SEARCH_MAX)
    .replace(/["\\,()%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function adminOrderSearchReference(value: string): string | null {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  if (isOrderReference(compact)) {
    return compact;
  }
  return parseOrderReferenceInput(value);
}

export function isAdminOrderListPeriod(value: string | null | undefined): value is AdminOrderListPeriod {
  return value === "all" || value === "today" || value === "7d" || value === "30d";
}

export function isAdminFulfilmentFilter(value: string | null | undefined): value is AdminFulfilmentFilter {
  return value === "awaiting";
}

export function adminShipmentStatusLabel(status: ShipmentStatus): string {
  return ADMIN_SHIPMENT_STATUS_LABELS[status];
}

export function adminOrderEventLabel(eventType: string): string {
  if (eventType === ADMIN_ORDER_EVENT_TYPES.statusChanged) {
    return "Status changed";
  }
  if (eventType === ADMIN_ORDER_EVENT_TYPES.shipmentCreated) {
    return "Shipment recorded";
  }
  if (eventType === ADMIN_ORDER_EVENT_TYPES.shipmentUpdated) {
    return "Shipment updated";
  }
  if (eventType === "order_cancellation_requested") {
    return "Cancellation requested";
  }
  if (eventType === "order_cancellation_refund") {
    return "Cancellation refund";
  }
  if (eventType === ORDER_REFUND_MARKED_EVENT) {
    return "Refund marked";
  }
  return "Event recorded";
}

export function parseAdminFulfilmentInput(input: {
  carrierName: unknown;
  trackingNumber: unknown;
  trackingUrl: unknown;
  status: unknown;
}): { ok: true; value: AdminFulfilmentInput } | { ok: false; errors: Partial<Record<AdminFulfilmentField, string>> } {
  const errors: Partial<Record<AdminFulfilmentField, string>> = {};
  const carrierName = readOptionalText(input.carrierName, ADMIN_FULFILMENT_TEXT_MAX);
  const trackingNumber = parseTrackingNumber(input.trackingNumber);
  if (!trackingNumber.ok) {
    errors.trackingNumber = trackingNumber.error;
  }
  const trackingUrl = parseTrackingUrl(input.trackingUrl);
  if (!trackingUrl.ok) {
    errors.trackingUrl = trackingUrl.error;
  }
  if (!isShipmentStatus(input.status)) {
    errors.status = "Choose a valid shipment status.";
  }
  if (Object.keys(errors).length > 0 || !isShipmentStatus(input.status) || !trackingNumber.ok || !trackingUrl.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      carrierName,
      trackingNumber: trackingNumber.value,
      trackingUrl: trackingUrl.value,
      status: input.status,
    },
  };
}

export type AdminDispatchInput = {
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string;
  shipmentStatus: ShipmentStatus;
};

export function parseAdminDispatchInput(input: {
  carrierName: unknown;
  trackingNumber: unknown;
  trackingUrl: unknown;
}): { ok: true; value: AdminDispatchInput } | { ok: false; errors: Partial<Record<AdminFulfilmentField, string>> } {
  const errors: Partial<Record<AdminFulfilmentField, string>> = {};
  const carrierName = readOptionalText(input.carrierName, ADMIN_FULFILMENT_TEXT_MAX);
  if (!carrierName) {
    errors.carrierName = ADMIN_DISPATCH_CARRIER_ERROR;
  }
  const trackingNumber = parseTrackingNumber(input.trackingNumber);
  if (!trackingNumber.ok) {
    errors.trackingNumber = trackingNumber.error;
  }
  const trackingUrl = parseTrackingUrl(input.trackingUrl);
  if (!trackingUrl.ok) {
    errors.trackingUrl = trackingUrl.error;
  }
  if (Object.keys(errors).length > 0 || !trackingNumber.ok || !trackingUrl.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      carrierName,
      trackingNumber: trackingNumber.value,
      trackingUrl: trackingUrl.value,
      shipmentStatus: resolveDispatchShipmentStatus(trackingNumber.value),
    },
  };
}

export function awaitingFulfilmentListConflict(query: AdminOrderListQuery): boolean {
  if (query.fulfilment !== "awaiting") {
    return false;
  }
  if (query.payment && query.payment !== AWAITING_FULFILMENT_PAYMENT_STATUS) {
    return true;
  }
  if (
    query.status &&
    !(AWAITING_FULFILMENT_ORDER_STATUSES as readonly OrderStatus[]).includes(query.status)
  ) {
    return true;
  }
  return false;
}

export function isUnchangedAdminFulfilment(
  existing: {
    carrierName: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    status: ShipmentStatus;
  },
  next: AdminFulfilmentInput,
): boolean {
  return (
    (existing.carrierName ?? "") === next.carrierName &&
    (existing.trackingNumber ?? "") === next.trackingNumber &&
    (safeHttpUrl(existing.trackingUrl) ?? "") === next.trackingUrl &&
    existing.status === next.status
  );
}

export function parseAdminOrderStatusInput(
  from: OrderStatus,
  next: unknown,
): { ok: true; status: OrderStatus } | { ok: false } {
  if (!isOrderStatus(next)) {
    return { ok: false };
  }
  if (!isLegalOrderStatusTransition(from, next)) {
    return { ok: false };
  }
  return { ok: true, status: next };
}

export function adminOrderStatusOptions(from: OrderStatus): OrderStatus[] {
  return legalOrderStatusTargets(from);
}

export { COMMITTED_PURCHASE_PAYMENT_STATUSES, isCommittedPurchase };

/** Unpaid historical `placed` rows and new `checkout` rows are not confirmed orders. */
export function reportedAdminOrderStatusLabel(
  orderStatus: OrderStatus,
  paymentStatus: PaymentStatus,
): string {
  if (
    !isCommittedPurchase(paymentStatus) &&
    (orderStatus === "placed" || orderStatus === "checkout")
  ) {
    return adminOrderStatusLabel("checkout");
  }
  return adminOrderStatusLabel(orderStatus);
}

export function adminOrderCustomerLabel(
  name: string,
  guest: boolean,
  guestLabel: string,
  emptyLabel = "—",
): string {
  const trimmed = name.trim();
  if (trimmed) {
    return guest ? `${trimmed} · ${guestLabel}` : trimmed;
  }
  return guest ? guestLabel : emptyLabel;
}

export function mapAdminDelivery(address: Record<string, unknown> | null | undefined): GuestDeliveryAddressView | null {
  return toGuestDeliveryAddress(address);
}

export { ORDER_STATUSES, PAYMENT_STATUSES, SHIPMENT_STATUSES, legalOrderStatusTargets };

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }
  return typeof value === "string" ? value : "";
}

function readOptionalText(value: unknown, max: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function parseTrackingUrl(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  const trackingRaw = typeof value === "string" ? value.trim() : "";
  if (!trackingRaw) {
    return { ok: true, value: "" };
  }
  if (trackingRaw.length > ADMIN_TRACKING_URL_MAX) {
    return { ok: false, error: "Enter a shorter tracking URL." };
  }
  const safe = safeHttpUrl(trackingRaw);
  if (!safe) {
    return { ok: false, error: "Enter a valid https tracking URL." };
  }
  return { ok: true, value: safe };
}

function parseTrackingNumber(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  const trackingNumber = readOptionalText(value, ADMIN_FULFILMENT_TEXT_MAX);
  if (!trackingNumber) {
    return { ok: true, value: "" };
  }
  if (/[:<>]/.test(trackingNumber)) {
    return { ok: false, error: "Enter a valid tracking number." };
  }
  return { ok: true, value: trackingNumber };
}
