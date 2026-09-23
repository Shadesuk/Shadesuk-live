import "server-only";

import {
  ADMIN_ORDER_EVENT_TYPES,
  ADMIN_ORDERS_PAGE_SIZE,
  adminOrderEventLabel,
  adminOrderListPeriodRange,
  adminOrderSearchReference,
  adminOrderStatusOptions,
  mapAdminDelivery,
  ADMIN_DISPATCH_BLOCKED_ERROR,
  ADMIN_DISPATCH_UNPAID_ERROR,
  DISPATCH_TRACKING_UNAVAILABLE_DESCRIPTION,
  awaitingFulfilmentListConflict,
  isUnchangedAdminFulfilment,
  parseAdminDispatchInput,
  parseAdminFulfilmentInput,
  parseAdminOrderStatusInput,
  type AdminFulfilmentInput,
  type AdminOrderDetailView,
  type AdminOrderEventView,
  type AdminOrderItemView,
  type AdminOrderListItem,
  type AdminOrderListQuery,
  type AdminShipmentView,
  type AdminTrackingEventView,
} from "@/contracts/admin/orders";
import {
  isOrderStatus,
  isPaymentStatus,
  isShipmentStatus,
} from "@/contracts/admin/dashboard";
import {
  AWAITING_FULFILMENT_ORDER_STATUSES,
  AWAITING_FULFILMENT_PAYMENT_STATUS,
  isIdempotentDispatch,
  legalOrderStatusPath,
  orderStatusForShipment,
} from "@/contracts/fulfilment/dispatch";
import type { ShipmentStatus } from "@/contracts/fulfilment/shipment";
import type { OrderStatus } from "@/contracts/order/schema";
import { isUuid } from "@/lib/ids";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeHttpUrl } from "@/lib/tracking-url";

const LIST_COLUMNS =
  "id, order_reference, user_id, customer_email, customer_first_name, customer_last_name, status, payment_status, total_minor, created_at";
const DETAIL_COLUMNS =
  "id, order_reference, user_id, customer_email, customer_first_name, customer_last_name, status, payment_status, subtotal_minor, shipping_minor, total_minor, delivery_address, created_at";
const ITEM_COLUMNS =
  "id, product_name, colour_name, variant_name, quantity, unit_price_minor, line_total_minor";
const SHIPMENT_COLUMNS =
  "id, carrier_name, tracking_number, tracking_url, status";
const EVENT_COLUMNS = "id, event_type, old_status, new_status, created_at";
const TRACKING_EVENT_COLUMNS = "id, status, description, occurred_at";

export type AdminOrdersLoadResult<T> =
  | { status: "ok"; data: T }
  | { status: "error" }
  | { status: "not_found" };

export type AdminOrderListResult = {
  orders: AdminOrderListItem[];
  total: number;
  page: number;
  pageCount: number;
};

export type AdminOrderMutationResult =
  | { status: "ok" }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "error" }
  | { status: "forbidden" }
  | { status: "not_found" };

export async function loadAdminOrderList(
  query: AdminOrderListQuery,
): Promise<AdminOrdersLoadResult<AdminOrderListResult>> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    if (awaitingFulfilmentListConflict(query)) {
      return {
        status: "ok",
        data: { orders: [], total: 0, page: query.page, pageCount: 1 },
      };
    }
    const range = adminOrderListPeriodRange(query.period);
    const from = (query.page - 1) * ADMIN_ORDERS_PAGE_SIZE;
    const to = from + ADMIN_ORDERS_PAGE_SIZE - 1;
    let request = supabase
      .from("orders")
      .select(LIST_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (query.fulfilment === "awaiting") {
      request = request.eq("payment_status", AWAITING_FULFILMENT_PAYMENT_STATUS);
      request = query.status
        ? request.eq("status", query.status)
        : request.in("status", [...AWAITING_FULFILMENT_ORDER_STATUSES]);
    } else {
      if (query.status) {
        request = request.eq("status", query.status);
      }
      if (query.payment) {
        request = request.eq("payment_status", query.payment);
      }
    }
    if (range) {
      request = request.gte("created_at", range.startIso).lt("created_at", range.endIso);
    }
    if (query.q) {
      const reference = adminOrderSearchReference(query.q);
      const pattern = `%${query.q}%`;
      const clauses = [
        `order_reference.ilike."${pattern}"`,
        `customer_email.ilike."${pattern}"`,
        `customer_first_name.ilike."${pattern}"`,
        `customer_last_name.ilike."${pattern}"`,
      ];
      if (reference) {
        clauses.unshift(`order_reference.eq."${reference}"`);
      }
      request = request.or(clauses.join(","));
    }
    const { data, error, count } = await request;
    if (error) {
      return { status: "error" };
    }
    const total = typeof count === "number" ? count : 0;
    const pageCount = Math.max(1, Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE));
    const orders: AdminOrderListItem[] = [];
    for (const row of Array.isArray(data) ? data : []) {
      const parsed = parseListItem(row);
      if (parsed) {
        orders.push(parsed);
      }
    }
    return {
      status: "ok",
      data: {
        orders,
        total,
        page: query.page,
        pageCount,
      },
    };
  } catch {
    return { status: "error" };
  }
}

export async function loadAdminOrderDetail(
  id: string,
): Promise<AdminOrdersLoadResult<AdminOrderDetailView>> {
  if (!isUuid(id)) {
    return { status: "not_found" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const orderResult = await supabase
      .from("orders")
      .select(DETAIL_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (orderResult.error) {
      return { status: "error" };
    }
    if (!orderResult.data) {
      return { status: "not_found" };
    }
    const order = parseDetailOrder(orderResult.data);
    if (!order) {
      return { status: "error" };
    }
    const [itemsResult, shipmentResult, eventsResult] = await Promise.all([
      supabase.from("order_items").select(ITEM_COLUMNS).eq("order_id", id).order("created_at"),
      supabase.from("shipments").select(SHIPMENT_COLUMNS).eq("order_id", id).maybeSingle(),
      supabase
        .from("order_events")
        .select(EVENT_COLUMNS)
        .eq("order_id", id)
        .order("created_at", { ascending: true }),
    ]);
    if (itemsResult.error || eventsResult.error) {
      return { status: "error" };
    }
    if (shipmentResult.error && shipmentResult.error.code !== "PGRST116") {
      return { status: "error" };
    }
    const items: AdminOrderItemView[] = [];
    for (const row of Array.isArray(itemsResult.data) ? itemsResult.data : []) {
      const parsed = parseItem(row);
      if (parsed) {
        items.push(parsed);
      }
    }
    const events: AdminOrderEventView[] = [];
    for (const row of Array.isArray(eventsResult.data) ? eventsResult.data : []) {
      const parsed = parseEvent(row);
      if (parsed) {
        events.push(parsed);
      }
    }
    const shipment = parseShipment(shipmentResult.data);
    if (shipment) {
      const trackingResult = await supabase
        .from("tracking_events")
        .select(TRACKING_EVENT_COLUMNS)
        .eq("shipment_id", shipment.id)
        .order("occurred_at", { ascending: true });
      if (trackingResult.error) {
        return { status: "error" };
      }
      const trackingEvents: AdminTrackingEventView[] = [];
      for (const row of Array.isArray(trackingResult.data) ? trackingResult.data : []) {
        const parsed = parseTrackingEvent(row);
        if (parsed) {
          trackingEvents.push(parsed);
        }
      }
      shipment.events = trackingEvents;
    }
    return {
      status: "ok",
      data: {
        ...order,
        items,
        shipment,
        events,
        statusTargets: adminOrderStatusOptions(order.orderStatus),
      },
    };
  } catch {
    return { status: "error" };
  }
}

/**
 * Cookie-bound staff status write. Event insert is sequential after the order
 * row update, not a single database transaction.
 */
export async function updateAdminOrderStatus(input: {
  orderId: string;
  nextStatus: unknown;
  actorId: string;
}): Promise<AdminOrderMutationResult> {
  if (!isUuid(input.orderId) || !isUuid(input.actorId)) {
    return { status: "not_found" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const current = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", input.orderId)
      .maybeSingle();
    if (current.error) {
      return { status: "error" };
    }
    if (!current.data || !isOrderStatus(current.data.status)) {
      return { status: "not_found" };
    }
    const parsed = parseAdminOrderStatusInput(current.data.status, input.nextStatus);
    if (!parsed.ok) {
      return { status: "invalid", errors: { status: "That status change isn’t allowed." } };
    }
    if (parsed.status === current.data.status) {
      return { status: "ok" };
    }
    const updated = await supabase
      .from("orders")
      .update({ status: parsed.status, updated_at: new Date().toISOString() })
      .eq("id", input.orderId)
      .eq("status", current.data.status)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) {
      return { status: "error" };
    }
    const event = await supabase.from("order_events").insert({
      order_id: input.orderId,
      event_type: ADMIN_ORDER_EVENT_TYPES.statusChanged,
      old_status: current.data.status,
      new_status: parsed.status,
      actor_user_id: input.actorId,
      customer_visible: false,
    });
    if (event.error) {
      return { status: "error" };
    }
    return { status: "ok" };
  } catch {
    return { status: "error" };
  }
}

/**
 * Manual fulfilment write. A tracking URL never forces `delivered`.
 * When payment is captured, shipment status is copied onto the order only
 * along the existing legal status path. `pending` does not move the order.
 * Shipment notes are not selected: the authenticated GRANT omits
 * shipments.notes for client roles, including staff.
 *
 * Integrity: shipment row writes and event inserts are sequential, not a
 * single database transaction. If an event insert fails after a successful
 * shipment write, this function returns error; the shipment change may already
 * be persisted. Identical retries skip further writes instead of duplicating events.
 */
export async function saveAdminFulfilment(input: {
  orderId: string;
  actorId: string;
  carrierName: unknown;
  trackingNumber: unknown;
  trackingUrl: unknown;
  status: unknown;
}): Promise<AdminOrderMutationResult> {
  if (!isUuid(input.orderId) || !isUuid(input.actorId)) {
    return { status: "not_found" };
  }
  const parsed = parseAdminFulfilmentInput(input);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const order = await supabase
      .from("orders")
      .select("id, status, payment_status")
      .eq("id", input.orderId)
      .maybeSingle();
    if (order.error) {
      return { status: "error" };
    }
    if (!order.data) {
      return { status: "not_found" };
    }
    const existing = await supabase
      .from("shipments")
      .select("id, status, shipped_at, delivered_at, carrier_name, tracking_number, tracking_url")
      .eq("order_id", input.orderId)
      .maybeSingle();
    if (existing.error && existing.error.code !== "PGRST116") {
      return { status: "error" };
    }
    if (
      existing.data &&
      typeof existing.data.id === "string" &&
      isShipmentStatus(existing.data.status) &&
      isUnchangedAdminFulfilment(
        {
          carrierName: typeof existing.data.carrier_name === "string" ? existing.data.carrier_name : null,
          trackingNumber:
            typeof existing.data.tracking_number === "string" ? existing.data.tracking_number : null,
          trackingUrl: typeof existing.data.tracking_url === "string" ? existing.data.tracking_url : null,
          status: existing.data.status,
        },
        parsed.value,
      )
    ) {
      return { status: "ok" };
    }
    const payload = shipmentWritePayload(parsed.value, existing.data);
    if (existing.data && typeof existing.data.id === "string") {
      const updated = await supabase
        .from("shipments")
        .update(payload)
        .eq("id", existing.data.id)
        .select("id")
        .maybeSingle();
      if (updated.error || !updated.data) {
        return { status: "error" };
      }
      const event = await supabase.from("order_events").insert({
        order_id: input.orderId,
        event_type: ADMIN_ORDER_EVENT_TYPES.shipmentUpdated,
        actor_user_id: input.actorId,
        customer_visible: false,
        metadata: { shipment_status: parsed.value.status },
      });
      if (event.error) {
        return { status: "error" };
      }
      if (
        isShipmentStatus(existing.data.status) &&
        existing.data.status !== parsed.value.status
      ) {
        const tracking = await supabase.from("tracking_events").insert({
          shipment_id: existing.data.id,
          status: parsed.value.status,
          occurred_at: new Date().toISOString(),
          created_by: input.actorId,
        });
        if (tracking.error) {
          return { status: "error" };
        }
      }
      return syncCapturedOrder(supabase, input.orderId, input.actorId, order.data, parsed.value.status);
    }
    const created = await supabase
      .from("shipments")
      .insert({
        order_id: input.orderId,
        ...payload,
      })
      .select("id")
      .maybeSingle();
    if (created.error || !created.data || typeof created.data.id !== "string") {
      return { status: "error" };
    }
    const event = await supabase.from("order_events").insert({
      order_id: input.orderId,
      event_type: ADMIN_ORDER_EVENT_TYPES.shipmentCreated,
      actor_user_id: input.actorId,
      customer_visible: false,
      metadata: { shipment_status: parsed.value.status },
    });
    if (event.error) {
      return { status: "error" };
    }
    const tracking = await supabase.from("tracking_events").insert({
      shipment_id: created.data.id,
      status: parsed.value.status,
      occurred_at: new Date().toISOString(),
      created_by: input.actorId,
    });
    if (tracking.error) {
      return { status: "error" };
    }
    return syncCapturedOrder(supabase, input.orderId, input.actorId, order.data, parsed.value.status);
  } catch {
    return { status: "error" };
  }
}

function shipmentWritePayload(
  value: AdminFulfilmentInput,
  existing: { status?: unknown; shipped_at?: unknown; delivered_at?: unknown } | null,
) {
  const now = new Date().toISOString();
  const shippedAt =
    typeof existing?.shipped_at === "string" && existing.shipped_at
      ? existing.shipped_at
      : shouldStampShipped(value.status)
        ? now
        : null;
  const deliveredAt =
    typeof existing?.delivered_at === "string" && existing.delivered_at
      ? existing.delivered_at
      : value.status === "delivered"
        ? now
        : null;
  return {
    carrier_name: value.carrierName || null,
    tracking_number: value.trackingNumber || null,
    tracking_url: value.trackingUrl || null,
    status: value.status,
    shipped_at: shippedAt,
    delivered_at: deliveredAt,
    updated_at: now,
  };
}

function shouldStampShipped(status: ShipmentStatus): boolean {
  return (
    status === "dispatched" ||
    status === "in_transit" ||
    status === "out_for_delivery" ||
    status === "delivered"
  );
}

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function shipmentIdentity(value: unknown): {
  id: string;
  carrierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentStatus;
} | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !isShipmentStatus(row.status)) {
    return null;
  }
  return {
    id: row.id,
    carrierName: typeof row.carrier_name === "string" ? row.carrier_name : null,
    trackingNumber: typeof row.tracking_number === "string" ? row.tracking_number : null,
    trackingUrl: typeof row.tracking_url === "string" ? safeHttpUrl(row.tracking_url) : null,
    status: row.status,
  };
}

async function syncCapturedOrder(
  supabase: ServerClient,
  orderId: string,
  actorId: string,
  order: { status?: unknown; payment_status?: unknown },
  shipmentStatus: ShipmentStatus,
): Promise<AdminOrderMutationResult> {
  if (order.payment_status !== AWAITING_FULFILMENT_PAYMENT_STATUS || !isOrderStatus(order.status)) {
    return { status: "ok" };
  }
  const synced = await syncOrderStatusWithShipment(
    supabase,
    orderId,
    actorId,
    order.status,
    shipmentStatus,
  );
  return synced === "ok" ? { status: "ok" } : { status: "error" };
}

async function syncOrderStatusWithShipment(
  supabase: ServerClient,
  orderId: string,
  actorId: string,
  from: OrderStatus,
  shipmentStatus: ShipmentStatus,
): Promise<"ok" | "error"> {
  const target = orderStatusForShipment(shipmentStatus);
  if (!target || target === from) {
    return "ok";
  }
  const path = legalOrderStatusPath(from, target);
  if (!path) {
    return "ok";
  }
  let current: OrderStatus = from;
  for (const next of path) {
    const updated = await supabase
      .from("orders")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", current)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) {
      return "error";
    }
    const event = await supabase.from("order_events").insert({
      order_id: orderId,
      event_type: ADMIN_ORDER_EVENT_TYPES.statusChanged,
      old_status: current,
      new_status: next,
      actor_user_id: actorId,
      customer_visible: false,
    });
    if (event.error) {
      return "error";
    }
    current = next;
  }
  return "ok";
}

/**
 * One shipment per order (`shipments.order_id` unique). A repeated dispatch
 * with the same carrier and tracking does not insert another row or event.
 * A shipment already in transit or beyond is left unchanged.
 */
export async function dispatchAdminOrder(input: {
  orderId: string;
  actorId: string;
  carrierName: unknown;
  trackingNumber: unknown;
  trackingUrl: unknown;
}): Promise<AdminOrderMutationResult> {
  if (!isUuid(input.orderId) || !isUuid(input.actorId)) {
    return { status: "not_found" };
  }
  const parsed = parseAdminDispatchInput(input);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const order = await supabase
      .from("orders")
      .select("id, status, payment_status")
      .eq("id", input.orderId)
      .maybeSingle();
    if (order.error) {
      return { status: "error" };
    }
    if (!order.data) {
      return { status: "not_found" };
    }
    if (order.data.payment_status !== AWAITING_FULFILMENT_PAYMENT_STATUS) {
      return { status: "invalid", errors: { payment: ADMIN_DISPATCH_UNPAID_ERROR } };
    }
    if (!isOrderStatus(order.data.status)) {
      return { status: "error" };
    }
    const existing = await supabase
      .from("shipments")
      .select("id, status, shipped_at, delivered_at, carrier_name, tracking_number, tracking_url")
      .eq("order_id", input.orderId)
      .maybeSingle();
    if (existing.error && existing.error.code !== "PGRST116") {
      return { status: "error" };
    }
    const identity = shipmentIdentity(existing.data);
    if (isIdempotentDispatch(identity, parsed.value)) {
      return { status: "ok" };
    }
    const target = orderStatusForShipment(parsed.value.shipmentStatus);
    if (!target || legalOrderStatusPath(order.data.status, target) === null) {
      return { status: "invalid", errors: { status: ADMIN_DISPATCH_BLOCKED_ERROR } };
    }
    const fulfilment: AdminFulfilmentInput = {
      carrierName: parsed.value.carrierName,
      trackingNumber: parsed.value.trackingNumber,
      trackingUrl: parsed.value.trackingUrl,
      status: parsed.value.shipmentStatus,
    };
    const payload = shipmentWritePayload(fulfilment, existing.data);
    let shipmentId = identity?.id ?? null;
    let created = false;
    if (shipmentId) {
      const updated = await supabase.from("shipments").update(payload).eq("id", shipmentId).select("id").maybeSingle();
      if (updated.error || !updated.data) {
        return { status: "error" };
      }
    } else {
      const inserted = await supabase
        .from("shipments")
        .insert({ order_id: input.orderId, ...payload })
        .select("id")
        .maybeSingle();
      if (inserted.error?.code === "23505") {
        const again = await supabase
          .from("shipments")
          .select("id, status, carrier_name, tracking_number, tracking_url")
          .eq("order_id", input.orderId)
          .maybeSingle();
        const raced = shipmentIdentity(again.data);
        if (!raced) {
          return { status: "error" };
        }
        if (isIdempotentDispatch(raced, parsed.value)) {
          return { status: "ok" };
        }
        const updated = await supabase.from("shipments").update(payload).eq("id", raced.id).select("id").maybeSingle();
        if (updated.error || !updated.data) {
          return { status: "error" };
        }
        shipmentId = raced.id;
      } else if (inserted.error || !inserted.data || typeof inserted.data.id !== "string") {
        return { status: "error" };
      } else {
        shipmentId = inserted.data.id;
        created = true;
      }
    }
    if (!shipmentId) {
      return { status: "error" };
    }
    const event = await supabase.from("order_events").insert({
      order_id: input.orderId,
      event_type: created ? ADMIN_ORDER_EVENT_TYPES.shipmentCreated : ADMIN_ORDER_EVENT_TYPES.shipmentUpdated,
      actor_user_id: input.actorId,
      customer_visible: false,
      metadata: { shipment_status: parsed.value.shipmentStatus },
    });
    if (event.error) {
      return { status: "error" };
    }
    const previousStatus = identity?.status ?? null;
    if (created || previousStatus !== parsed.value.shipmentStatus) {
      const tracking = await supabase.from("tracking_events").insert({
        shipment_id: shipmentId,
        status: parsed.value.shipmentStatus,
        description:
          parsed.value.shipmentStatus === "tracking_unavailable"
            ? DISPATCH_TRACKING_UNAVAILABLE_DESCRIPTION
            : null,
        occurred_at: new Date().toISOString(),
        created_by: input.actorId,
      });
      if (tracking.error) {
        return { status: "error" };
      }
    }
    return syncCapturedOrder(supabase, input.orderId, input.actorId, order.data, parsed.value.shipmentStatus);
  } catch {
    return { status: "error" };
  }
}

function parseListItem(value: unknown): AdminOrderListItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.order_reference !== "string") {
    return null;
  }
  if (typeof row.customer_email !== "string" || typeof row.created_at !== "string") {
    return null;
  }
  if (!isOrderStatus(row.status) || !isPaymentStatus(row.payment_status)) {
    return null;
  }
  if (!Number.isInteger(row.total_minor) || (row.total_minor as number) < 0) {
    return null;
  }
  const first = typeof row.customer_first_name === "string" ? row.customer_first_name : "";
  const last = typeof row.customer_last_name === "string" ? row.customer_last_name : "";
  return {
    id: row.id,
    orderReference: row.order_reference.trim(),
    customerName: `${first.trim()} ${last.trim()}`.trim(),
    customerEmail: row.customer_email.trim(),
    guest: row.user_id == null,
    createdAt: row.created_at,
    paymentStatus: row.payment_status,
    orderStatus: row.status,
    totalMinor: row.total_minor as number,
  };
}

function parseDetailOrder(
  value: unknown,
): Omit<AdminOrderDetailView, "items" | "shipment" | "events" | "statusTargets"> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  const list = parseListItem(row);
  if (!list) {
    return null;
  }
  if (!Number.isInteger(row.subtotal_minor) || !Number.isInteger(row.shipping_minor)) {
    return null;
  }
  const address =
    row.delivery_address && typeof row.delivery_address === "object"
      ? (row.delivery_address as Record<string, unknown>)
      : null;
  return {
    id: list.id,
    orderReference: list.orderReference,
    createdAt: list.createdAt,
    orderStatus: list.orderStatus,
    paymentStatus: list.paymentStatus,
    guest: list.guest,
    customerName: list.customerName,
    customerEmail: list.customerEmail,
    delivery: mapAdminDelivery(address),
    subtotalMinor: row.subtotal_minor as number,
    shippingMinor: row.shipping_minor as number,
    totalMinor: list.totalMinor,
  };
}

function parseItem(value: unknown): AdminOrderItemView | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.product_name !== "string") {
    return null;
  }
  if (typeof row.colour_name !== "string" || !Number.isInteger(row.quantity) || (row.quantity as number) <= 0) {
    return null;
  }
  if (!Number.isInteger(row.unit_price_minor) || !Number.isInteger(row.line_total_minor)) {
    return null;
  }
  return {
    id: row.id,
    productName: row.product_name,
    colourName: row.colour_name,
    variantName: typeof row.variant_name === "string" ? row.variant_name : null,
    quantity: row.quantity as number,
    unitPriceMinor: row.unit_price_minor as number,
    lineTotalMinor: row.line_total_minor as number,
  };
}

function parseShipment(value: unknown): AdminShipmentView | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !isShipmentStatus(row.status)) {
    return null;
  }
  return {
    id: row.id,
    carrierName: typeof row.carrier_name === "string" ? row.carrier_name : null,
    trackingNumber: typeof row.tracking_number === "string" ? row.tracking_number : null,
    trackingUrl:
      typeof row.tracking_url === "string" ? safeHttpUrl(row.tracking_url) : null,
    status: row.status,
    events: [],
  };
}

function parseTrackingEvent(value: unknown): AdminTrackingEventView | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !isShipmentStatus(row.status) || typeof row.occurred_at !== "string") {
    return null;
  }
  return {
    id: row.id,
    status: row.status,
    description: typeof row.description === "string" ? row.description : null,
    occurredAt: row.occurred_at,
  };
}

function parseEvent(value: unknown): AdminOrderEventView | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.event_type !== "string" || typeof row.created_at !== "string") {
    return null;
  }
  return {
    id: row.id,
    eventType: row.event_type,
    label: adminOrderEventLabel(row.event_type),
    oldStatus: isOrderStatus(row.old_status) ? row.old_status : null,
    newStatus: isOrderStatus(row.new_status) ? row.new_status : null,
    createdAt: row.created_at,
  };
}
