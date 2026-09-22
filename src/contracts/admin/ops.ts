import {
  AWAITING_FULFILMENT_ORDER_STATUSES,
  AWAITING_FULFILMENT_PAYMENT_STATUS,
  isAwaitingFulfilment,
} from "@/contracts/fulfilment/dispatch";
import { SHIPMENT_STATUSES, type ShipmentStatus } from "@/contracts/fulfilment/shipment";
import type { OrderStatus, PaymentStatus } from "@/contracts/order/schema";
import { routes } from "@/lib/navigation";

/**
 * Available variants with this many units still on hand are low stock.
 * Zero is out of stock, not low. Draft and unavailable variants are ignored.
 */
export const LOW_STOCK_THRESHOLD = 5;

export function inventoryStockDescription(): string {
  return `Available variants only. Low stock is 1–${LOW_STOCK_THRESHOLD} units. Out of stock is zero.`;
}

export function lowStockEmptyBody(): string {
  return `Available variants with 1–${LOW_STOCK_THRESHOLD} units will appear here.`;
}

export const OPS_PAGE_SIZE = 20;

export const FULFILMENT_VIEWS = [
  "awaiting",
  "awaiting_tracking",
  "dispatched",
  "in_transit",
  "exceptions",
] as const;
export type FulfilmentView = (typeof FULFILMENT_VIEWS)[number];

export const INVENTORY_VIEWS = ["low", "out"] as const;
export type InventoryView = (typeof INVENTORY_VIEWS)[number];

export const COMMUNICATION_VIEWS = ["failed", "confirmations"] as const;
export type CommunicationView = (typeof COMMUNICATION_VIEWS)[number];

export const OPS_EMAIL_ORDER_CONFIRMATION = "order_confirmation";
export const OPS_EMAIL_SHIPMENT_CONFIRMATION = "shipment_confirmation";

export const EMAIL_EVENT_STATUSES = ["pending", "sent", "failed"] as const;
export type EmailEventStatus = (typeof EMAIL_EVENT_STATUSES)[number];

/** Shipment statuses that should already have a tracking number. */
export const MISSING_TRACKING_PROGRESS_STATUSES = [
  "dispatched",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
] as const satisfies readonly ShipmentStatus[];

/** In-transit queue includes the next movement state, out for delivery. */
export const IN_TRANSIT_QUEUE_STATUSES = ["in_transit", "out_for_delivery"] as const satisfies readonly ShipmentStatus[];

export const FULFILMENT_VIEW_LABELS = {
  awaiting: "Awaiting",
  awaiting_tracking: "Awaiting tracking",
  dispatched: "Dispatched",
  in_transit: "In transit",
  exceptions: "Exceptions",
} as const satisfies Record<FulfilmentView, string>;

export const INVENTORY_VIEW_LABELS = {
  low: "Low",
  out: "Out",
} as const satisfies Record<InventoryView, string>;

export const COMMUNICATION_VIEW_LABELS = {
  failed: "Failed",
  confirmations: "Confirmations",
} as const satisfies Record<CommunicationView, string>;

export type AttentionCounts = {
  awaitingFulfilment: number;
  missingTracking: number;
  deliveryExceptions: number;
  failedEmails: number;
  lowStockProducts: number;
};

export type AttentionItem = {
  id:
    | "awaiting-fulfilment"
    | "missing-tracking"
    | "delivery-exceptions"
    | "failed-emails"
    | "low-stock";
  label: string;
  count: number;
  href: string;
};

export type OpsFulfilmentRow = {
  orderId: string;
  orderReference: string;
  customerName: string;
  createdAt: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  shipmentStatus: ShipmentStatus | null;
  trackingNumber: string | null;
  carrierName: string | null;
};

export type OpsInventoryRow = {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  colourName: string;
  stockQuantity: number;
};

export type OpsEmailRow = {
  id: string;
  emailType: string;
  status: EmailEventStatus;
  recipientEmail: string;
  errorMessage: string | null;
  createdAt: string;
  orderId: string | null;
  orderReference: string | null;
};

export type OpsEmailCounts = {
  failed: number;
  orderConfirmations: number;
  orderConfirmationsSent: number;
  orderConfirmationsFailed: number;
  orderConfirmationsPending: number;
  shipmentConfirmations: number;
  shipmentConfirmationsSent: number;
  shipmentConfirmationsFailed: number;
  shipmentConfirmationsPending: number;
};

export type OpsPage<T> = {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
};

const SHIPMENT_STATUS_SET = new Set<string>(SHIPMENT_STATUSES);

export function isFulfilmentView(value: string | null | undefined): value is FulfilmentView {
  return (
    value === "awaiting" ||
    value === "awaiting_tracking" ||
    value === "dispatched" ||
    value === "in_transit" ||
    value === "exceptions"
  );
}

export function isInventoryView(value: string | null | undefined): value is InventoryView {
  return value === "low" || value === "out";
}

export function isCommunicationView(value: string | null | undefined): value is CommunicationView {
  return value === "failed" || value === "confirmations";
}

export function isEmailEventStatus(value: unknown): value is EmailEventStatus {
  return value === "pending" || value === "sent" || value === "failed";
}

export function parseFulfilmentView(params: Record<string, string | string[] | undefined>): FulfilmentView {
  const raw = readParam(params.view);
  return isFulfilmentView(raw) ? raw : "awaiting";
}

export function parseInventoryView(params: Record<string, string | string[] | undefined>): InventoryView {
  const raw = readParam(params.view);
  return isInventoryView(raw) ? raw : "low";
}

export function parseCommunicationView(
  params: Record<string, string | string[] | undefined>,
): CommunicationView {
  const raw = readParam(params.view);
  return isCommunicationView(raw) ? raw : "failed";
}

export function parseOpsPage(params: Record<string, string | string[] | undefined>): number {
  const page = Number.parseInt(readParam(params.page) || "1", 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function opsPageCount(total: number, pageSize = OPS_PAGE_SIZE): number {
  if (!Number.isInteger(total) || total <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(total / pageSize));
}

export function adminFulfilmentHref(view: FulfilmentView = "awaiting", page = 1): string {
  const params = new URLSearchParams();
  if (view !== "awaiting") {
    params.set("view", view);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const encoded = params.toString();
  return encoded ? `${routes.adminFulfilment}?${encoded}` : routes.adminFulfilment;
}

export function adminInventoryHref(view: InventoryView = "low", page = 1): string {
  const params = new URLSearchParams();
  if (view !== "low") {
    params.set("view", view);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const encoded = params.toString();
  return encoded ? `${routes.adminInventory}?${encoded}` : routes.adminInventory;
}

export function adminCommunicationsHref(view: CommunicationView = "failed", page = 1): string {
  const params = new URLSearchParams();
  if (view !== "failed") {
    params.set("view", view);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const encoded = params.toString();
  return encoded ? `${routes.adminCommunications}?${encoded}` : routes.adminCommunications;
}

export function isLowStockVariant(variant: { status: string; stockQuantity: number }): boolean {
  return (
    variant.status === "available" &&
    Number.isInteger(variant.stockQuantity) &&
    variant.stockQuantity > 0 &&
    variant.stockQuantity <= LOW_STOCK_THRESHOLD
  );
}

export function isOutOfStockVariant(variant: { status: string; stockQuantity: number }): boolean {
  return variant.status === "available" && variant.stockQuantity === 0;
}

export function shipmentIsMissingTracking(input: {
  status: ShipmentStatus;
  trackingNumber: string | null;
}): boolean {
  if (input.status === "tracking_unavailable") {
    return true;
  }
  if (input.status === "pending") {
    return false;
  }
  if (!SHIPMENT_STATUS_SET.has(input.status)) {
    return false;
  }
  return (input.trackingNumber ?? "").trim().length === 0;
}

/**
 * PostgREST filter matching `shipmentIsMissingTracking`.
 * Pending shipments are excluded. `tracking_unavailable` is included even
 * when a number is present, because that status means tracking is not usable.
 */
export function missingTrackingOrFilter(): string {
  const progressed = MISSING_TRACKING_PROGRESS_STATUSES.join(",");
  return `status.eq.tracking_unavailable,and(tracking_number.is.null,status.in.(${progressed}))`;
}

export function isInTransitQueueStatus(status: ShipmentStatus): boolean {
  return (IN_TRANSIT_QUEUE_STATUSES as readonly ShipmentStatus[]).includes(status);
}

export function isDeliveryException(input: {
  orderStatus: OrderStatus;
  shipmentStatus: ShipmentStatus | null;
}): boolean {
  return input.orderStatus === "exception" || input.shipmentStatus === "exception";
}

export function attentionItemsFromCounts(counts: AttentionCounts): AttentionItem[] {
  const items: AttentionItem[] = [];
  pushAttention(
    items,
    "awaiting-fulfilment",
    counts.awaitingFulfilment,
    "Order awaiting fulfilment",
    "Orders awaiting fulfilment",
    adminFulfilmentHref("awaiting"),
  );
  pushAttention(
    items,
    "missing-tracking",
    counts.missingTracking,
    "Shipment missing tracking",
    "Shipments missing tracking",
    adminFulfilmentHref("awaiting_tracking"),
  );
  pushAttention(
    items,
    "delivery-exceptions",
    counts.deliveryExceptions,
    "Delivery exception",
    "Delivery exceptions",
    adminFulfilmentHref("exceptions"),
  );
  pushAttention(
    items,
    "failed-emails",
    counts.failedEmails,
    "Failed email",
    "Failed emails",
    adminCommunicationsHref("failed"),
  );
  pushAttention(
    items,
    "low-stock",
    counts.lowStockProducts,
    "Low-stock product",
    "Low-stock products",
    adminInventoryHref("low"),
  );
  return items;
}

export function emailBreakdownTotal(counts: {
  sent: number;
  failed: number;
  pending: number;
}): number {
  return counts.sent + counts.failed + counts.pending;
}

export const AWAITING_FULFILMENT_ORDER_STATUS_LIST = AWAITING_FULFILMENT_ORDER_STATUSES;
export const AWAITING_FULFILMENT_PAYMENT = AWAITING_FULFILMENT_PAYMENT_STATUS;

export { isAwaitingFulfilment };

function pushAttention(
  items: AttentionItem[],
  id: AttentionItem["id"],
  count: number,
  singular: string,
  plural: string,
  href: string,
): void {
  if (!Number.isInteger(count) || count <= 0) {
    return;
  }
  items.push({
    id,
    count,
    href,
    label: count === 1 ? singular : plural,
  });
}

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }
  return typeof value === "string" ? value : "";
}
