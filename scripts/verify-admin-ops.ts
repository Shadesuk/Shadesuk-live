import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SHIPMENT_STATUSES } from "../src/contracts/fulfilment/shipment";
import { TRANSACTIONAL_EMAIL_TYPES } from "../src/lib/email/types";
import { ADMIN_NAV_PRIMARY } from "../src/lib/admin-nav";
import { ADMIN_ALERTS_TITLE, ADMIN_ALL_CLEAR_TITLE } from "../src/lib/admin-copy";
import { routes } from "../src/lib/navigation";
import {
  AWAITING_FULFILMENT_ORDER_STATUS_LIST,
  AWAITING_FULFILMENT_PAYMENT,
  FULFILMENT_VIEWS,
  IN_TRANSIT_QUEUE_STATUSES,
  LOW_STOCK_THRESHOLD,
  MISSING_TRACKING_PROGRESS_STATUSES,
  OPS_EMAIL_ORDER_CONFIRMATION,
  OPS_EMAIL_SHIPMENT_CONFIRMATION,
  adminCommunicationsHref,
  adminFulfilmentHref,
  adminInventoryHref,
  attentionItemsFromCounts,
  emailBreakdownTotal,
  inventoryStockDescription,
  isAwaitingFulfilment,
  isDeliveryException,
  isInTransitQueueStatus,
  isLowStockVariant,
  isOutOfStockVariant,
  lowStockEmptyBody,
  missingTrackingOrFilter,
  opsPageCount,
  parseCommunicationView,
  parseFulfilmentView,
  parseInventoryView,
  parseOpsPage,
  shipmentIsMissingTracking,
} from "../src/contracts/admin/ops";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (ADMIN_ALERTS_TITLE !== "Needs attention") {
  throw new Error("Dashboard attention heading must be Needs attention.");
}
if (ADMIN_ALL_CLEAR_TITLE !== "All clear") {
  throw new Error("Empty attention state must stay honest.");
}

if (LOW_STOCK_THRESHOLD !== 5 || !inventoryStockDescription().includes("1–5") || !lowStockEmptyBody().includes("1–5")) {
  throw new Error("Low stock must stay an explicit 1–5 unit rule for available variants.");
}
if (isLowStockVariant({ status: "available", stockQuantity: 1 }) === false) {
  throw new Error("One unit on an available variant is low stock.");
}
if (isLowStockVariant({ status: "available", stockQuantity: LOW_STOCK_THRESHOLD }) === false) {
  throw new Error("The threshold itself is still low stock.");
}
if (
  isLowStockVariant({ status: "available", stockQuantity: 0 }) ||
  isLowStockVariant({ status: "available", stockQuantity: LOW_STOCK_THRESHOLD + 1 }) ||
  isLowStockVariant({ status: "draft", stockQuantity: 1 }) ||
  isOutOfStockVariant({ status: "draft", stockQuantity: 0 })
) {
  throw new Error("Zero, healthy, and non-available stock must not be classified as low.");
}
if (!isOutOfStockVariant({ status: "available", stockQuantity: 0 })) {
  throw new Error("An available variant with zero stock is out of stock.");
}

if (
  !isAwaitingFulfilment({ paymentStatus: AWAITING_FULFILMENT_PAYMENT, orderStatus: "placed" }) ||
  !isAwaitingFulfilment({ paymentStatus: "captured", orderStatus: "processing" })
) {
  throw new Error("Paid placed and processing orders are awaiting fulfilment.");
}
if (
  isAwaitingFulfilment({ paymentStatus: "created", orderStatus: "placed" }) ||
  isAwaitingFulfilment({ paymentStatus: "captured", orderStatus: "dispatched" }) ||
  !AWAITING_FULFILMENT_ORDER_STATUS_LIST.includes("placed")
) {
  throw new Error("Unpaid or already dispatched orders are not awaiting fulfilment.");
}

for (const status of SHIPMENT_STATUSES) {
  const missing = shipmentIsMissingTracking({ status, trackingNumber: null });
  if (status === "pending" && missing) {
    throw new Error("Pending shipments are not missing tracking yet.");
  }
  if (status === "tracking_unavailable" && !shipmentIsMissingTracking({ status, trackingNumber: "AB1" })) {
    throw new Error("Tracking unavailable stays in the missing-tracking queue.");
  }
  if (status !== "pending" && status !== "tracking_unavailable" && !missing) {
    throw new Error(`${status} without a tracking number must be missing tracking.`);
  }
  if (
    status !== "tracking_unavailable" &&
    status !== "pending" &&
    shipmentIsMissingTracking({ status, trackingNumber: "AB1" })
  ) {
    throw new Error(`${status} with a tracking number is not missing tracking.`);
  }
}

const trackingFilter = missingTrackingOrFilter();
if (!trackingFilter.includes("status.eq.tracking_unavailable") || trackingFilter.includes("pending")) {
  throw new Error("Missing-tracking filter must include tracking unavailable and exclude pending.");
}
for (const status of MISSING_TRACKING_PROGRESS_STATUSES) {
  if (!trackingFilter.includes(status)) {
    throw new Error(`Missing-tracking filter must include ${status}.`);
  }
}

if (!isInTransitQueueStatus("in_transit") || !isInTransitQueueStatus("out_for_delivery")) {
  throw new Error("In transit queue must include in transit and out for delivery.");
}
if (isInTransitQueueStatus("dispatched") || IN_TRANSIT_QUEUE_STATUSES.length !== 2) {
  throw new Error("Dispatched shipments must stay in the dispatched queue.");
}

if (
  !isDeliveryException({ orderStatus: "exception", shipmentStatus: null }) ||
  !isDeliveryException({ orderStatus: "dispatched", shipmentStatus: "exception" }) ||
  isDeliveryException({ orderStatus: "dispatched", shipmentStatus: "in_transit" })
) {
  throw new Error("Delivery exceptions are order or shipment exception states only.");
}

const attention = attentionItemsFromCounts({
  awaitingFulfilment: 2,
  missingTracking: 1,
  deliveryExceptions: 0,
  failedEmails: 4,
  lowStockProducts: 3,
});
if (attention.some((item) => item.count <= 0) || attention.some((item) => item.id === "delivery-exceptions")) {
  throw new Error("Needs attention must omit zero counts.");
}
if (
  attention[0]?.href !== routes.adminFulfilment ||
  attention.find((item) => item.id === "missing-tracking")?.href !== adminFulfilmentHref("awaiting_tracking") ||
  attention.find((item) => item.id === "failed-emails")?.href !== routes.adminCommunications ||
  attention.find((item) => item.id === "low-stock")?.href !== routes.adminInventory
) {
  throw new Error("Attention items must link to the live ops views.");
}
if (attentionItemsFromCounts({
  awaitingFulfilment: 0,
  missingTracking: 0,
  deliveryExceptions: 0,
  failedEmails: 0,
  lowStockProducts: 0,
}).length !== 0) {
  throw new Error("An empty attention list must not invent issues.");
}
if (attentionItemsFromCounts({
  awaitingFulfilment: -1,
  missingTracking: 1.5,
  deliveryExceptions: Number.NaN,
  failedEmails: 0,
  lowStockProducts: 0,
}).length !== 0) {
  throw new Error("Non-integer counts must not become attention items.");
}

if (emailBreakdownTotal({ sent: 2, failed: 1, pending: 3 }) !== 6) {
  throw new Error("Email status breakdown must sum the recorded statuses.");
}
if (
  OPS_EMAIL_ORDER_CONFIRMATION !== TRANSACTIONAL_EMAIL_TYPES.orderConfirmation ||
  OPS_EMAIL_SHIPMENT_CONFIRMATION !== TRANSACTIONAL_EMAIL_TYPES.shipmentConfirmation
) {
  throw new Error("Confirmation counts must use the existing email event types.");
}

if (parseFulfilmentView({}) !== "awaiting" || parseFulfilmentView({ view: "nope" }) !== "awaiting") {
  throw new Error("Unknown fulfilment views must fall back to awaiting.");
}
if (parseFulfilmentView({ view: "exceptions" }) !== "exceptions") {
  throw new Error("Exceptions must remain a fulfilment view.");
}
if (FULFILMENT_VIEWS.join(",") !== "awaiting,awaiting_tracking,dispatched,in_transit,exceptions") {
  throw new Error("Fulfilment views must stay awaiting, awaiting tracking, dispatched, in transit, exceptions.");
}
if (parseInventoryView({ view: ["out"] }) !== "out" || parseInventoryView({}) !== "low") {
  throw new Error("Inventory must default to low and accept out.");
}
if (parseCommunicationView({ view: "confirmations" }) !== "confirmations" || parseCommunicationView({}) !== "failed") {
  throw new Error("Communications must default to failed emails.");
}
if (parseOpsPage({}) !== 1 || parseOpsPage({ page: "0" }) !== 1 || parseOpsPage({ page: "3" }) !== 3) {
  throw new Error("Ops pages must be positive integers.");
}
if (opsPageCount(0) !== 1 || opsPageCount(21) !== 2) {
  throw new Error("Ops pagination must derive page count from the real total.");
}
if (adminFulfilmentHref("dispatched", 2) !== "/admin/fulfilment?view=dispatched&page=2") {
  throw new Error("Fulfilment links must carry the view and page.");
}
if (adminInventoryHref("out") !== "/admin/inventory?view=out") {
  throw new Error("Out-of-stock inventory must be a real view link.");
}
if (adminCommunicationsHref() !== "/admin/communications") {
  throw new Error("Failed emails must be the communications default.");
}

if (ADMIN_NAV_PRIMARY[1]?.href !== routes.adminOrders || ADMIN_NAV_PRIMARY[2]?.href !== routes.adminProducts) {
  throw new Error("Existing Orders and Products nav positions must stay put.");
}
const opsNav = ADMIN_NAV_PRIMARY.map((item) => item.href);
if (
  !opsNav.includes(routes.adminFulfilment) ||
  !opsNav.includes(routes.adminInventory) ||
  !opsNav.includes(routes.adminCommunications)
) {
  throw new Error("Fulfilment, Inventory, and Communications must live in the existing admin nav.");
}

const opsSources = [
  "src/services/admin-ops.ts",
  "src/components/admin/AdminOperationalAlerts.tsx",
  "src/components/admin/AdminFulfilmentPage.tsx",
  "src/components/admin/AdminInventoryPage.tsx",
  "src/components/admin/AdminCommunicationsPage.tsx",
  "src/app/admin/fulfilment/page.tsx",
  "src/app/admin/inventory/page.tsx",
  "src/app/admin/communications/page.tsx",
];
for (const file of opsSources) {
  const source = read(file);
  if (
    source.includes("createSupabaseAdminClient") ||
    source.includes("SUPABASE_SECRET_KEY") ||
    source.includes("razorpay") || source.includes("checkout.paypal") || source.includes("web-sdk/v6") ||
    source.includes("£12,345") ||
    source.includes("demo metric")
  ) {
    throw new Error(`${file} must not use the service role, payments, or fabricated figures.`);
  }
}

const service = read("src/services/admin-ops.ts");
if (!service.includes("createSupabaseServerClient") || !service.includes('from("email_events")')) {
  throw new Error("Ops reads must use the cookie-bound server client and email_events.");
}
if (!service.includes('from("orders")') || !service.includes('from("shipments")') || !service.includes('from("product_variants")')) {
  throw new Error("Ops reads must use orders, shipments, and product variants.");
}
if (service.includes("from(\"carts\")")) {
  throw new Error("Ops inventory must not be derived from carts.");
}

const alerts = read("src/components/admin/AdminOperationalAlerts.tsx");
if (!alerts.includes("loadNeedsAttention") || !alerts.includes("ADMIN_ALL_CLEAR_TITLE") || !alerts.includes("data-needs-attention")) {
  throw new Error("Needs attention must render real attention items inside the existing dashboard section.");
}

for (const file of [
  "src/app/admin/fulfilment/page.tsx",
  "src/app/admin/inventory/page.tsx",
  "src/app/admin/communications/page.tsx",
]) {
  const source = read(file);
  if (!source.includes("getAdminGate") || !source.includes("AdminAuthScreen") || !source.includes("privatePathMetadata")) {
    throw new Error(`${file} must stay behind the admin gate and noindex.`);
  }
}

const layout = read("src/app/admin/layout.tsx");
if (!layout.includes("AdminShell")) {
  throw new Error("Ops pages must keep using AdminShell.");
}
const shell = read("src/components/admin/AdminShell.tsx");
if (!shell.includes("data-admin-shell")) {
  throw new Error("AdminShell must remain the admin frame.");
}

const home = read("src/app/(storefront)/page.tsx");
if (home.includes("adminFulfilment") || home.includes("Needs attention")) {
  throw new Error("Ops must not change the storefront homepage.");
}

console.log("verify-admin-ops: ok");
