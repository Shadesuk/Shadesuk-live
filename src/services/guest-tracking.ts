import "server-only";

import {
  consumeGuestTrackingEmailCompare,
  guestTrackingVerified,
  GUEST_TRACKING_DUMMY_EMAIL,
  GUEST_TRACKING_GENERIC_ERROR,
  GUEST_TRACKING_RATE_LIMITED,
  parseGuestTrackingRequest,
  toCustomerShipmentView,
  toGuestOrderTrackingView,
  type CustomerShipmentView,
} from "@/contracts";
import type { OrderItemRow, OrderRow, OrderStatus, PaymentStatus } from "@/contracts/order/schema";
import type { ShipmentRow, ShipmentStatus, TrackingEventRow } from "@/contracts/fulfilment/shipment";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/contracts/order/schema";
import { SHIPMENT_STATUSES } from "@/contracts/fulfilment/shipment";
import { NETWORK_ERROR } from "@/lib/account-copy";
import { hasSupabaseSecretKey, createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeHttpUrl } from "@/lib/tracking-url";
import { guestTrackingAttemptAllowed } from "@/lib/tracking-rate-limit";
import type { GuestTrackingActionResult } from "@/types/tracking";

const ORDER_COLUMNS =
  "id, order_reference, user_id, customer_email, customer_first_name, customer_last_name, status, payment_status, currency, subtotal_minor, shipping_minor, total_minor, delivery_address, created_at, updated_at";

const ORDER_ITEM_COLUMNS =
  "id, order_id, product_id, product_variant_id, sku, product_name, colour_name, variant_name, quantity, unit_price_minor, line_total_minor, product_snapshot, created_at";

const SHIPMENT_COLUMNS =
  "id, order_id, carrier_name, tracking_number, tracking_url, status, shipped_at, delivered_at, created_at, updated_at";

const TRACKING_EVENT_COLUMNS =
  "id, shipment_id, status, description, occurred_at, created_at";

export function guestTrackingLookupAvailable(): boolean {
  return hasSupabaseSecretKey() && isSupabaseConfigured();
}

export async function lookupGuestOrder(input: {
  orderReference: unknown;
  email: unknown;
  ip: string | null;
  limiterId: string | null;
}): Promise<GuestTrackingActionResult> {
  const orderReference =
    typeof input.orderReference === "string" ? input.orderReference : "";
  const email = typeof input.email === "string" ? input.email : "";

  if (
    !guestTrackingAttemptAllowed({
      ip: input.ip,
      limiterId: input.limiterId,
      orderReference,
      email,
    })
  ) {
    consumeGuestTrackingEmailCompare(email);
    return { status: "rate_limited", message: GUEST_TRACKING_RATE_LIMITED };
  }

  const parsed = parseGuestTrackingRequest({ orderReference, email });
  if (!parsed.ok) {
    return { status: "not_found", message: GUEST_TRACKING_GENERIC_ERROR };
  }

  if (!guestTrackingLookupAvailable()) {
    consumeGuestTrackingEmailCompare(parsed.email);
    return { status: "not_found", message: GUEST_TRACKING_GENERIC_ERROR };
  }

  try {
    const order = await loadOrderByReference(parsed.orderReference);
    const matched = guestTrackingVerified({
      orderReference: parsed.orderReference,
      requestEmail: parsed.email,
      orderEmail: order?.customer_email ?? GUEST_TRACKING_DUMMY_EMAIL,
    });
    if (!order || !matched) {
      return { status: "not_found", message: GUEST_TRACKING_GENERIC_ERROR };
    }

    const [items, shipment] = await Promise.all([
      loadOrderItems(order.id),
      loadCustomerShipment(order.id),
    ]);

    return {
      status: "ok",
      order: toGuestOrderTrackingView({
        order,
        items,
        shipment,
      }),
    };
  } catch {
    return { status: "error", message: NETWORK_ERROR };
  }
}

async function loadOrderByReference(orderReference: string): Promise<OrderRow | null> {
  const admin = createSupabaseAdminClient();
  const result = await admin
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("order_reference", orderReference)
    .maybeSingle();

  if (result.error || !result.data) {
    return null;
  }
  return parseOrderRow(result.data);
}

async function loadOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const admin = createSupabaseAdminClient();
  const result = await admin
    .from("order_items")
    .select(ORDER_ITEM_COLUMNS)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (result.error) {
    const fallback = await admin
      .from("order_items")
      .select(
        "id, order_id, product_id, product_variant_id, sku, product_name, variant_name, quantity, unit_price_minor, line_total_minor, product_snapshot, created_at",
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (fallback.error || !Array.isArray(fallback.data)) {
      return [];
    }
    return fallback.data
      .map((row) => parseOrderItemRow(row))
      .filter((row): row is OrderItemRow => row !== null);
  }
  if (!Array.isArray(result.data)) {
    return [];
  }
  return result.data
    .map((row) => parseOrderItemRow(row))
    .filter((row): row is OrderItemRow => row !== null);
}

async function loadCustomerShipment(orderId: string): Promise<CustomerShipmentView | null> {
  const admin = createSupabaseAdminClient();
  const shipmentResult = await admin
    .from("shipments")
    .select(SHIPMENT_COLUMNS)
    .eq("order_id", orderId)
    .maybeSingle();

  if (shipmentResult.error || !shipmentResult.data) {
    return null;
  }
  const shipment = parseShipmentRow(shipmentResult.data);
  if (!shipment) {
    return null;
  }

  const eventsResult = await admin
    .from("tracking_events")
    .select(TRACKING_EVENT_COLUMNS)
    .eq("shipment_id", shipment.id)
    .order("occurred_at", { ascending: true });

  const events = Array.isArray(eventsResult.data)
    ? eventsResult.data
        .map((row) => parseTrackingEventRow(row))
        .filter((row): row is TrackingEventRow => row !== null)
    : [];

  const view = toCustomerShipmentView(shipment, events);
  return {
    ...view,
    trackingUrl: safeHttpUrl(view.trackingUrl),
    trackingNumber: view.trackingNumber?.trim() || null,
    carrierName: view.carrierName?.trim() || null,
  };
}

function parseOrderRow(value: unknown): OrderRow | null {
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

function parseOrderItemRow(value: unknown): OrderItemRow | null {
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

function parseShipmentRow(value: unknown): ShipmentRow | null {
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

function parseTrackingEventRow(value: unknown): TrackingEventRow | null {
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
