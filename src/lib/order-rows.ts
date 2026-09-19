import type { OrderEventRow, OrderItemRow, OrderRow, OrderStatus, PaymentStatus } from "@/contracts/order/schema";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/contracts/order/schema";
import type { ShipmentRow, ShipmentStatus, TrackingEventRow } from "@/contracts/fulfilment/shipment";
import { SHIPMENT_STATUSES } from "@/contracts/fulfilment/shipment";

export function parseOrderRow(value: unknown): OrderRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const status = value.status;
  const paymentStatus = value.payment_status;
  if (!isOrderStatus(status) || !isPaymentStatus(paymentStatus) || value.currency !== "GBP") {
    return null;
  }
  const id = asString(value.id);
  const orderReference = asString(value.order_reference);
  const customerEmail = asString(value.customer_email);
  const firstName = asString(value.customer_first_name);
  const lastName = asString(value.customer_last_name);
  const createdAt = asString(value.created_at);
  const updatedAt = asString(value.updated_at);
  const subtotalMinor = asInteger(value.subtotal_minor);
  const shippingMinor = asInteger(value.shipping_minor);
  const totalMinor = asInteger(value.total_minor);
  if (
    !id ||
    !orderReference ||
    !customerEmail ||
    !firstName ||
    !lastName ||
    !createdAt ||
    !updatedAt ||
    subtotalMinor == null ||
    shippingMinor == null ||
    totalMinor == null
  ) {
    return null;
  }
  return {
    id,
    order_reference: orderReference,
    user_id: typeof value.user_id === "string" ? value.user_id : null,
    customer_email: customerEmail,
    customer_first_name: firstName,
    customer_last_name: lastName,
    status,
    payment_status: paymentStatus,
    currency: "GBP",
    subtotal_minor: subtotalMinor,
    shipping_minor: shippingMinor,
    total_minor: totalMinor,
    delivery_address: isRecord(value.delivery_address) ? value.delivery_address : {},
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function parseOrderItemRow(value: unknown): OrderItemRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asString(value.id);
  const orderId = asString(value.order_id);
  const productId = asString(value.product_id);
  const sku = asString(value.sku);
  const productName = asString(value.product_name);
  const quantity = asInteger(value.quantity);
  const unitPriceMinor = asInteger(value.unit_price_minor);
  const lineTotalMinor = asInteger(value.line_total_minor);
  const createdAt = asString(value.created_at);
  if (
    !id ||
    !orderId ||
    !productId ||
    !sku ||
    !productName ||
    quantity == null ||
    quantity < 1 ||
    unitPriceMinor == null ||
    lineTotalMinor == null ||
    !createdAt
  ) {
    return null;
  }
  const snapshot = isRecord(value.product_snapshot) ? value.product_snapshot : null;
  const colourName =
    asString(value.colour_name) ??
    (snapshot ? asString(snapshot.colour_name) ?? asString(snapshot.colourName) : null) ??
    "";
  return {
    id,
    order_id: orderId,
    product_id: productId,
    product_variant_id: typeof value.product_variant_id === "string" ? value.product_variant_id : null,
    sku,
    product_name: productName,
    colour_name: colourName,
    variant_name: typeof value.variant_name === "string" ? value.variant_name : null,
    quantity,
    unit_price_minor: unitPriceMinor,
    line_total_minor: lineTotalMinor,
    product_snapshot: snapshot,
    created_at: createdAt,
  };
}

export function parseShipmentRow(value: unknown): ShipmentRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const status = value.status;
  if (!isShipmentStatus(status)) {
    return null;
  }
  const id = asString(value.id);
  const orderId = asString(value.order_id);
  const createdAt = asString(value.created_at);
  const updatedAt = asString(value.updated_at);
  if (!id || !orderId || !createdAt || !updatedAt) {
    return null;
  }
  return {
    id,
    order_id: orderId,
    carrier_name: typeof value.carrier_name === "string" ? value.carrier_name : null,
    tracking_number: typeof value.tracking_number === "string" ? value.tracking_number : null,
    tracking_url: typeof value.tracking_url === "string" ? value.tracking_url : null,
    status,
    shipped_at: typeof value.shipped_at === "string" ? value.shipped_at : null,
    delivered_at: typeof value.delivered_at === "string" ? value.delivered_at : null,
    notes: null,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function parseTrackingEventRow(value: unknown): TrackingEventRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const status = value.status;
  if (!isShipmentStatus(status)) {
    return null;
  }
  const id = asString(value.id);
  const shipmentId = asString(value.shipment_id);
  const occurredAt = asString(value.occurred_at);
  const createdAt = asString(value.created_at);
  if (!id || !shipmentId || !occurredAt || !createdAt) {
    return null;
  }
  return {
    id,
    shipment_id: shipmentId,
    status,
    description: typeof value.description === "string" ? value.description : null,
    occurred_at: occurredAt,
    created_by: null,
    created_at: createdAt,
  };
}

export function parseCustomerVisibleOrderEventRow(value: unknown): OrderEventRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asString(value.id);
  const orderId = asString(value.order_id);
  const eventType = asString(value.event_type);
  const createdAt = asString(value.created_at);
  if (!id || !orderId || !eventType || !createdAt) {
    return null;
  }
  const oldStatus = value.old_status;
  const newStatus = value.new_status;
  return {
    id,
    order_id: orderId,
    event_type: eventType,
    old_status: isOrderStatus(oldStatus) ? oldStatus : null,
    new_status: isOrderStatus(newStatus) ? newStatus : null,
    actor_user_id: null,
    metadata: null,
    customer_visible: value.customer_visible === true,
    created_at: createdAt,
  };
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

function isShipmentStatus(value: unknown): value is ShipmentStatus {
  return typeof value === "string" && (SHIPMENT_STATUSES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
