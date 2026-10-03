import { evaluateCancellationEligibility } from "./cancellation";
import { minorToMajorGbp, STORE_CURRENCY } from "../money";
import type { CustomerPaymentState } from "../payment/stub";
import { customerPaymentState } from "../payment/stub";
import type { CustomerShipmentView, ShipmentStatus } from "../fulfilment/shipment";
import type { OrderEventRow, OrderItemRow, OrderRow, OrderStatus } from "./schema";
import { customerOrderStatusLabel, type CustomerOrderStatusLabel } from "./status";

export type OrderItemSnapshotView = {
  id: string;
  productId: string;
  variantId: string | null;
  sku: string;
  productName: string;
  colourName: string;
  variantName: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  unitPrice: number;
  lineTotal: number;
};

export type CustomerVisibleOrderEventView = {
  eventType: string;
  oldStatus: OrderStatus | null;
  newStatus: OrderStatus | null;
  createdAt: string;
};

export type CustomerOrderListItem = {
  orderReference: string;
  placedAt: string;
  status: OrderStatus;
  statusLabel: CustomerOrderStatusLabel;
  productName: string;
  colourName: string;
  variantName: string | null;
  quantity: number;
  total: number;
  currency: typeof STORE_CURRENCY;
  cancelled: boolean;
  shipmentStatus: ShipmentStatus | null;
};

/**
 * Authenticated account order payload. Payment provider ids, webhook
 * payloads, shipment notes, and actor ids stay off this view.
 * Tracking number presence does not imply DELIVERED.
 */
export type CustomerOrderView = {
  orderReference: string;
  status: OrderStatus;
  statusLabel: CustomerOrderStatusLabel;
  placedAt: string;
  customerFirstName: string;
  customerLastName: string;
  items: OrderItemSnapshotView[];
  currency: typeof STORE_CURRENCY;
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  subtotal: number;
  shipping: number;
  total: number;
  deliveryAddress: GuestDeliveryAddressView | null;
  paymentState: CustomerPaymentState;
  shipment: CustomerShipmentView | null;
  events: CustomerVisibleOrderEventView[];
  cancelled: boolean;
  /** Server policy. Omitted means the surface must not offer cancellation. */
  cancellationEligible?: boolean;
};

/**
 * Customer-safe delivery snapshot for guest tracking. Known address fields
 * only — never the raw jsonb bag, never email, never payment ids.
 */
export type GuestDeliveryAddressView = {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
};

/**
 * Minimal guest-tracking payload. No payment provider ids, no webhook
 * payloads, no shipment notes, no other customers' data.
 * Do not reuse CustomerOrderView for this surface.
 */
export type GuestOrderTrackingView = {
  orderReference: string;
  status: OrderStatus;
  statusLabel: CustomerOrderStatusLabel;
  placedAt: string;
  items: Array<Pick<OrderItemSnapshotView, "productName" | "colourName" | "variantName" | "quantity">>;
  total: number;
  currency: typeof STORE_CURRENCY;
  deliveryAddress: GuestDeliveryAddressView | null;
  shipment: CustomerShipmentView | null;
  cancelled: boolean;
  cancellationEligible?: boolean;
};

export function toOrderItemSnapshotView(row: OrderItemRow): OrderItemSnapshotView {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.product_variant_id,
    sku: row.sku,
    productName: row.product_name,
    colourName: row.colour_name,
    variantName: row.variant_name,
    quantity: row.quantity,
    unitPriceMinor: row.unit_price_minor,
    lineTotalMinor: row.line_total_minor,
    unitPrice: minorToMajorGbp(row.unit_price_minor),
    lineTotal: minorToMajorGbp(row.line_total_minor),
  };
}

export function toGuestOrderTrackingView(input: {
  order: OrderRow;
  items: OrderItemRow[];
  shipment: CustomerShipmentView | null;
}): GuestOrderTrackingView {
  return {
    orderReference: input.order.order_reference,
    status: input.order.status,
    statusLabel: customerOrderStatusLabel(input.order.status),
    placedAt: input.order.created_at,
    items: input.items.map((item) => ({
      productName: item.product_name,
      colourName: item.colour_name,
      variantName: item.variant_name,
      quantity: item.quantity,
    })),
    total: minorToMajorGbp(input.order.total_minor),
    currency: STORE_CURRENCY,
    deliveryAddress: toGuestDeliveryAddress(input.order.delivery_address),
    shipment: input.shipment,
    cancelled: isCancelledPayment(input.order.payment_status),
    cancellationEligible: orderCancellationEligible(input.order, input.shipment),
  };
}

export function toCustomerOrderView(input: {
  order: OrderRow;
  items: OrderItemRow[];
  shipment: CustomerShipmentView | null;
  events?: OrderEventRow[];
}): CustomerOrderView {
  return {
    orderReference: input.order.order_reference,
    status: input.order.status,
    statusLabel: customerOrderStatusLabel(input.order.status),
    placedAt: input.order.created_at,
    customerFirstName: input.order.customer_first_name,
    customerLastName: input.order.customer_last_name,
    items: input.items.map(toOrderItemSnapshotView),
    currency: STORE_CURRENCY,
    subtotalMinor: input.order.subtotal_minor,
    shippingMinor: input.order.shipping_minor,
    totalMinor: input.order.total_minor,
    subtotal: minorToMajorGbp(input.order.subtotal_minor),
    shipping: minorToMajorGbp(input.order.shipping_minor),
    total: minorToMajorGbp(input.order.total_minor),
    deliveryAddress: toGuestDeliveryAddress(input.order.delivery_address),
    paymentState: customerPaymentState(input.order.payment_status),
    shipment: input.shipment,
    events: toCustomerVisibleOrderEvents(input.events ?? []),
    cancelled: isCancelledPayment(input.order.payment_status),
    cancellationEligible: orderCancellationEligible(input.order, input.shipment),
  };
}

export function toCustomerOrderListItem(input: {
  order: OrderRow;
  items: OrderItemRow[];
  shipmentStatus?: ShipmentStatus | null;
}): CustomerOrderListItem {
  const first = input.items[0];
  return {
    orderReference: input.order.order_reference,
    placedAt: input.order.created_at,
    status: input.order.status,
    statusLabel: customerOrderStatusLabel(input.order.status),
    productName: first?.product_name ?? "",
    colourName: first?.colour_name ?? "",
    variantName: first?.variant_name ?? null,
    quantity: first?.quantity ?? 0,
    total: minorToMajorGbp(input.order.total_minor),
    currency: STORE_CURRENCY,
    cancelled: isCancelledPayment(input.order.payment_status),
    shipmentStatus: input.shipmentStatus ?? null,
  };
}

function isCancelledPayment(status: OrderRow["payment_status"]): boolean {
  return status === "cancelled" || status === "refunded";
}

function orderCancellationEligible(
  order: OrderRow,
  shipment: CustomerShipmentView | null,
): boolean {
  return evaluateCancellationEligibility({
    createdAt: order.created_at,
    paymentStatus: order.payment_status,
    orderStatus: order.status,
    shipmentStatus: shipment?.status ?? null,
    shippedAt: shipment?.shippedAt ?? null,
  }).eligible;
}

function toCustomerVisibleOrderEvents(
  events: OrderEventRow[],
): CustomerVisibleOrderEventView[] {
  return [...events]
    .filter((event) => event.customer_visible)
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .map((event) => ({
      eventType: event.event_type,
      oldStatus: event.old_status,
      newStatus: event.new_status,
      createdAt: event.created_at,
    }));
}

export function toGuestDeliveryAddress(
  input: Record<string, unknown> | null | undefined,
): GuestDeliveryAddressView | null {
  if (!input) {
    return null;
  }
  const firstName = readAddressField(input, ["first_name", "firstName", "given_name"]);
  const lastName = readAddressField(input, ["last_name", "lastName", "family_name"]);
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
  const address: GuestDeliveryAddressView = {
    name,
    line1: readAddressField(input, ["address_line_1", "line1", "line_1"]),
    line2: readAddressField(input, ["address_line_2", "line2", "line_2"]),
    city: readAddressField(input, ["city", "town"]),
    county: readAddressField(input, ["county", "region"]),
    postcode: readAddressField(input, ["postcode", "postal_code", "zip"]),
    country: readAddressField(input, ["country"]),
  };
  if (Object.values(address).every((value) => !value)) {
    return null;
  }
  return address;
}

function readAddressField(input: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string") {
      const cleaned = sanitiseAddressLine(value);
      if (cleaned) {
        return cleaned;
      }
    }
  }
  return null;
}

function sanitiseAddressLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
}

export const ORDER_DISPLAY_PREFIX = "ORDER #";

export function formatOrderHeading(orderReference: string): string {
  return `${ORDER_DISPLAY_PREFIX}${orderReference}`;
}
