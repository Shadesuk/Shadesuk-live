import { minorToMajorGbp, STORE_CURRENCY } from "../money";
import type { PaymentProviderStub } from "../payment/stub";
import type { CustomerShipmentView } from "../fulfilment/shipment";
import type { OrderItemRow, OrderRow, OrderStatus } from "./schema";
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
  deliveryAddress: Record<string, unknown>;
  payment: PaymentProviderStub;
  shipment: CustomerShipmentView | null;
};

/**
 * Minimal guest-tracking payload. No payment provider ids, no webhook
 * payloads, no shipment notes, no other customers' data.
 */
export type GuestOrderTrackingView = {
  orderReference: string;
  status: OrderStatus;
  statusLabel: CustomerOrderStatusLabel;
  placedAt: string;
  items: Array<Pick<OrderItemSnapshotView, "productName" | "colourName" | "variantName" | "quantity">>;
  total: number;
  currency: typeof STORE_CURRENCY;
  shipment: CustomerShipmentView | null;
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
    shipment: input.shipment,
  };
}

export const ORDER_DISPLAY_PREFIX = "ORDER #";

export function formatOrderHeading(orderReference: string): string {
  return `${ORDER_DISPLAY_PREFIX}${orderReference}`;
}
