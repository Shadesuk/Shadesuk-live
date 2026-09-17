import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ADMIN_FULFILMENT_TEXT_MAX,
  ADMIN_ORDERS_PAGE_SIZE,
  ADMIN_ORDER_EVENT_TYPES,
  ADMIN_TRACKING_URL_MAX,
  adminOrderCustomerLabel,
  adminOrderEventLabel,
  adminOrderListQueryString,
  adminOrderSearchReference,
  adminOrderStatusOptions,
  parseAdminFulfilmentInput,
  parseAdminOrderListQuery,
  parseAdminOrderStatusInput,
  sanitizeAdminOrderSearch,
} from "../src/contracts/admin/orders";
import { isLegalOrderStatusTransition, legalOrderStatusTargets } from "../src/contracts/order/status";
import {
  ADMIN_ORDER_GUEST,
  ADMIN_ORDER_HISTORY_EMPTY_TITLE,
  ADMIN_ORDER_NOT_FOUND_TITLE,
  ADMIN_ORDER_NO_FULFILMENT_TITLE,
  ADMIN_ORDER_UPDATE_FAILED_TITLE,
  ADMIN_ORDERS_EMPTY_TITLE,
} from "../src/lib/admin-copy";
import { isUuid } from "../src/lib/ids";
import { adminOrderPath, routes } from "../src/lib/navigation";
import { safeHttpUrl } from "../src/lib/tracking-url";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (routes.adminOrders !== "/admin/orders" || adminOrderPath("abc") !== "/admin/orders/abc") {
  throw new Error("Admin Orders routes must stay /admin/orders and /admin/orders/[id].");
}
if (ADMIN_ORDERS_PAGE_SIZE !== 20 || ADMIN_ORDERS_PAGE_SIZE < 1) {
  throw new Error("Orders list must paginate server-side with a bounded page size.");
}

const parsed = parseAdminOrderListQuery({
  q: "  SUK-2026-AB12CD %_* ",
  status: "processing",
  payment: "captured",
  period: "7d",
  page: "2",
});
if (parsed.q.includes("%") || parsed.q.includes("*") || parsed.q.includes("_")) {
  throw new Error("Order search must strip wildcard/injection characters.");
}
if (parsed.status !== "processing" || parsed.payment !== "captured" || parsed.period !== "7d" || parsed.page !== 2) {
  throw new Error("Order list query parsing must accept known filters.");
}
if (parseAdminOrderListQuery({ status: "nope", payment: "paid", period: "year", page: "-3" }).page !== 1) {
  throw new Error("Unknown filters must be ignored and invalid pages must fall back to 1.");
}
if (parseAdminOrderListQuery({ q: ["alpha"], page: ["3"] }).page !== 3) {
  throw new Error("Array search params must use the first value.");
}

const queryString = adminOrderListQueryString(parsed);
if (!queryString.includes("status=processing") || !queryString.includes("page=2")) {
  throw new Error("List query string must round-trip filters and page.");
}
if (adminOrderListQueryString({ q: "", status: null, payment: null, period: "all", page: 1 }) !== "") {
  throw new Error("Default list query must not add empty params.");
}

if (sanitizeAdminOrderSearch("a".repeat(200)).length !== 80) {
  throw new Error("Search must be length-limited.");
}
if (sanitizeAdminOrderSearch('ref","()\\') !== "ref") {
  throw new Error("Search sanitiser must strip PostgREST control characters.");
}
if (adminOrderSearchReference("shu-0123456789ab") !== "SHU-0123456789AB") {
  throw new Error("Reference lookup must accept a canonical order reference.");
}

if (adminOrderCustomerLabel("Ada West", true, ADMIN_ORDER_GUEST) !== "Ada West · Guest order") {
  throw new Error("Guest orders with a name must keep the guest label.");
}
if (adminOrderCustomerLabel("  ", true, ADMIN_ORDER_GUEST) !== "Guest order") {
  throw new Error("Guest orders without a name must still be first-class.");
}
if (adminOrderCustomerLabel("", false, ADMIN_ORDER_GUEST) !== "—") {
  throw new Error("Registered orders without a name must not invent a customer.");
}

if (!isLegalOrderStatusTransition("placed", "processing") || isLegalOrderStatusTransition("delivered", "placed")) {
  throw new Error("Existing order status transitions must be preserved.");
}
const targets = legalOrderStatusTargets("placed");
if (!targets.includes("placed") || !targets.includes("processing") || targets.includes("delivered")) {
  throw new Error("Status options must include the current status and legal next statuses only.");
}
if (parseAdminOrderStatusInput("placed", "delivered").ok) {
  throw new Error("Illegal order status changes must be rejected.");
}
if (!parseAdminOrderStatusInput("placed", "processing").ok) {
  throw new Error("Legal order status changes must be accepted.");
}
if (adminOrderStatusOptions("delivered").join(",") !== "delivered") {
  throw new Error("Terminal delivered status must not invent extra transitions.");
}

const httpsOk = parseAdminFulfilmentInput({
  carrierName: "Royal Mail",
  trackingNumber: "AB123",
  trackingUrl: "https://example.com/track?ref=AB123",
  status: "dispatched",
});
if (!httpsOk.ok || httpsOk.value.trackingUrl !== "https://example.com/track?ref=AB123") {
  throw new Error("https tracking URLs must be accepted and normalised.");
}

for (const trackingUrl of ["http://example.com/track", "javascript:alert(1)", "ftp://files.example", "data:text/html,hi"]) {
  const parsedUrl = parseAdminFulfilmentInput({
    carrierName: "Royal Mail",
    trackingNumber: "AB123",
    trackingUrl,
    status: "pending",
  });
  if (parsedUrl.ok) {
    throw new Error(`Unsafe tracking URL must be rejected: ${trackingUrl}`);
  }
}
if (safeHttpUrl("javascript:alert(1)") !== null || safeHttpUrl("http://example.com") !== null) {
  throw new Error("Rendered tracking URLs must stay https-only.");
}

const emptyFulfilment = parseAdminFulfilmentInput({
  carrierName: "",
  trackingNumber: "",
  trackingUrl: "",
  status: "pending",
});
if (!emptyFulfilment.ok || emptyFulfilment.value.status !== "pending") {
  throw new Error("Tracking fields must stay optional; entering them must not invent delivered.");
}
if (parseAdminFulfilmentInput({ carrierName: "", trackingNumber: "", trackingUrl: "", status: "lost" }).ok) {
  throw new Error("Unknown shipment statuses must be rejected.");
}
if (parseAdminFulfilmentInput({
  carrierName: "x".repeat(ADMIN_FULFILMENT_TEXT_MAX + 8),
  trackingNumber: "",
  trackingUrl: `https://example.com/${"a".repeat(ADMIN_TRACKING_URL_MAX)}`,
  status: "pending",
}).ok) {
  throw new Error("Overlong fulfilment fields must be rejected or truncated without accepting a huge URL.");
}

if (adminOrderEventLabel(ADMIN_ORDER_EVENT_TYPES.statusChanged) !== "Status changed") {
  throw new Error("Status change events must have a readable label.");
}
if (adminOrderEventLabel("made_up_event") !== "Event recorded") {
  throw new Error("Unknown events must not be fabricated into a specific history entry.");
}

if (
  ADMIN_ORDERS_EMPTY_TITLE !== "No orders yet" ||
  ADMIN_ORDER_NO_FULFILMENT_TITLE !== "No fulfilment information" ||
  ADMIN_ORDER_HISTORY_EMPTY_TITLE !== "No events yet" ||
  ADMIN_ORDER_NOT_FOUND_TITLE !== "Order not found" ||
  ADMIN_ORDER_UPDATE_FAILED_TITLE !== "Couldn’t update order"
) {
  throw new Error("Orders empty/error copy must stay operational and honest.");
}

if (!isUuid("11111111-1111-4111-8111-111111111111") || isUuid("SUK-2026-AB12CD")) {
  throw new Error("Order detail must reject non-UUID ids as not found.");
}

const service = read("src/services/admin-orders.ts");
if (!service.includes("server-only") || !service.includes("createSupabaseServerClient")) {
  throw new Error("Admin Orders queries must use the cookie-bound server client.");
}
if (service.includes("createSupabaseAdminClient") || service.includes("SUPABASE_SECRET_KEY")) {
  throw new Error("Admin Orders must not use the service-role client.");
}
if (!service.includes(".range(") || !service.includes("ADMIN_ORDERS_PAGE_SIZE")) {
  throw new Error("Order list must paginate on the server.");
}
if (service.includes('from("products")') || service.includes('from("customers")')) {
  throw new Error("Orders must not fetch the catalogue or a customers table.");
}
if (service.includes(".channel(") || service.includes("realtime")) {
  throw new Error("Admin Orders must not open realtime subscriptions.");
}
if (!service.includes("order_events") || !service.includes("tracking_events")) {
  throw new Error("Mutations must write through the existing event model.");
}
if (!service.includes("actor_user_id") || !service.includes("created_by")) {
  throw new Error("Events must record the acting admin for RLS and audit.");
}
if (service.includes("status: \"delivered\"") && service.includes("trackingUrl") && /trackingUrl[\s\S]*status:\s*\"delivered\"/.test(service)) {
  throw new Error("Saving tracking must not automatically mark a shipment delivered.");
}

const actions = read("src/app/admin/orders/actions.ts");
if (!actions.includes("\"use server\"") || !actions.includes("getAdminGate")) {
  throw new Error("Order mutations must be server actions behind getAdminGate().");
}
if (!actions.includes("cartActionOriginAllowed") || !actions.includes("hasForbiddenOwnershipKey")) {
  throw new Error("Order mutations must keep origin and ownership-key guards.");
}
if (!actions.includes("revalidatePath(routes.adminOrders)") || !actions.includes("adminOrderPath")) {
  throw new Error("Successful mutations must revalidate the order list and detail.");
}
if (actions.includes("createSupabaseAdminClient") || actions.includes("error.message")) {
  throw new Error("Actions must not use the service-role client or leak database errors.");
}

const listPage = read("src/app/admin/orders/page.tsx");
const detailPage = read("src/app/admin/orders/[id]/page.tsx");
if (listPage.includes("AdminPlaceholderPage") || detailPage.includes("AdminPlaceholderPage")) {
  throw new Error("Orders routes must not remain placeholders.");
}
if (!listPage.includes("getAdminGate") || !detailPage.includes("getAdminGate")) {
  throw new Error("Orders pages must require getAdminGate().");
}

const sources = [
  "src/app/admin/orders/page.tsx",
  "src/app/admin/orders/[id]/page.tsx",
  "src/app/admin/orders/actions.ts",
  "src/components/admin/AdminOrdersPage.tsx",
  "src/components/admin/AdminOrdersTable.tsx",
  "src/components/admin/AdminOrderDetail.tsx",
  "src/components/admin/AdminOrderForms.tsx",
  "src/components/admin/AdminOrderFilters.tsx",
  "src/services/admin-orders.ts",
  "src/contracts/admin/orders.ts",
];
for (const file of sources) {
  const source = read(file);
  if (source.includes("SiteChrome") || source.includes("createSupabaseAdminClient")) {
    throw new Error(`${file} must stay inside Admin and the user-scoped server client.`);
  }
  if (/\bany\b/.test(source.replace(/[^\n]*from[^\n]*/g, ""))) {
    const stripped = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
      .join("\n");
    if (/(?::|\bas\s+)\s*any\b|<any>|Promise<any>/.test(stripped)) {
      throw new Error(`${file} must not use any.`);
    }
  }
  if (
    source.includes("razorpay") ||
    source.includes("carrier API") ||
    source.includes("MetricCard") ||
    source.includes("createSupabaseAdminClient")
  ) {
    throw new Error(`${file} must not add payments, carrier APIs, service-role, or dashboard-template chrome.`);
  }
}

const forms = read("src/components/admin/AdminOrderForms.tsx");
if (!forms.includes("\"use client\"") || !forms.includes("useActionState")) {
  throw new Error("Fulfilment forms must be client components posting to server actions.");
}
if (!forms.includes("label={ADMIN_ORDER_TRACKING_URL}") || forms.includes("placeholder={ADMIN_ORDER_TRACKING_URL}")) {
  throw new Error("Fulfilment fields must have explicit labels.");
}

const detail = read("src/components/admin/AdminOrderDetail.tsx");
if (!detail.includes("ADMIN_ORDER_GUEST") || !detail.includes("ADMIN_ORDER_NO_FULFILMENT_TITLE")) {
  throw new Error("Order detail must handle guest orders and missing fulfilment.");
}
if (!detail.includes("ADMIN_ORDER_HISTORY_EMPTY_TITLE") || !detail.includes("adminOrderStatusLabel")) {
  throw new Error("Order detail must show event history or an empty state, with textual statuses.");
}

const table = read("src/components/admin/AdminOrdersTable.tsx");
if (!table.includes("ADMIN_ORDERS_EMPTY_TITLE") || !table.includes("adminOrderPath")) {
  throw new Error("Order list must have an empty state and link to detail.");
}

const skeletons = read("src/components/admin/AdminOrdersSkeletons.tsx");
if (!skeletons.includes("AdminOrdersTableSkeleton") || !skeletons.includes("AdminOrderDetailSkeleton")) {
  throw new Error("Orders must use section skeletons, not a page spinner.");
}

const css = read("src/components/admin/AdminOrders.module.css");
if (!css.includes("min-width: 768px") || !css.includes("min-width: 1200px")) {
  throw new Error("Orders CSS must follow the locked tablet and desktop breakpoints.");
}
if (!css.includes("min-height: var(--touch-min)")) {
  throw new Error("Order rows must keep the 44px touch minimum.");
}

for (const file of [
  "src/app/admin/customers/page.tsx",
  "src/app/admin/analytics/page.tsx",
  "src/app/admin/settings/page.tsx",
]) {
  const source = read(file);
  if (file !== "src/app/admin/settings/page.tsx" && !source.includes("AdminPlaceholderPage")) {
    throw new Error(`${file} must remain a later-step placeholder.`);
  }
  if (file === "src/app/admin/settings/page.tsx" && !source.includes("canAccessSettings")) {
    throw new Error("Settings must remain Superadmin-only.");
  }
}

console.log("verify-admin-orders: ok");
