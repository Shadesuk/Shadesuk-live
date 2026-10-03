import "server-only";

import {
  COMMITTED_PURCHASE_PAYMENT_STATUSES,
  isCommittedPurchase,
} from "@/contracts/order/lifecycle";
import {
  parseOrderReferenceInput,
  toCustomerOrderListItem,
  toCustomerOrderView,
  toCustomerShipmentView,
  type CustomerOrderListItem,
  type CustomerOrderView,
} from "@/contracts";
import { getOptionalAccountUser } from "@/lib/account-session";
import {
  parseCustomerVisibleOrderEventRow,
  parseOrderItemRow,
  parseOrderRow,
  parseShipmentRow,
  parseTrackingEventRow,
} from "@/lib/order-rows";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeHttpUrl } from "@/lib/tracking-url";
import {
  SHIPMENT_STATUSES,
  type CustomerShipmentView,
  type ShipmentStatus,
  type TrackingEventRow,
} from "@/contracts/fulfilment/shipment";
import type { OrderEventRow, OrderItemRow, OrderRow } from "@/contracts/order/schema";

const ORDER_COLUMNS =
  "id, order_reference, user_id, customer_email, customer_first_name, customer_last_name, status, payment_status, currency, subtotal_minor, shipping_minor, total_minor, delivery_address, created_at, updated_at, cancelled_at, refund_status";

const ORDER_ITEM_COLUMNS =
  "id, order_id, product_id, product_variant_id, sku, product_name, colour_name, variant_name, quantity, unit_price_minor, line_total_minor, product_snapshot, created_at";

const SHIPMENT_COLUMNS =
  "id, order_id, carrier_name, tracking_number, tracking_url, status, shipped_at, delivered_at, created_at, updated_at";

const TRACKING_EVENT_COLUMNS =
  "id, shipment_id, status, description, occurred_at, created_at";

const ORDER_EVENT_COLUMNS =
  "id, order_id, event_type, old_status, new_status, customer_visible, created_at";

const CUSTOMER_ORDER_LIST_LIMIT = 50;

export type CustomerOrderAccessResult<T> =
  | { status: "ok"; data: T }
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "error" };

/**
 * Cookie-bound, RLS-scoped list of the signed-in customer's orders.
 * Ownership is the session user id — never a client-supplied user id.
 */
export async function listOwnCustomerOrders(): Promise<
  CustomerOrderAccessResult<CustomerOrderListItem[]>
> {
  const user = await getOptionalAccountUser();
  if (!user) {
    return { status: "unauthenticated" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const ordersResult = await supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("user_id", user.id)
      .in("payment_status", [...COMMITTED_PURCHASE_PAYMENT_STATUSES])
      .order("created_at", { ascending: false })
      .limit(CUSTOMER_ORDER_LIST_LIMIT);
    if (ordersResult.error) {
      return { status: "error" };
    }
    const orders = (Array.isArray(ordersResult.data) ? ordersResult.data : [])
      .map(parseOrderRow)
      .filter((row): row is OrderRow => row !== null && row.user_id === user.id);
    if (orders.length === 0) {
      return { status: "ok", data: [] };
    }

    const orderIds = orders.map((order) => order.id);
    const [itemsResult, shipmentsResult] = await Promise.all([
      supabase
        .from("order_items")
        .select(ORDER_ITEM_COLUMNS)
        .in("order_id", orderIds)
        .order("created_at", { ascending: true }),
      supabase.from("shipments").select("order_id, status").in("order_id", orderIds),
    ]);
    if (itemsResult.error || shipmentsResult.error) {
      return { status: "error" };
    }
    const itemsByOrder = new Map<string, OrderItemRow[]>();
    for (const parsed of (Array.isArray(itemsResult.data) ? itemsResult.data : [])
      .map(parseOrderItemRow)
      .filter((row): row is OrderItemRow => row !== null)) {
      const list = itemsByOrder.get(parsed.order_id) ?? [];
      list.push(parsed);
      itemsByOrder.set(parsed.order_id, list);
    }

    const shipmentStatusByOrder = new Map<string, ShipmentStatus>();
    for (const row of Array.isArray(shipmentsResult.data) ? shipmentsResult.data : []) {
      const parsed = parseShipmentStatus(row);
      if (parsed) {
        shipmentStatusByOrder.set(parsed.orderId, parsed.status);
      }
    }

    return {
      status: "ok",
      data: orders.map((order) =>
        toCustomerOrderListItem({
          order,
          items: itemsByOrder.get(order.id) ?? [],
          shipmentStatus: shipmentStatusByOrder.get(order.id) ?? null,
        }),
      ),
    };
  } catch {
    return { status: "error" };
  }
}

/**
 * Cookie-bound detail: own order → items → shipment/tracking → visible order events.
 * Unknown, malformed, or another customer's reference all return not_found.
 */
export async function getOwnCustomerOrder(
  orderReference: unknown,
): Promise<CustomerOrderAccessResult<CustomerOrderView>> {
  const user = await getOptionalAccountUser();
  if (!user) {
    return { status: "unauthenticated" };
  }
  const reference =
    typeof orderReference === "string" ? parseOrderReferenceInput(orderReference) : null;
  if (!reference) {
    return { status: "not_found" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const orderResult = await supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("order_reference", reference)
      .maybeSingle();
    if (orderResult.error) {
      return { status: "error" };
    }
    const order = parseOrderRow(orderResult.data);
    if (!order || order.user_id !== user.id || !isCommittedPurchase(order.payment_status)) {
      return { status: "not_found" };
    }

    const [items, shipment, events] = await Promise.all([
      loadOwnOrderItems(supabase, order.id),
      loadOwnCustomerShipment(supabase, order.id),
      loadOwnVisibleOrderEvents(supabase, order.id),
    ]);

    return {
      status: "ok",
      data: toCustomerOrderView({
        order,
        items,
        shipment,
        events,
      }),
    };
  } catch {
    return { status: "error" };
  }
}

function parseShipmentStatus(
  value: unknown,
): { orderId: string; status: ShipmentStatus } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as { order_id?: unknown; status?: unknown };
  if (typeof row.order_id !== "string" || typeof row.status !== "string") {
    return null;
  }
  if (!(SHIPMENT_STATUSES as readonly string[]).includes(row.status)) {
    return null;
  }
  return { orderId: row.order_id, status: row.status as ShipmentStatus };
}

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function loadOwnOrderItems(
  supabase: ServerClient,
  orderId: string,
): Promise<OrderItemRow[]> {
  const result = await supabase
    .from("order_items")
    .select(ORDER_ITEM_COLUMNS)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (result.error || !Array.isArray(result.data)) {
    return [];
  }
  return result.data.map(parseOrderItemRow).filter((row): row is OrderItemRow => row !== null);
}

async function loadOwnCustomerShipment(
  supabase: ServerClient,
  orderId: string,
): Promise<CustomerShipmentView | null> {
  const shipmentResult = await supabase
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
  const eventsResult = await supabase
    .from("tracking_events")
    .select(TRACKING_EVENT_COLUMNS)
    .eq("shipment_id", shipment.id)
    .order("occurred_at", { ascending: true });
  const events: TrackingEventRow[] = Array.isArray(eventsResult.data)
    ? eventsResult.data
        .map(parseTrackingEventRow)
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

async function loadOwnVisibleOrderEvents(
  supabase: ServerClient,
  orderId: string,
): Promise<OrderEventRow[]> {
  const result = await supabase
    .from("order_events")
    .select(ORDER_EVENT_COLUMNS)
    .eq("order_id", orderId)
    .eq("customer_visible", true)
    .order("created_at", { ascending: true });
  if (result.error || !Array.isArray(result.data)) {
    return [];
  }
  return result.data
    .map(parseCustomerVisibleOrderEventRow)
    .filter((row): row is OrderEventRow => row !== null && row.customer_visible);
}
