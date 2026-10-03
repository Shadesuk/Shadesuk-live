import "server-only";

import { cache } from "react";
import { isOrderStatus, isPaymentStatus, isShipmentStatus } from "@/contracts/admin/dashboard";
import {
  AWAITING_FULFILMENT_ORDER_STATUS_LIST,
  AWAITING_FULFILMENT_PAYMENT,
  attentionItemsFromCounts,
  emailBreakdownTotal,
  isEmailEventStatus,
  missingTrackingOrFilter,
  IN_TRANSIT_QUEUE_STATUSES,
  OPS_EMAIL_ORDER_CONFIRMATION,
  OPS_EMAIL_SHIPMENT_CONFIRMATION,
  OPS_PAGE_SIZE,
  opsPageCount,
  LOW_STOCK_THRESHOLD,
  type AttentionItem,
  type CommunicationView,
  type EmailEventStatus,
  type FulfilmentView,
  type InventoryView,
  type OpsEmailCounts,
  type OpsEmailRow,
  type OpsFulfilmentRow,
  type OpsInventoryRow,
  type OpsPage,
} from "@/contracts/admin/ops";
import type { ShipmentStatus } from "@/contracts/fulfilment/shipment";
import type { OrderStatus, PaymentStatus } from "@/contracts/order/schema";
import { formatAdminCustomerName } from "@/lib/admin-format";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SCAN_SIZE = 1000;

export type OpsLoadResult<T> = { status: "ok"; data: T } | { status: "error" };

export type OpsInventorySnapshot = {
  lowVariants: number;
  lowProducts: number;
  outVariants: number;
  page: OpsPage<OpsInventoryRow>;
};

export type OpsCommunicationsSnapshot = {
  counts: OpsEmailCounts;
  page: OpsPage<OpsEmailRow>;
};

type QueryClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const loadNeedsAttention = cache(async function loadNeedsAttention(): Promise<
  OpsLoadResult<AttentionItem[]>
> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const [awaitingFulfilment, missingTracking, deliveryExceptions, failedEmails, lowStockProducts] =
      await Promise.all([
        countAwaitingFulfilment(supabase),
        countMissingTracking(supabase),
        countDeliveryExceptions(supabase),
        countEmailRows(supabase, { status: "failed" }),
        countLowStockProducts(supabase),
      ]);
    if (
      awaitingFulfilment === null ||
      missingTracking === null ||
      deliveryExceptions === null ||
      failedEmails === null ||
      lowStockProducts === null
    ) {
      return { status: "error" };
    }
    return {
      status: "ok",
      data: attentionItemsFromCounts({
        awaitingFulfilment,
        missingTracking,
        deliveryExceptions,
        failedEmails,
        lowStockProducts,
      }),
    };
  } catch {
    return { status: "error" };
  }
});

export const loadFulfilmentQueue = cache(async function loadFulfilmentQueue(
  view: FulfilmentView,
  page: number,
): Promise<OpsLoadResult<OpsPage<OpsFulfilmentRow>>> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    if (view === "awaiting") {
      return loadAwaitingFulfilment(supabase, page);
    }
    if (view === "exceptions") {
      return loadDeliveryExceptions(supabase, page);
    }
    return loadShipmentQueue(supabase, view, page);
  } catch {
    return { status: "error" };
  }
});

export const loadInventory = cache(async function loadInventory(
  view: InventoryView,
  page: number,
): Promise<OpsLoadResult<OpsInventorySnapshot>> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const [lowVariants, lowProducts, outVariants, list] = await Promise.all([
      countVariants(supabase, "low"),
      countLowStockProducts(supabase),
      countVariants(supabase, "out"),
      loadInventoryPage(supabase, view, page),
    ]);
    if (lowVariants === null || lowProducts === null || outVariants === null || list === null) {
      return { status: "error" };
    }
    return {
      status: "ok",
      data: {
        lowVariants,
        lowProducts,
        outVariants,
        page: list,
      },
    };
  } catch {
    return { status: "error" };
  }
});

export const loadCommunications = cache(async function loadCommunications(
  view: CommunicationView,
  page: number,
): Promise<OpsLoadResult<OpsCommunicationsSnapshot>> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const [
      failed,
      orderConfirmations,
      orderConfirmationsSent,
      orderConfirmationsFailed,
      orderConfirmationsPending,
      shipmentConfirmations,
      shipmentConfirmationsSent,
      shipmentConfirmationsFailed,
      shipmentConfirmationsPending,
      list,
    ] = await Promise.all([
      countEmailRows(supabase, { status: "failed" }),
      countEmailRows(supabase, { emailType: OPS_EMAIL_ORDER_CONFIRMATION }),
      countEmailRows(supabase, { emailType: OPS_EMAIL_ORDER_CONFIRMATION, status: "sent" }),
      countEmailRows(supabase, { emailType: OPS_EMAIL_ORDER_CONFIRMATION, status: "failed" }),
      countEmailRows(supabase, { emailType: OPS_EMAIL_ORDER_CONFIRMATION, status: "pending" }),
      countEmailRows(supabase, { emailType: OPS_EMAIL_SHIPMENT_CONFIRMATION }),
      countEmailRows(supabase, { emailType: OPS_EMAIL_SHIPMENT_CONFIRMATION, status: "sent" }),
      countEmailRows(supabase, { emailType: OPS_EMAIL_SHIPMENT_CONFIRMATION, status: "failed" }),
      countEmailRows(supabase, { emailType: OPS_EMAIL_SHIPMENT_CONFIRMATION, status: "pending" }),
      loadEmailPage(supabase, view, page),
    ]);
    const counts = {
      failed,
      orderConfirmations,
      orderConfirmationsSent,
      orderConfirmationsFailed,
      orderConfirmationsPending,
      shipmentConfirmations,
      shipmentConfirmationsSent,
      shipmentConfirmationsFailed,
      shipmentConfirmationsPending,
    };
    if (Object.values(counts).some((value) => value === null) || list === null) {
      return { status: "error" };
    }
    const resolved = counts as { [Key in keyof OpsEmailCounts]: number };
    if (
      emailBreakdownTotal({
        sent: resolved.orderConfirmationsSent,
        failed: resolved.orderConfirmationsFailed,
        pending: resolved.orderConfirmationsPending,
      }) !== resolved.orderConfirmations ||
      emailBreakdownTotal({
        sent: resolved.shipmentConfirmationsSent,
        failed: resolved.shipmentConfirmationsFailed,
        pending: resolved.shipmentConfirmationsPending,
      }) !== resolved.shipmentConfirmations
    ) {
      return { status: "error" };
    }
    return { status: "ok", data: { counts: resolved, page: list } };
  } catch {
    return { status: "error" };
  }
});

async function countAwaitingFulfilment(supabase: QueryClient): Promise<number | null> {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("payment_status", AWAITING_FULFILMENT_PAYMENT)
    .is("cancelled_at", null)
    .in("status", [...AWAITING_FULFILMENT_ORDER_STATUS_LIST]);
  return exactCount(count, error);
}

async function countMissingTracking(supabase: QueryClient): Promise<number | null> {
  const { count, error } = await supabase
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .or(missingTrackingOrFilter());
  return exactCount(count, error);
}

async function countDeliveryExceptions(supabase: QueryClient): Promise<number | null> {
  const ids = await deliveryExceptionIds(supabase);
  return ids === null ? null : ids.length;
}

async function countLowStockProducts(supabase: QueryClient): Promise<number | null> {
  const ids = new Set<string>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("product_variants")
      .select("product_id")
      .eq("status", "available")
      .gt("stock_quantity", 0)
      .lte("stock_quantity", LOW_STOCK_THRESHOLD)
      .range(from, from + SCAN_SIZE - 1);
    if (error) {
      return null;
    }
    const chunk = Array.isArray(data) ? data : [];
    for (const row of chunk) {
      if (row && typeof row === "object" && "product_id" in row && typeof row.product_id === "string") {
        ids.add(row.product_id);
      }
    }
    if (chunk.length < SCAN_SIZE) {
      return ids.size;
    }
    from += SCAN_SIZE;
  }
}

async function countVariants(supabase: QueryClient, view: InventoryView): Promise<number | null> {
  let request = supabase
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .eq("status", "available");
  request =
    view === "out"
      ? request.eq("stock_quantity", 0)
      : request.gt("stock_quantity", 0).lte("stock_quantity", LOW_STOCK_THRESHOLD);
  const { count, error } = await request;
  return exactCount(count, error);
}

async function countEmailRows(
  supabase: QueryClient,
  filter: { status?: EmailEventStatus; emailType?: string },
): Promise<number | null> {
  let request = supabase.from("email_events").select("id", { count: "exact", head: true });
  if (filter.status) {
    request = request.eq("status", filter.status);
  }
  if (filter.emailType) {
    request = request.eq("email_type", filter.emailType);
  }
  const { count, error } = await request;
  return exactCount(count, error);
}

async function loadAwaitingFulfilment(
  supabase: QueryClient,
  page: number,
): Promise<OpsLoadResult<OpsPage<OpsFulfilmentRow>>> {
  const from = (page - 1) * OPS_PAGE_SIZE;
  const to = from + OPS_PAGE_SIZE - 1;
  const { data, error, count } = await supabase
    .from("orders")
    .select(
      "id, order_reference, customer_first_name, customer_last_name, status, payment_status, created_at",
      { count: "exact" },
    )
    .eq("payment_status", AWAITING_FULFILMENT_PAYMENT)
    .is("cancelled_at", null)
    .in("status", [...AWAITING_FULFILMENT_ORDER_STATUS_LIST])
    .order("created_at", { ascending: true })
    .range(from, to);
  const total = exactCount(count, error);
  if (total === null) {
    return { status: "error" };
  }
  const orders = parseOrderRows(data);
  const shipments = await loadShipmentsForOrders(
    supabase,
    orders.map((order) => order.id),
  );
  if (shipments === null) {
    return { status: "error" };
  }
  return { status: "ok", data: pageResult(joinFulfilment(orders, shipments), total, page) };
}

async function loadShipmentQueue(
  supabase: QueryClient,
  view: Exclude<FulfilmentView, "awaiting" | "exceptions">,
  page: number,
): Promise<OpsLoadResult<OpsPage<OpsFulfilmentRow>>> {
  const from = (page - 1) * OPS_PAGE_SIZE;
  const to = from + OPS_PAGE_SIZE - 1;
  let request = supabase
    .from("shipments")
    .select("order_id, status, tracking_number, carrier_name, updated_at", { count: "exact" })
    .order("updated_at", { ascending: true })
    .range(from, to);
  if (view === "dispatched") {
    request = request.eq("status", "dispatched");
  } else if (view === "in_transit") {
    request = request.in("status", [...IN_TRANSIT_QUEUE_STATUSES]);
  } else {
    request = request.or(missingTrackingOrFilter());
  }
  const { data, error, count } = await request;
  const total = exactCount(count, error);
  if (total === null) {
    return { status: "error" };
  }
  const shipments = parseShipmentRows(data);
  const orders = await loadOrdersByIds(
    supabase,
    shipments.map((shipment) => shipment.orderId),
  );
  if (orders === null) {
    return { status: "error" };
  }
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const rows: OpsFulfilmentRow[] = [];
  for (const shipment of shipments) {
    const order = orderById.get(shipment.orderId);
    if (!order) {
      continue;
    }
    rows.push(toFulfilmentRow(order, shipment));
  }
  return { status: "ok", data: pageResult(rows, total, page) };
}

async function loadDeliveryExceptions(
  supabase: QueryClient,
  page: number,
): Promise<OpsLoadResult<OpsPage<OpsFulfilmentRow>>> {
  const ids = await deliveryExceptionIds(supabase);
  if (ids === null) {
    return { status: "error" };
  }
  const from = (page - 1) * OPS_PAGE_SIZE;
  const slice = ids.slice(from, from + OPS_PAGE_SIZE).map((entry) => entry.id);
  if (slice.length === 0) {
    return { status: "ok", data: pageResult([], ids.length, page) };
  }
  const [orders, shipments] = await Promise.all([
    loadOrdersByIds(supabase, slice),
    loadShipmentsForOrders(supabase, slice),
  ]);
  if (orders === null || shipments === null) {
    return { status: "error" };
  }
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const rows: OpsFulfilmentRow[] = [];
  for (const id of slice) {
    const order = orderById.get(id);
    if (!order) {
      continue;
    }
    rows.push(toFulfilmentRow(order, shipments.get(id) ?? null));
  }
  return { status: "ok", data: pageResult(rows, ids.length, page) };
}

async function deliveryExceptionIds(
  supabase: QueryClient,
): Promise<Array<{ id: string; createdAt: string }> | null> {
  const byId = new Map<string, string>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, created_at")
      .eq("status", "exception")
      .order("created_at", { ascending: false })
      .range(from, from + SCAN_SIZE - 1);
    if (error) {
      return null;
    }
    const chunk = Array.isArray(data) ? data : [];
    for (const row of chunk) {
      const parsed = parseIdStamp(row);
      if (parsed) {
        byId.set(parsed.id, parsed.createdAt);
      }
    }
    if (chunk.length < SCAN_SIZE) {
      break;
    }
    from += SCAN_SIZE;
  }

  from = 0;
  const shipmentOrderIds: string[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("shipments")
      .select("order_id")
      .eq("status", "exception")
      .range(from, from + SCAN_SIZE - 1);
    if (error) {
      return null;
    }
    const chunk = Array.isArray(data) ? data : [];
    for (const row of chunk) {
      if (row && typeof row === "object" && "order_id" in row && typeof row.order_id === "string") {
        if (!byId.has(row.order_id)) {
          shipmentOrderIds.push(row.order_id);
        }
      }
    }
    if (chunk.length < SCAN_SIZE) {
      break;
    }
    from += SCAN_SIZE;
  }

  for (let index = 0; index < shipmentOrderIds.length; index += SCAN_SIZE) {
    const slice = shipmentOrderIds.slice(index, index + SCAN_SIZE);
    const { data, error } = await supabase.from("orders").select("id, created_at").in("id", slice);
    if (error) {
      return null;
    }
    for (const row of Array.isArray(data) ? data : []) {
      const parsed = parseIdStamp(row);
      if (parsed) {
        byId.set(parsed.id, parsed.createdAt);
      }
    }
  }

  return [...byId.entries()]
    .map(([id, createdAt]) => ({ id, createdAt }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
}

async function loadInventoryPage(
  supabase: QueryClient,
  view: InventoryView,
  page: number,
): Promise<OpsPage<OpsInventoryRow> | null> {
  const from = (page - 1) * OPS_PAGE_SIZE;
  const to = from + OPS_PAGE_SIZE - 1;
  let request = supabase
    .from("product_variants")
    .select("id, product_id, sku, colour_name, stock_quantity", { count: "exact" })
    .eq("status", "available")
    .order("stock_quantity", { ascending: true })
    .order("sku", { ascending: true })
    .range(from, to);
  request =
    view === "out"
      ? request.eq("stock_quantity", 0)
      : request.gt("stock_quantity", 0).lte("stock_quantity", LOW_STOCK_THRESHOLD);
  const { data, error, count } = await request;
  const total = exactCount(count, error);
  if (total === null) {
    return null;
  }
  const variants = parseVariantRows(data);
  const names = await loadProductNames(
    supabase,
    variants.map((variant) => variant.productId),
  );
  if (names === null) {
    return null;
  }
  const rows: OpsInventoryRow[] = [];
  for (const variant of variants) {
    const productName = names.get(variant.productId);
    if (!productName) {
      continue;
    }
    rows.push({ ...variant, productName });
  }
  return pageResult(rows, total, page);
}

async function loadEmailPage(
  supabase: QueryClient,
  view: CommunicationView,
  page: number,
): Promise<OpsPage<OpsEmailRow> | null> {
  const from = (page - 1) * OPS_PAGE_SIZE;
  const to = from + OPS_PAGE_SIZE - 1;
  let request = supabase
    .from("email_events")
    .select("id, email_type, status, recipient_email, error_message, created_at, order_id", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);
  request =
    view === "failed"
      ? request.eq("status", "failed")
      : request.in("email_type", [OPS_EMAIL_ORDER_CONFIRMATION, OPS_EMAIL_SHIPMENT_CONFIRMATION]);
  const { data, error, count } = await request;
  const total = exactCount(count, error);
  if (total === null) {
    return null;
  }
  const events = parseEmailRows(data);
  const references = await loadOrderReferences(
    supabase,
    events.flatMap((event) => (event.orderId ? [event.orderId] : [])),
  );
  if (references === null) {
    return null;
  }
  return pageResult(
    events.map((event) => ({
      ...event,
      orderReference: event.orderId ? references.get(event.orderId) ?? null : null,
    })),
    total,
    page,
  );
}

type OrderCore = {
  id: string;
  orderReference: string;
  customerName: string;
  createdAt: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
};

type ShipmentCore = {
  orderId: string;
  status: ShipmentStatus;
  trackingNumber: string | null;
  carrierName: string | null;
};

async function loadOrdersByIds(supabase: QueryClient, ids: string[]): Promise<OrderCore[] | null> {
  if (ids.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_reference, customer_first_name, customer_last_name, status, payment_status, created_at",
    )
    .in("id", ids);
  if (error) {
    return null;
  }
  return parseOrderRows(data);
}

async function loadShipmentsForOrders(
  supabase: QueryClient,
  orderIds: string[],
): Promise<Map<string, ShipmentCore> | null> {
  if (orderIds.length === 0) {
    return new Map();
  }
  const { data, error } = await supabase
    .from("shipments")
    .select("order_id, status, tracking_number, carrier_name")
    .in("order_id", orderIds);
  if (error) {
    return null;
  }
  const map = new Map<string, ShipmentCore>();
  for (const shipment of parseShipmentRows(data)) {
    map.set(shipment.orderId, shipment);
  }
  return map;
}

async function loadProductNames(
  supabase: QueryClient,
  productIds: string[],
): Promise<Map<string, string> | null> {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) {
    return new Map();
  }
  const { data, error } = await supabase.from("products").select("id, name").in("id", unique);
  if (error) {
    return null;
  }
  const names = new Map<string, string>();
  for (const row of Array.isArray(data) ? data : []) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const record = row as Record<string, unknown>;
    if (typeof record.id === "string" && typeof record.name === "string" && record.name.trim()) {
      names.set(record.id, record.name.trim());
    }
  }
  return names;
}

async function loadOrderReferences(
  supabase: QueryClient,
  orderIds: string[],
): Promise<Map<string, string> | null> {
  const unique = [...new Set(orderIds)];
  if (unique.length === 0) {
    return new Map();
  }
  const { data, error } = await supabase.from("orders").select("id, order_reference").in("id", unique);
  if (error) {
    return null;
  }
  const references = new Map<string, string>();
  for (const row of Array.isArray(data) ? data : []) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const record = row as Record<string, unknown>;
    if (
      typeof record.id === "string" &&
      typeof record.order_reference === "string" &&
      record.order_reference.trim()
    ) {
      references.set(record.id, record.order_reference.trim());
    }
  }
  return references;
}

function joinFulfilment(orders: OrderCore[], shipments: Map<string, ShipmentCore>): OpsFulfilmentRow[] {
  return orders.map((order) => toFulfilmentRow(order, shipments.get(order.id) ?? null));
}

function toFulfilmentRow(order: OrderCore, shipment: ShipmentCore | null): OpsFulfilmentRow {
  return {
    orderId: order.id,
    orderReference: order.orderReference,
    customerName: order.customerName,
    createdAt: order.createdAt,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    shipmentStatus: shipment?.status ?? null,
    trackingNumber: shipment?.trackingNumber ?? null,
    carrierName: shipment?.carrierName ?? null,
  };
}

function pageResult<T>(rows: T[], total: number, page: number): OpsPage<T> {
  return {
    rows,
    total,
    page,
    pageCount: opsPageCount(total),
  };
}

function exactCount(count: number | null, error: { message: string } | null): number | null {
  if (error || typeof count !== "number") {
    return null;
  }
  return count;
}

function parseOrderRows(value: unknown): OrderCore[] {
  const rows: OrderCore[] = [];
  for (const row of Array.isArray(value) ? value : []) {
    const parsed = parseOrderRow(row);
    if (parsed) {
      rows.push(parsed);
    }
  }
  return rows;
}

function parseOrderRow(value: unknown): OrderCore | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || row.id.length === 0) {
    return null;
  }
  if (typeof row.order_reference !== "string" || row.order_reference.trim() === "") {
    return null;
  }
  if (typeof row.customer_first_name !== "string" || typeof row.customer_last_name !== "string") {
    return null;
  }
  if (!isOrderStatus(row.status) || !isPaymentStatus(row.payment_status)) {
    return null;
  }
  if (typeof row.created_at !== "string" || Number.isNaN(new Date(row.created_at).getTime())) {
    return null;
  }
  return {
    id: row.id,
    orderReference: row.order_reference.trim(),
    customerName: formatAdminCustomerName(row.customer_first_name, row.customer_last_name),
    createdAt: row.created_at,
    orderStatus: row.status,
    paymentStatus: row.payment_status,
  };
}

function parseShipmentRows(value: unknown): ShipmentCore[] {
  const rows: ShipmentCore[] = [];
  for (const row of Array.isArray(value) ? value : []) {
    const parsed = parseShipmentRow(row);
    if (parsed) {
      rows.push(parsed);
    }
  }
  return rows;
}

function parseShipmentRow(value: unknown): ShipmentCore | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.order_id !== "string" || row.order_id.length === 0) {
    return null;
  }
  if (!isShipmentStatus(row.status)) {
    return null;
  }
  return {
    orderId: row.order_id,
    status: row.status,
    trackingNumber: optionalText(row.tracking_number),
    carrierName: optionalText(row.carrier_name),
  };
}

function parseVariantRows(value: unknown): Array<Omit<OpsInventoryRow, "productName">> {
  const rows: Array<Omit<OpsInventoryRow, "productName">> = [];
  for (const entry of Array.isArray(value) ? value : []) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.product_id !== "string") {
      continue;
    }
    if (typeof row.sku !== "string" || row.sku.trim() === "") {
      continue;
    }
    if (typeof row.colour_name !== "string" || row.colour_name.trim() === "") {
      continue;
    }
    if (!Number.isInteger(row.stock_quantity) || (row.stock_quantity as number) < 0) {
      continue;
    }
    rows.push({
      variantId: row.id,
      productId: row.product_id,
      sku: row.sku.trim(),
      colourName: row.colour_name.trim(),
      stockQuantity: row.stock_quantity as number,
    });
  }
  return rows;
}

function parseEmailRows(value: unknown): OpsEmailRow[] {
  const rows: OpsEmailRow[] = [];
  for (const entry of Array.isArray(value) ? value : []) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.email_type !== "string" || row.email_type.trim() === "") {
      continue;
    }
    if (!isEmailEventStatus(row.status)) {
      continue;
    }
    if (typeof row.recipient_email !== "string" || row.recipient_email.trim() === "") {
      continue;
    }
    if (typeof row.created_at !== "string" || Number.isNaN(new Date(row.created_at).getTime())) {
      continue;
    }
    rows.push({
      id: row.id,
      emailType: row.email_type.trim(),
      status: row.status,
      recipientEmail: row.recipient_email.trim(),
      errorMessage: optionalText(row.error_message),
      createdAt: row.created_at,
      orderId: typeof row.order_id === "string" && row.order_id.length > 0 ? row.order_id : null,
      orderReference: null,
    });
  }
  return rows;
}

function parseIdStamp(value: unknown): { id: string; createdAt: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || row.id.length === 0) {
    return null;
  }
  if (typeof row.created_at !== "string" || Number.isNaN(new Date(row.created_at).getTime())) {
    return null;
  }
  return { id: row.id, createdAt: row.created_at };
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
