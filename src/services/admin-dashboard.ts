import "server-only";

import { cache } from "react";
import {
  buildDashboardKpis,
  dashboardPeriodRange,
  groupSalesByDay,
  hasSalesActivity,
  isOrderStatus,
  isPaymentStatus,
  isQualifyingRevenuePayment,
  RECENT_ORDERS_LIMIT,
  type DashboardDayPoint,
  type DashboardKpis,
  type DashboardOrderMetricRow,
  type DashboardPeriod,
} from "@/contracts/admin/dashboard";
import type { OrderStatus, PaymentStatus } from "@/contracts/order/schema";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PERIOD_ORDER_COLUMNS = "id, payment_status, total_minor, created_at";
const RECENT_ORDER_COLUMNS =
  "id, order_reference, customer_first_name, customer_last_name, status, payment_status, total_minor, created_at";
const PAGE_SIZE = 1000;

export type DashboardLoadResult<T> =
  | { status: "ok"; data: T }
  | { status: "error" };

export type DashboardPeriodSnapshot = {
  period: DashboardPeriod;
  kpis: DashboardKpis;
  series: DashboardDayPoint[];
  hasSales: boolean;
};

export type DashboardRecentOrder = {
  id: string;
  orderReference: string;
  customer: string;
  createdAt: string;
  totalMinor: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
};

export type DashboardAlert = {
  id: string;
  label: string;
  count: number;
};

export const loadDashboardPeriodSnapshot = cache(async function loadDashboardPeriodSnapshot(
  period: DashboardPeriod,
): Promise<DashboardLoadResult<DashboardPeriodSnapshot>> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const range = dashboardPeriodRange(period, new Date());
    const supabase = await createSupabaseServerClient();
    const orders: DashboardOrderMetricRow[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select(PERIOD_ORDER_COLUMNS)
        .gte("created_at", range.startIso)
        .lt("created_at", range.endIso)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        return { status: "error" };
      }
      const chunk = Array.isArray(data) ? data : [];
      for (const row of chunk) {
        const parsed = parseMetricRow(row);
        if (parsed) {
          orders.push(parsed);
        }
      }
      if (chunk.length < PAGE_SIZE) {
        break;
      }
      from += PAGE_SIZE;
    }

    const capturedIds = orders
      .filter((order) => isQualifyingRevenuePayment(order.payment_status))
      .map((order) => order.id);
    const productsSold = await sumCapturedQuantities(capturedIds);
    if (productsSold === null) {
      return { status: "error" };
    }

    const kpis = buildDashboardKpis({ orders, productsSold });
    const series = groupSalesByDay(orders, range);
    return {
      status: "ok",
      data: {
        period,
        kpis,
        series,
        hasSales: hasSalesActivity(series),
      },
    };
  } catch {
    return { status: "error" };
  }
});

export const loadDashboardRecentOrders = cache(async function loadDashboardRecentOrders(): Promise<
  DashboardLoadResult<DashboardRecentOrder[]>
> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("orders")
      .select(RECENT_ORDER_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(RECENT_ORDERS_LIMIT);
    if (error) {
      return { status: "error" };
    }
    const orders: DashboardRecentOrder[] = [];
    for (const row of Array.isArray(data) ? data : []) {
      const parsed = parseRecentOrder(row);
      if (parsed) {
        orders.push(parsed);
      }
    }
    return { status: "ok", data: orders };
  } catch {
    return { status: "error" };
  }
});

export const loadDashboardAlerts = cache(async function loadDashboardAlerts(): Promise<
  DashboardLoadResult<DashboardAlert[]>
> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const [exceptions, tracking, failedPayments, shipmentExceptions, outOfStock] =
      await Promise.all([
        countRows(supabase, "orders", { column: "status", value: "exception" }),
        countRows(supabase, "orders", { column: "status", value: "tracking_unavailable" }),
        countRows(supabase, "orders", { column: "payment_status", value: "failed" }),
        countRows(supabase, "shipments", { column: "status", value: "exception" }),
        countOutOfStock(supabase),
      ]);
    if (
      exceptions === null ||
      tracking === null ||
      failedPayments === null ||
      shipmentExceptions === null ||
      outOfStock === null
    ) {
      return { status: "error" };
    }
    const alerts: DashboardAlert[] = [];
    pushAlert(alerts, "order-exceptions", exceptions, "Fulfilment exception", "Fulfilment exceptions");
    pushAlert(alerts, "tracking-unavailable", tracking, "Tracking unavailable", "Tracking unavailable");
    pushAlert(alerts, "failed-payments", failedPayments, "Failed payment", "Failed payments");
    pushAlert(alerts, "shipment-exceptions", shipmentExceptions, "Shipment exception", "Shipment exceptions");
    pushAlert(alerts, "out-of-stock", outOfStock, "Available variant with no stock", "Available variants with no stock");
    return { status: "ok", data: alerts };
  } catch {
    return { status: "error" };
  }
});

type AdminQueryClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function sumCapturedQuantities(orderIds: string[]): Promise<number | null> {
  if (orderIds.length === 0) {
    return 0;
  }
  try {
    const supabase = await createSupabaseServerClient();
    let total = 0;
    for (let index = 0; index < orderIds.length; index += PAGE_SIZE) {
      const slice = orderIds.slice(index, index + PAGE_SIZE);
      const { data, error } = await supabase
        .from("order_items")
        .select("quantity")
        .in("order_id", slice);
      if (error) {
        return null;
      }
      for (const row of Array.isArray(data) ? data : []) {
        if (!row || typeof row !== "object" || !("quantity" in row)) {
          continue;
        }
        const quantity = (row as { quantity: unknown }).quantity;
        if (Number.isInteger(quantity) && (quantity as number) > 0) {
          total += quantity as number;
        }
      }
    }
    return total;
  } catch {
    return null;
  }
}

async function countRows(
  supabase: AdminQueryClient,
  table: "orders" | "shipments",
  filter: { column: string; value: string },
): Promise<number | null> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(filter.column, filter.value);
  if (error || typeof count !== "number") {
    return null;
  }
  return count;
}

async function countOutOfStock(supabase: AdminQueryClient): Promise<number | null> {
  const { count, error } = await supabase
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .eq("status", "available")
    .eq("stock_quantity", 0);
  if (error || typeof count !== "number") {
    return null;
  }
  return count;
}

function pushAlert(
  alerts: DashboardAlert[],
  id: string,
  count: number,
  singular: string,
  plural: string,
): void {
  if (count <= 0) {
    return;
  }
  alerts.push({
    id,
    count,
    label: count === 1 ? singular : plural,
  });
}

function parseMetricRow(value: unknown): DashboardOrderMetricRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || row.id.length === 0) {
    return null;
  }
  if (!isPaymentStatus(row.payment_status)) {
    return null;
  }
  if (!Number.isInteger(row.total_minor) || (row.total_minor as number) < 0) {
    return null;
  }
  if (typeof row.created_at !== "string" || Number.isNaN(new Date(row.created_at).getTime())) {
    return null;
  }
  return {
    id: row.id,
    payment_status: row.payment_status,
    total_minor: row.total_minor as number,
    created_at: row.created_at,
  };
}

function parseRecentOrder(value: unknown): DashboardRecentOrder | null {
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
  if (!Number.isInteger(row.total_minor) || (row.total_minor as number) < 0) {
    return null;
  }
  if (typeof row.created_at !== "string" || Number.isNaN(new Date(row.created_at).getTime())) {
    return null;
  }
  return {
    id: row.id,
    orderReference: row.order_reference.trim(),
    customer: `${row.customer_first_name.trim()} ${row.customer_last_name.trim()}`.trim(),
    createdAt: row.created_at,
    totalMinor: row.total_minor as number,
    paymentStatus: row.payment_status,
    orderStatus: row.status,
  };
}
