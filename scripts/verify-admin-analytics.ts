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
  parseDashboardPeriod,
  QUALIFYING_REVENUE_PAYMENT_STATUS,
  sumRevenueMinor,
  type DashboardOrderMetricRow,
} from "../src/contracts/admin/dashboard";
import { canAccessAdmin } from "../src/contracts/admin/roles";
import {
  ADMIN_ANALYTICS_TITLE,
  ADMIN_ANALYTICS_UNAVAILABLE_BODY,
  ADMIN_ANALYTICS_UNAVAILABLE_TITLE,
  ADMIN_KPI_AOV_EMPTY,
  ADMIN_NO_SALES_TITLE,
} from "../src/lib/admin-copy";
import { formatGbpMinor } from "../src/lib/money";
import { adminOrderPath, routes } from "../src/lib/navigation";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (routes.adminAnalytics !== "/admin/analytics") {
  throw new Error("Analytics must stay /admin/analytics.");
}
if (parseDashboardPeriod(undefined) !== DEFAULT_DASHBOARD_PERIOD || DEFAULT_DASHBOARD_PERIOD !== "7d") {
  throw new Error("Analytics must default to last 7 days.");
}
if (parseDashboardPeriod("today") !== "today" || parseDashboardPeriod("30d") !== "30d") {
  throw new Error("Analytics must support today, last 7 days, and last 30 days.");
}
if (ADMIN_DASHBOARD_TIME_ZONE !== "Europe/London") {
  throw new Error("Analytics periods must use Europe/London.");
}

if (QUALIFYING_REVENUE_PAYMENT_STATUS !== "captured") {
  throw new Error("Analytics revenue must count captured payments only.");
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
];

if (sumRevenueMinor(mixed) !== 4900) {
  throw new Error("Analytics revenue must sum captured totals only, in minor units.");
}

const emptyKpis = buildDashboardKpis({ orders: [], productsSold: 0 });
if (
  emptyKpis.revenueMinor !== 0 ||
  emptyKpis.orderCount !== 0 ||
  emptyKpis.aovMinor !== null ||
  emptyKpis.productsSold !== 0
) {
  throw new Error("Zero-order analytics must be £0 / 0 / — / 0.");
}
if (averageOrderValueMinor(0, 0) !== null || ADMIN_KPI_AOV_EMPTY !== "—") {
  throw new Error("AOV with no qualifying orders must be an em dash, not £0.");
}
if (formatGbpMinor(0) !== "£0" || formatGbpMinor(4900) !== "£49") {
  throw new Error("Analytics money must use existing GBP minor-unit formatting.");
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
if (populated.revenueMinor !== 8000 || populated.qualifyingOrderCount !== 2 || populated.aovMinor !== 4000) {
  throw new Error("AOV must be integer minor-unit average of captured orders.");
}
if (populated.productsSold !== 3) {
  throw new Error("Products sold must come from qualifying captured orders.");
}

const now = new Date("2026-09-16T12:00:00.000Z");
const today = dashboardPeriodRange("today", now, ADMIN_DASHBOARD_TIME_ZONE);
if (today.dayKeys[0] !== "2026-09-16" || today.startIso !== "2026-09-15T23:00:00.000Z") {
  throw new Error("Today must use London BST midnight bounds.");
}
const week = dashboardPeriodRange("7d", now);
if (week.dayKeys.length !== 7 || week.dayKeys[0] !== "2026-09-10") {
  throw new Error("Last 7 days must be seven inclusive London calendar days.");
}
const month = dashboardPeriodRange("30d", now);
if (month.dayKeys.length !== 30 || month.dayKeys[0] !== "2026-08-18") {
  throw new Error("Last 30 days must be thirty inclusive London calendar days.");
}

const winter = dashboardPeriodRange("today", new Date("2026-01-15T12:00:00.000Z"));
if (winter.startIso !== "2026-01-15T00:00:00.000Z" || winter.endIso !== "2026-01-16T00:00:00.000Z") {
  throw new Error("Today in GMT must use London midnight, not UTC-shifted BST bounds.");
}
const dstStart = dashboardPeriodRange("today", new Date("2026-03-29T12:00:00.000Z"));
if (dstStart.startIso !== "2026-03-29T00:00:00.000Z" || dstStart.endIso !== "2026-03-29T23:00:00.000Z") {
  throw new Error("London DST start day must run GMT midnight to BST midnight.");
}
const dstEnd = dashboardPeriodRange("today", new Date("2026-10-25T12:00:00.000Z"));
if (dstEnd.startIso !== "2026-10-24T23:00:00.000Z" || dstEnd.endIso !== "2026-10-26T00:00:00.000Z") {
  throw new Error("London DST end day must use BST midnight to GMT midnight.");
}

const series = groupSalesByDay(mixed, today);
if (series[0]?.revenueMinor !== 4900 || series[0]?.orderCount !== 1) {
  throw new Error("Daily grouping must keep unpaid checkouts out of orders and revenue.");
}
if (hasSalesActivity(groupSalesByDay([], today))) {
  throw new Error("An empty series must not invent a trend.");
}

if (ADMIN_ANALYTICS_TITLE !== "Analytics") {
  throw new Error("Analytics title must stay Analytics.");
}
if (
  ADMIN_ANALYTICS_UNAVAILABLE_TITLE !== "Unable to load analytics" ||
  ADMIN_ANALYTICS_UNAVAILABLE_BODY !== "Please try again." ||
  ADMIN_NO_SALES_TITLE !== "No sales yet"
) {
  throw new Error("Analytics error and empty copy must stay restrained and honest.");
}

if (!canAccessAdmin("admin") || !canAccessAdmin("superadmin") || canAccessAdmin(null)) {
  throw new Error("Analytics must follow the existing Admin/Superadmin gate.");
}
if (adminOrderPath("order-1") !== "/admin/orders/order-1") {
  throw new Error("Analytics recent orders must link to existing Orders Admin.");
}

const page = read("src/app/admin/analytics/page.tsx");
if (page.includes("AdminPlaceholderPage")) {
  throw new Error("Analytics must not remain a placeholder.");
}
if (!page.includes("getAdminGate") || !page.includes("parseDashboardPeriod")) {
  throw new Error("Analytics must require the Admin gate and reuse dashboard periods.");
}

const analytics = read("src/components/admin/AdminAnalytics.tsx");
if (!analytics.includes("AdminDashboardKpis") || !analytics.includes("AdminSalesOverview")) {
  throw new Error("Analytics must reuse dashboard KPI and sales overview components.");
}
if (!analytics.includes("AdminRecentOrders") || !analytics.includes("routes.adminAnalytics")) {
  throw new Error("Analytics must reuse recent orders and keep period links on /admin/analytics.");
}
if (analytics.includes("recharts") || analytics.includes("chart.js") || analytics.includes("growth %")) {
  throw new Error("Analytics must not add a chart library or fake growth values.");
}

const insights = read("src/components/admin/AdminAnalyticsCustomers.tsx");
if (!insights.includes("loadAdminCustomerInsights") || insights.includes("lifetime value")) {
  throw new Error("Customer insights must be counted from persisted data, not predicted LTV.");
}

const dashboardService = read("src/services/admin-dashboard.ts");
if (!dashboardService.includes("loadDashboardPeriodSnapshot") || !dashboardService.includes("createSupabaseServerClient")) {
  throw new Error("Analytics metrics must stay on the existing dashboard server queries.");
}
if (dashboardService.includes("createSupabaseAdminClient")) {
  throw new Error("Analytics must not use the service-role client.");
}

const customerService = read("src/services/admin-customers.ts");
if (!customerService.includes("loadAdminCustomerInsights") || !customerService.includes("admin_customer_directory")) {
  throw new Error("Customer insight totals must count the operational directory, not invented metrics.");
}

const unavailable = read("src/components/admin/AdminAnalyticsUnavailable.tsx");
if (!unavailable.includes("ADMIN_ANALYTICS_UNAVAILABLE_TITLE") || !unavailable.includes("AdminRetryButton")) {
  throw new Error("Analytics must show a retryable error state without raw database errors.");
}

const sources = [
  "src/app/admin/analytics/page.tsx",
  "src/components/admin/AdminAnalytics.tsx",
  "src/components/admin/AdminAnalyticsCustomers.tsx",
  "src/components/admin/AdminAnalyticsUnavailable.tsx",
  "src/services/admin-dashboard.ts",
  "src/services/admin-customers.ts",
];
for (const file of sources) {
  const source = read(file);
  if (
    source.includes("£12,345") ||
    source.includes("demo metric") ||
    source.includes("You're doing great") ||
    source.includes("fake growth") ||
    source.includes("sample revenue")
  ) {
    throw new Error(`${file} must not contain fabricated analytics figures.`);
  }
}

console.log("verify-admin-analytics: ok");
