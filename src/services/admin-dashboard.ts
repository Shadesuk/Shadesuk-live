import "server-only";

import { cache } from "react";
import { COMMITTED_PURCHASE_PAYMENT_STATUSES } from "@/contracts/order/lifecycle";
import {
  dashboardPeriodRange,
  formatDashboardRangeLabel,
  groupSalesByDay,
  hasSalesActivity,
  isOrderStatus,
  isPaymentStatus,
  RECENT_ORDERS_LIMIT,
  type DashboardDayPoint,
  type DashboardPeriod,
} from "@/contracts/admin/dashboard";
import type { PaymentCurrencyTotal, PaymentStatusCounts } from "@/contracts/admin/payment-report";
import { PAYMENT_REPORT_UNAVAILABLE } from "@/contracts/admin/payment-report";
import { loadPaymentPeriod } from "@/services/admin-payment-ledger";
import type { OrderStatus, PaymentStatus } from "@/contracts/order/schema";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const RECENT_ORDER_COLUMNS =
  "id, order_reference, customer_first_name, customer_last_name, status, payment_status, total_minor, created_at";
const PAGE_SIZE = 1000;

export type DashboardLoadResult<T> =
  | { status: "ok"; data: T }
  | { status: "error" };

export type DashboardCurrencySeries = {
  currency: string;
  points: DashboardDayPoint[];
};

export type DashboardPeriodSnapshot = {
  period: DashboardPeriod;
  rangeLabel: string;
  currencies: PaymentCurrencyTotal[];
  counts: PaymentStatusCounts;
  series: DashboardCurrencySeries[];
  hasSales: boolean;
  productsSold: number;
  settlement: typeof PAYMENT_REPORT_UNAVAILABLE;
  fees: typeof PAYMENT_REPORT_UNAVAILABLE;
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

export const loadDashboardPeriodSnapshot = cache(async function loadDashboardPeriodSnapshot(
  period: DashboardPeriod,
): Promise<DashboardLoadResult<DashboardPeriodSnapshot>> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const range = dashboardPeriodRange(period, new Date());
    const loaded = await loadPaymentPeriod(range);
    if (loaded.status !== "ok") {
      return { status: "error" };
    }
    const { report } = loaded;
    const productsSold = await sumCapturedQuantities(report.capturedOrderIds);
    if (productsSold === null) {
      return { status: "error" };
    }
    const series = report.currencies
      .filter((total) => total.capturedMinor > 0)
      .map((total) => ({
        currency: total.currency,
        points: groupSalesByDay(
          report.charges
            .filter((charge) => charge.currency === total.currency)
            .map((charge) => ({
              id: charge.occurredAt,
              payment_status: "captured" as const,
              total_minor: charge.amountMinor,
              created_at: charge.occurredAt,
            })),
          range,
        ),
      }));
    return {
      status: "ok",
      data: {
        period,
        rangeLabel: formatDashboardRangeLabel(range),
        currencies: report.currencies,
        counts: report.counts,
        series,
        hasSales: series.some((item) => hasSalesActivity(item.points)),
        productsSold,
        settlement: PAYMENT_REPORT_UNAVAILABLE,
        fees: PAYMENT_REPORT_UNAVAILABLE,
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
      .in("payment_status", [...COMMITTED_PURCHASE_PAYMENT_STATUSES])
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
