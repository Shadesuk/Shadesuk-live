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
import type { OrderItemRow, OrderRow } from "@/contracts/order/schema";
import type { TrackingEventRow } from "@/contracts/fulfilment/shipment";
import { NETWORK_ERROR } from "@/lib/account-copy";
import {
  parseOrderItemRow,
  parseOrderRow,
  parseShipmentRow,
  parseTrackingEventRow,
} from "@/lib/order-rows";
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
