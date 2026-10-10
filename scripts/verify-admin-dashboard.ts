import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ADMIN_DASHBOARD_TIME_ZONE,
  averageOrderValueMinor,
  buildDashboardKpis,
  dashboardPeriodRange,
  DEFAULT_DASHBOARD_PERIOD,
  groupSalesByDay,
  hasSalesActivity,
  isQualifyingRevenuePayment,
  parseDashboardPeriod,
  QUALIFYING_REVENUE_PAYMENT_STATUS,
  sumRevenueMinor,
  type DashboardOrderMetricRow,
} from "../src/contracts/admin/dashboard";
import {
  ADMIN_DASHBOARD_UNAVAILABLE_TITLE,
  ADMIN_HOME_TITLE,
  ADMIN_KPI_AOV_EMPTY,
  ADMIN_NO_ORDERS_TITLE,
  ADMIN_NO_SALES_TITLE,
  ADMIN_ALL_CLEAR_TITLE,
} from "../src/lib/admin-copy";
import { formatChargeMinor, formatGbpMinor } from "../src/lib/money";
import { buildPaymentPeriodReport } from "../src/contracts/admin/payment-report";
import { PAYMENT_REPORT_UNAVAILABLE } from "../src/contracts/admin/payment-report";
import { adminOrderPath, routes } from "../src/lib/navigation";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (parseDashboardPeriod(undefined) !== DEFAULT_DASHBOARD_PERIOD) {
  throw new Error("Missing period must default to last 7 days.");
}
if (parseDashboardPeriod("nope") !== "7d" || parseDashboardPeriod(["30d"]) !== "30d") {
  throw new Error("Period parsing must accept known values and ignore junk.");
}
if (parseDashboardPeriod("today") !== "today") {
  throw new Error("Today must be a valid dashboard period.");
}

if (QUALIFYING_REVENUE_PAYMENT_STATUS !== "captured") {
  throw new Error("Only captured payments are qualifying revenue.");
}
if (
  isQualifyingRevenuePayment("created") ||
  isQualifyingRevenuePayment("authorized") ||
  isQualifyingRevenuePayment("failed") ||
  isQualifyingRevenuePayment("cancelled") ||
  isQualifyingRevenuePayment("refunded") ||
  isQualifyingRevenuePayment("partially_refunded")
) {
  throw new Error("Unpaid, failed, and refunded payments must not count as revenue.");
}

const mixed: DashboardOrderMetricRow[] = [
  {
    id: "captured",
    payment_status: "captured",
    total_minor: 4900,
    created_at: "2026-09-16T10:00:00.000Z",
  },
  {
    id: "created",
    payment_status: "created",
    total_minor: 12000,
    created_at: "2026-09-16T11:00:00.000Z",
  },
  {
    id: "failed",
    payment_status: "failed",
    total_minor: 8000,
    created_at: "2026-09-16T12:00:00.000Z",
  },
  {
    id: "refunded",
    payment_status: "refunded",
    total_minor: 4900,
    created_at: "2026-09-16T13:00:00.000Z",
  },
];

if (sumRevenueMinor(mixed) !== 4900) {
  throw new Error("Revenue must sum captured totals only, in minor units.");
}

const emptyKpis = buildDashboardKpis({ orders: [], productsSold: 0 });
if (
  emptyKpis.revenueMinor !== 0 ||
  emptyKpis.orderCount !== 0 ||
  emptyKpis.aovMinor !== null ||
  emptyKpis.productsSold !== 0
) {
  throw new Error("Empty dashboard KPIs must be £0 / 0 / — / 0.");
}
if (averageOrderValueMinor(0, 0) !== null) {
  throw new Error("AOV with no qualifying orders must be null, not £0.");
}

const populated = buildDashboardKpis({
  orders: [
    ...mixed,
    {
      id: "captured-2",
      payment_status: "captured",
      total_minor: 3100,
      created_at: "2026-09-16T14:00:00.000Z",
    },
  ],
  productsSold: 3,
});
if (populated.revenueMinor !== 8000 || populated.orderCount !== 3 || populated.qualifyingOrderCount !== 2) {
  throw new Error("Orders KPI counts committed purchases; revenue uses captured rows only.");
}
if (populated.aovMinor !== 4000 || populated.productsSold !== 3) {
  throw new Error("AOV must be integer minor-unit average of captured orders.");
}
if (formatGbpMinor(0) !== "£0" || formatGbpMinor(4900) !== "£49") {
  throw new Error("Dashboard money must use existing GBP minor-unit formatting.");
}
if (ADMIN_KPI_AOV_EMPTY !== "—") {
  throw new Error("Empty AOV copy must be an em dash.");
}

const now = new Date("2026-09-16T12:00:00.000Z");
const today = dashboardPeriodRange("today", now, ADMIN_DASHBOARD_TIME_ZONE);
if (today.dayKeys.length !== 1 || today.dayKeys[0] !== "2026-09-16") {
  throw new Error("Today must be one London calendar day.");
}
if (today.startIso !== "2026-09-15T23:00:00.000Z" || today.endIso !== "2026-09-16T23:00:00.000Z") {
  throw new Error("London BST midnight bounds are wrong for 16 Sep 2026.");
}

const week = dashboardPeriodRange("7d", now);
if (week.dayKeys.length !== 7 || week.dayKeys[0] !== "2026-09-10" || week.dayKeys[6] !== "2026-09-16") {
  throw new Error("Last 7 days must be seven inclusive London calendar days.");
}

const month = dashboardPeriodRange("30d", now);
if (month.dayKeys.length !== 30 || month.dayKeys[0] !== "2026-08-18") {
  throw new Error("Last 30 days must be thirty inclusive London calendar days.");
}

const series = groupSalesByDay(
  [
    {
      id: "a",
      payment_status: "captured",
      total_minor: 1000,
      created_at: "2026-09-16T10:00:00.000Z",
    },
    {
      id: "b",
      payment_status: "created",
      total_minor: 5000,
      created_at: "2026-09-16T11:00:00.000Z",
    },
  ],
  today,
);
if (series.length !== 1 || series[0]?.revenueMinor !== 1000 || series[0]?.orderCount !== 1) {
  throw new Error("Daily grouping must keep unpaid checkouts out of orders and revenue.");
}
if (!hasSalesActivity(series)) {
  throw new Error("Captured revenue must count as sales activity.");
}
if (hasSalesActivity(groupSalesByDay([], today))) {
  throw new Error("An empty series must not invent a trend.");
}

if (adminOrderPath("order-1") !== "/admin/orders/order-1") {
  throw new Error("Recent orders must link to /admin/orders/[id].");
}
if (routes.admin !== "/admin" || routes.adminOrders !== "/admin/orders") {
  throw new Error("Dashboard routes must stay /admin and /admin/orders.");
}

if (ADMIN_HOME_TITLE !== "Dashboard") {
  throw new Error("Admin home title must be Dashboard.");
}
if (
  ADMIN_NO_SALES_TITLE !== "No sales yet" ||
  ADMIN_NO_ORDERS_TITLE !== "No orders yet" ||
  ADMIN_ALL_CLEAR_TITLE !== "All clear" ||
  ADMIN_DASHBOARD_UNAVAILABLE_TITLE !== "Dashboard unavailable"
) {
  throw new Error("Empty and error copy must stay operational and honest.");
}

const service = read("src/services/admin-dashboard.ts");
if (!service.includes("createSupabaseServerClient")) {
  throw new Error("Dashboard queries must use the cookie-bound server client.");
}
if (service.includes("createSupabaseAdminClient") || service.includes("SUPABASE_SECRET_KEY")) {
  throw new Error("Dashboard must not use the service-role client.");
}
if (!service.includes("from(\"orders\")") || !service.includes("from(\"order_items\")")) {
  throw new Error("Dashboard must read orders and order items from the live schema.");
}
if (!service.includes("loadPaymentPeriod") || !read("src/services/admin-payment-ledger.ts").includes("is_test")) {
  throw new Error("Dashboard totals must exclude test ledger rows.");
}
if (service.includes("formatGbpMinor")) {
  throw new Error("Dashboard totals must not format every currency as GBP.");
}
const mixedCurrency = buildPaymentPeriodReport({
  payments: [
    {
      id: "pay-gbp",
      orderId: "order-gbp",
      status: "captured",
      currency: "GBP",
      createdAt: "2026-09-16T10:00:00.000Z",
    },
    {
      id: "pay-inr",
      orderId: "order-inr",
      status: "captured",
      currency: "INR",
      createdAt: "2026-09-16T11:00:00.000Z",
    },
    {
      id: "pay-pending",
      orderId: "order-pending",
      status: "created",
      currency: "GBP",
      createdAt: "2026-09-16T12:00:00.000Z",
    },
    {
      id: "pay-failed",
      orderId: "order-failed",
      status: "failed",
      currency: "EUR",
      createdAt: "2026-09-16T12:30:00.000Z",
    },
    {
      id: "pay-cancelled",
      orderId: "order-cancelled",
      status: "cancelled",
      currency: "USD",
      createdAt: "2026-09-16T13:00:00.000Z",
    },
  ],
  ledger: [
    {
      paymentId: "pay-gbp",
      orderId: "order-gbp",
      entryType: "charge",
      amountMinor: 4900,
      currency: "GBP",
      occurredAt: "2026-09-16T10:00:00.000Z",
      isTest: false,
    },
    {
      paymentId: "pay-gbp",
      orderId: "order-gbp",
      entryType: "refund",
      amountMinor: -4900,
      currency: "GBP",
      occurredAt: "2026-09-16T15:00:00.000Z",
      isTest: false,
    },
    {
      paymentId: "pay-inr",
      orderId: "order-inr",
      entryType: "charge",
      amountMinor: 20000,
      currency: "INR",
      occurredAt: "2026-09-16T11:00:00.000Z",
      isTest: false,
    },
    {
      paymentId: "pay-test",
      orderId: "order-test",
      entryType: "charge",
      amountMinor: 100,
      currency: "GBP",
      occurredAt: "2026-09-16T16:00:00.000Z",
      isTest: true,
    },
  ],
  testPaymentIds: ["pay-test"],
});
const gbp = mixedCurrency.currencies.find((total) => total.currency === "GBP");
const inr = mixedCurrency.currencies.find((total) => total.currency === "INR");
if (!gbp || gbp.capturedMinor !== 4900 || gbp.refundedMinor !== 4900 || gbp.capturedMinor + (inr?.capturedMinor ?? 0) === gbp.capturedMinor) {
  throw new Error("Captured totals must stay in their own currency and must not add GBP to INR.");
}
if (!inr || inr.capturedMinor !== 20000 || inr.refundedMinor !== 0) {
  throw new Error("INR captured totals must stay in rupees.");
}
if (mixedCurrency.currencies.some((total) => total.capturedMinor === 100)) {
  throw new Error("Test ledger rows must be excluded from totals.");
}
if (
  mixedCurrency.counts.captured !== 1 ||
  mixedCurrency.counts.pending !== 1 ||
  mixedCurrency.counts.failed !== 1 ||
  mixedCurrency.counts.cancelled !== 1 ||
  mixedCurrency.counts.refunded !== 1
) {
  throw new Error("Status counts must separate captured, pending, failed, cancelled, and refunded.");
}
if (mixedCurrency.capturedOrderIds.includes("order-gbp") || mixedCurrency.capturedOrderIds.includes("order-test")) {
  throw new Error("Refunded and test charges must not count as products sold.");
}
if (!mixedCurrency.capturedOrderIds.includes("order-inr")) {
  throw new Error("A live captured charge must count toward products sold.");
}
if (formatChargeMinor(20000, "INR").includes("£") || !formatChargeMinor(4900, "GBP").includes("£")) {
  throw new Error("INR must not be formatted as GBP.");
}
if (PAYMENT_REPORT_UNAVAILABLE !== "Not available") {
  throw new Error("Settlement and fees must be shown as Not available.");
}
const ledgerMigration = read("supabase/migrations/20261010120000_payment_ledger.sql");
if (
  !ledgerMigration.includes("revoke all on table public.payment_ledger from anon") ||
  !ledgerMigration.includes("revoke all on table public.payment_ledger from authenticated") ||
  !ledgerMigration.includes("grant select on table public.payment_ledger to service_role") ||
  ledgerMigration.includes("grant insert") ||
  ledgerMigration.includes("grant update") ||
  ledgerMigration.includes("grant delete")
) {
  throw new Error("The ledger must not be granted to anon or authenticated, and must not grant writes.");
}
if (!ledgerMigration.includes("payment_ledger is append-only") || !ledgerMigration.includes("before update or delete")) {
  throw new Error("The ledger must reject update and delete.");
}
if (!ledgerMigration.includes("on conflict (provider, entry_type, provider_ref) do nothing")) {
  throw new Error("Capture writes must insert a charge idempotently.");
}
const ledgerService = read("src/services/admin-payment-ledger.ts");
if (!ledgerService.includes("getAdminGate") || !ledgerService.includes("isStaffAdmin")) {
  throw new Error("Ledger reads must check the admin role on the server.");
}
const ledgerPage = read("src/app/admin/ledger/page.tsx");
if (!ledgerPage.includes("getAdminGate") || !ledgerPage.includes("AdminAuthScreen")) {
  throw new Error("The ledger page must stay behind the Admin gate.");
}
if (service.includes("from(\"carts\")") || service.includes("stock_quantity as productsSold")) {
  throw new Error("Dashboard must not treat carts or inventory as products sold.");
}

const page = read("src/app/admin/page.tsx");
if (!page.includes("getAdminGate") || !page.includes("AdminAuthScreen")) {
  throw new Error("Dashboard page must stay behind the Admin gate.");
}

const kpis = read("src/components/admin/AdminDashboardKpis.tsx");
if (!kpis.includes("data-kpi") || !kpis.includes("ADMIN_KPI_AOV_EMPTY")) {
  throw new Error("KPI row must render real values and the empty AOV dash.");
}

const sales = read("src/components/admin/AdminSalesOverview.tsx");
if (!sales.includes("ADMIN_NO_SALES_TITLE") || !sales.includes("dailyTable")) {
  throw new Error("Sales overview must have an empty state and an accessible data table.");
}
if (sales.includes("recharts") || sales.includes("chart.js") || sales.includes("gradient")) {
  throw new Error("Sales overview must not add a chart library or decorative gradients.");
}

const orders = read("src/components/admin/AdminRecentOrders.tsx");
if (!orders.includes("adminOrderPath") || !orders.includes("ADMIN_NO_ORDERS_TITLE")) {
  throw new Error("Recent orders must link to order detail routes and handle an empty list.");
}

const alerts = read("src/components/admin/AdminOperationalAlerts.tsx");
if (!alerts.includes("ADMIN_ALL_CLEAR_TITLE") || alerts.includes("AI insights")) {
  throw new Error("Alerts must use real operational empty copy, not invented insights.");
}

const sources = [
  "src/app/admin/page.tsx",
  "src/components/admin/AdminDashboard.tsx",
  "src/components/admin/AdminDashboardKpis.tsx",
  "src/components/admin/AdminSalesOverview.tsx",
  "src/components/admin/AdminRecentOrders.tsx",
  "src/components/admin/AdminOperationalAlerts.tsx",
  "src/services/admin-dashboard.ts",
  "src/lib/admin-copy.ts",
];
for (const file of sources) {
  const source = read(file);
  if (
    source.includes("£12,345") ||
    source.includes("demo metric") ||
    source.includes("fake order") ||
    source.includes("sample revenue")
  ) {
    throw new Error(`${file} must not contain fabricated dashboard figures.`);
  }
}

console.log("verify-admin-dashboard: ok");
