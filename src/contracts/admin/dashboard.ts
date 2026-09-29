import { isCommittedPurchase } from "../order/lifecycle";
import type { OrderStatus, PaymentStatus } from "../order/schema";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "../order/schema";
import { SHIPMENT_STATUSES, type ShipmentStatus } from "../fulfilment/shipment";

/**
 * Admin V1 dashboard contracts.
 *
 * Revenue follows the payment trust rule in `contracts/payment/stub.ts`:
 * only `captured` is paid. Created / authorised / failed / cancelled /
 * refunded rows are never treated as successful revenue.
 */

export const ADMIN_DASHBOARD_TIME_ZONE = "Europe/London";

export const DASHBOARD_PERIODS = ["today", "7d", "30d"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriod = "7d";

export const DASHBOARD_PERIOD_LABELS = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
} as const satisfies Record<DashboardPeriod, string>;

export const DASHBOARD_PERIOD_DAY_COUNTS = {
  today: 1,
  "7d": 7,
  "30d": 30,
} as const satisfies Record<DashboardPeriod, number>;

export const RECENT_ORDERS_LIMIT = 8;

export const QUALIFYING_REVENUE_PAYMENT_STATUS = "captured" satisfies PaymentStatus;

export type DashboardDateRange = {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  dayKeys: string[];
};

export type DashboardOrderMetricRow = {
  id: string;
  payment_status: PaymentStatus;
  total_minor: number;
  created_at: string;
};

export type DashboardDayPoint = {
  dateKey: string;
  label: string;
  revenueMinor: number;
  orderCount: number;
  qualifyingOrderCount: number;
};

export type DashboardKpis = {
  revenueMinor: number;
  orderCount: number;
  qualifyingOrderCount: number;
  aovMinor: number | null;
  productsSold: number;
};

export const ADMIN_ORDER_STATUS_LABELS = {
  placed: "Placed",
  processing: "Processing",
  dispatched: "Dispatched",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  exception: "Exception",
  tracking_unavailable: "Tracking unavailable",
  checkout: "Checkout",
} as const satisfies Record<OrderStatus, string>;

export const ADMIN_PAYMENT_STATUS_LABELS = {
  created: "Created",
  authorized: "Authorised",
  captured: "Captured",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
} as const satisfies Record<PaymentStatus, string>;

export function isDashboardPeriod(value: string | null | undefined): value is DashboardPeriod {
  return value === "today" || value === "7d" || value === "30d";
}

export function parseDashboardPeriod(value: unknown): DashboardPeriod {
  if (typeof value === "string" && isDashboardPeriod(value)) {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string" && isDashboardPeriod(value[0])) {
    return value[0];
  }
  return DEFAULT_DASHBOARD_PERIOD;
}

export function isQualifyingRevenuePayment(
  status: PaymentStatus | string | null | undefined,
): boolean {
  return status === QUALIFYING_REVENUE_PAYMENT_STATUS;
}

export function averageOrderValueMinor(
  revenueMinor: number,
  qualifyingOrderCount: number,
): number | null {
  if (!Number.isInteger(revenueMinor) || revenueMinor < 0) {
    throw new Error("revenueMinor must be a non-negative integer.");
  }
  if (!Number.isInteger(qualifyingOrderCount) || qualifyingOrderCount < 0) {
    throw new Error("qualifyingOrderCount must be a non-negative integer.");
  }
  if (qualifyingOrderCount === 0) {
    return null;
  }
  return Math.round(revenueMinor / qualifyingOrderCount);
}

export function sumRevenueMinor(rows: readonly DashboardOrderMetricRow[]): number {
  let total = 0;
  for (const row of rows) {
    if (isQualifyingRevenuePayment(row.payment_status)) {
      total += row.total_minor;
    }
  }
  return total;
}

export function countCommittedOrders(rows: readonly DashboardOrderMetricRow[]): number {
  let count = 0;
  for (const row of rows) {
    if (isCommittedPurchase(row.payment_status)) {
      count += 1;
    }
  }
  return count;
}

export function countQualifyingOrders(rows: readonly DashboardOrderMetricRow[]): number {
  let count = 0;
  for (const row of rows) {
    if (isQualifyingRevenuePayment(row.payment_status)) {
      count += 1;
    }
  }
  return count;
}

export function buildDashboardKpis(input: {
  orders: readonly DashboardOrderMetricRow[];
  productsSold: number;
}): DashboardKpis {
  if (!Number.isInteger(input.productsSold) || input.productsSold < 0) {
    throw new Error("productsSold must be a non-negative integer.");
  }
  const revenueMinor = sumRevenueMinor(input.orders);
  const qualifyingOrderCount = countQualifyingOrders(input.orders);
  return {
    revenueMinor,
    orderCount: countCommittedOrders(input.orders),
    qualifyingOrderCount,
    aovMinor: averageOrderValueMinor(revenueMinor, qualifyingOrderCount),
    productsSold: input.productsSold,
  };
}

export function dashboardPeriodRange(
  period: DashboardPeriod,
  now: Date,
  timeZone = ADMIN_DASHBOARD_TIME_ZONE,
): DashboardDateRange {
  const today = ymdInTimeZone(now, timeZone);
  const dayCount = DASHBOARD_PERIOD_DAY_COUNTS[period];
  const startYmd = addDaysToYmd(today, 1 - dayCount);
  const endYmd = addDaysToYmd(today, 1);
  const start = zonedMidnight(startYmd, timeZone);
  const end = zonedMidnight(endYmd, timeZone);
  const dayKeys: string[] = [];
  for (let offset = 0; offset < dayCount; offset += 1) {
    dayKeys.push(ymdKey(addDaysToYmd(startYmd, offset)));
  }
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    dayKeys,
  };
}

export function groupSalesByDay(
  rows: readonly DashboardOrderMetricRow[],
  range: DashboardDateRange,
  timeZone = ADMIN_DASHBOARD_TIME_ZONE,
): DashboardDayPoint[] {
  const buckets = new Map<string, { revenueMinor: number; orderCount: number; qualifyingOrderCount: number }>();
  for (const key of range.dayKeys) {
    buckets.set(key, { revenueMinor: 0, orderCount: 0, qualifyingOrderCount: 0 });
  }
  for (const row of rows) {
    const key = ymdKey(ymdInTimeZone(new Date(row.created_at), timeZone));
    const bucket = buckets.get(key);
    if (!bucket) {
      continue;
    }
    if (isCommittedPurchase(row.payment_status)) {
      bucket.orderCount += 1;
    }
    if (isQualifyingRevenuePayment(row.payment_status)) {
      bucket.revenueMinor += row.total_minor;
      bucket.qualifyingOrderCount += 1;
    }
  }
  return range.dayKeys.map((dateKey) => {
    const bucket = buckets.get(dateKey) ?? {
      revenueMinor: 0,
      orderCount: 0,
      qualifyingOrderCount: 0,
    };
    return {
      dateKey,
      label: formatDayLabel(dateKey),
      ...bucket,
    };
  });
}

export function hasSalesActivity(points: readonly DashboardDayPoint[]): boolean {
  return points.some((point) => point.revenueMinor > 0 || point.qualifyingOrderCount > 0);
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function isShipmentStatus(value: unknown): value is ShipmentStatus {
  return typeof value === "string" && (SHIPMENT_STATUSES as readonly string[]).includes(value);
}

export function adminOrderStatusLabel(status: OrderStatus): string {
  return ADMIN_ORDER_STATUS_LABELS[status];
}

export function adminPaymentStatusLabel(status: PaymentStatus): string {
  return ADMIN_PAYMENT_STATUS_LABELS[status];
}

type Ymd = { year: number; month: number; day: number };

function ymdInTimeZone(date: Date, timeZone: string): Ymd {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

function addDaysToYmd(ymd: Ymd, days: number): Ymd {
  const utc = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function ymdKey(ymd: Ymd): string {
  return `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`;
}

function zonedMidnight(ymd: Ymd, timeZone: string): Date {
  const utcGuess = new Date(`${ymdKey(ymd)}T00:00:00.000Z`);
  const offsetMs = zonedOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMs);
}

function zonedOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

function formatDayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(utc);
}
