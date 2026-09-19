import {
  dashboardPeriodRange,
  isOrderStatus,
  isPaymentStatus,
  isShipmentStatus,
} from "./dashboard";
import { toGuestDeliveryAddress, type GuestDeliveryAddressView } from "../order/dto";
import { isOrderReference, parseOrderReferenceInput } from "../order/reference";
import { isLegalOrderStatusTransition, legalOrderStatusTargets } from "../order/status";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type OrderStatus,
  type PaymentStatus,
} from "../order/schema";
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

export type AdminOrderListQuery = {
  q: string;
  status: OrderStatus | null;
  payment: PaymentStatus | null;
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
  return {
    q,
    status: isOrderStatus(statusRaw) ? statusRaw : null,
    payment: isPaymentStatus(paymentRaw) ? paymentRaw : null,
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
  const trackingRaw = typeof input.trackingUrl === "string" ? input.trackingUrl.trim() : "";
  let trackingUrl = "";
  if (trackingRaw) {
    if (trackingRaw.length > ADMIN_TRACKING_URL_MAX) {
      errors.trackingUrl = "Enter a shorter tracking URL.";
    } else {
      const safe = safeHttpUrl(trackingRaw);
      if (!safe) {
        errors.trackingUrl = "Enter a valid https tracking URL.";
      } else {
        trackingUrl = safe;
      }
    }
  }
  if (!isShipmentStatus(input.status)) {
    errors.status = "Choose a valid shipment status.";
  }
  if (Object.keys(errors).length > 0 || !isShipmentStatus(input.status) || !trackingNumber.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      carrierName,
      trackingNumber: trackingNumber.value,
      trackingUrl,
      status: input.status,
    },
  };
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

function parseTrackingNumber(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  const trackingNumber = readOptionalText(value, ADMIN_FULFILMENT_TEXT_MAX);
  if (!trackingNumber) {
    return { ok: true, value: "" };
  }
  if (trackingNumber.includes("://") || /[<>]/.test(trackingNumber)) {
    return { ok: false, error: "Enter a valid tracking number." };
  }
  return { ok: true, value: trackingNumber };
}
