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
  isUnchangedAdminFulfilment,
  ADMIN_DISPATCH_CARRIER_ERROR,
  ADMIN_DISPATCH_UNPAID_ERROR,
  awaitingFulfilmentListConflict,
  parseAdminDispatchInput,
  parseAdminFulfilmentInput,
  parseAdminOrderListQuery,
  parseAdminOrderStatusInput,
  reportedAdminOrderStatusLabel,
  sanitizeAdminOrderSearch,
} from "../src/contracts/admin/orders";
import { isCommittedPurchase } from "../src/contracts/order/lifecycle";
import {
  canDispatchOrder,
  isAwaitingFulfilment,
  isIdempotentDispatch,
  legalOrderStatusPath,
  orderStatusForShipment,
  resolveDispatchShipmentStatus,
} from "../src/contracts/fulfilment/dispatch";
import { isLegalOrderStatusTransition, legalOrderStatusTargets } from "../src/contracts/order/status";
import {
  ADMIN_ORDER_GUEST,
  ADMIN_ORDER_HISTORY_EMPTY_TITLE,
  ADMIN_ORDER_NOT_FOUND_TITLE,
  ADMIN_ORDER_NO_FULFILMENT_TITLE,
  ADMIN_ORDER_SAVE_FAILED_TITLE,
  ADMIN_ORDER_SAVING,
  ADMIN_ORDER_UPDATE_FAILED_TITLE,
  ADMIN_ORDER_UPDATE_SAVED,
  ADMIN_ORDERS_EMPTY_TITLE,
  ADMIN_ORDERS_RETRY,
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
if (
  adminOrderListQueryString({
    q: "",
    status: null,
    payment: null,
    fulfilment: null,
    period: "all",
    page: 1,
  }) !== ""
) {
  throw new Error("Default list query must not add empty params.");
}
if (parseAdminOrderListQuery({ fulfilment: "awaiting" }).fulfilment !== "awaiting") {
  throw new Error("Awaiting fulfilment must be a list filter.");
}
if (parseAdminOrderListQuery({ fulfilment: "shipped" }).fulfilment !== null) {
  throw new Error("Unknown fulfilment filters must be ignored.");
}
const awaitingQuery = parseAdminOrderListQuery({ fulfilment: "awaiting", payment: "captured" });
if (!adminOrderListQueryString(awaitingQuery).includes("fulfilment=awaiting")) {
  throw new Error("Awaiting fulfilment must round-trip in the list query.");
}
if (!isAwaitingFulfilment({ paymentStatus: "captured", orderStatus: "processing" })) {
  throw new Error("Captured processing orders are awaiting fulfilment.");
}
if (isAwaitingFulfilment({ paymentStatus: "captured", orderStatus: "dispatched" })) {
  throw new Error("Dispatched orders are no longer awaiting fulfilment.");
}
if (isAwaitingFulfilment({ paymentStatus: "created", orderStatus: "placed" })) {
  throw new Error("Unpaid orders must not be listed as awaiting fulfilment.");
}
if (isAwaitingFulfilment({ paymentStatus: "created", orderStatus: "checkout" })) {
  throw new Error("Checkout attempts must not be awaiting fulfilment.");
}
if (
  isCommittedPurchase("created") ||
  isCommittedPurchase("failed") ||
  isCommittedPurchase("cancelled") ||
  !isCommittedPurchase("captured") ||
  !isCommittedPurchase("refunded")
) {
  throw new Error("Only captured and refunded payments are committed purchases.");
}
if (reportedAdminOrderStatusLabel("placed", "created") !== "Checkout") {
  throw new Error("Historical unpaid placed rows must be reported as checkout, not confirmed orders.");
}
if (reportedAdminOrderStatusLabel("placed", "captured") !== "Placed") {
  throw new Error("Captured placed orders stay placed.");
}
if (isLegalOrderStatusTransition("checkout", "processing")) {
  throw new Error("Staff must not move an unpaid checkout into fulfilment.");
}
if (!awaitingFulfilmentListConflict(parseAdminOrderListQuery({ fulfilment: "awaiting", status: "delivered" }))) {
  throw new Error("Awaiting fulfilment cannot include delivered orders.");
}

if (sanitizeAdminOrderSearch("a".repeat(200)).length !== 80) {
  throw new Error("Search must be length-limited.");
}
if (sanitizeAdminOrderSearch('ref","()\\') !== "ref") {
  throw new Error("Search sanitiser must strip PostgREST control characters.");
}
if (adminOrderSearchReference("shu-0123456789ab") !== "SHU-0123456789AB") {
  throw new Error("Reference lookup must accept a legacy order reference.");
}
if (adminOrderSearchReference("4827") !== "4827") {
  throw new Error("Reference lookup must accept a 4-digit order reference.");
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
if (parseAdminFulfilmentInput({
  carrierName: "Royal Mail",
  trackingNumber: "https://example.com/not-a-number",
  trackingUrl: "",
  status: "pending",
}).ok) {
  throw new Error("Tracking numbers must not accept URL-like values.");
}
if (!isUnchangedAdminFulfilment(
  { carrierName: "Royal Mail", trackingNumber: "AB123", trackingUrl: "https://example.com/track", status: "dispatched" },
  { carrierName: "Royal Mail", trackingNumber: "AB123", trackingUrl: "https://example.com/track", status: "dispatched" },
)) {
  throw new Error("Identical fulfilment payloads must be treated as unchanged.");
}
if (isUnchangedAdminFulfilment(
  { carrierName: "Royal Mail", trackingNumber: "AB123", trackingUrl: "https://example.com/track", status: "dispatched" },
  { carrierName: "Royal Mail", trackingNumber: "AB124", trackingUrl: "https://example.com/track", status: "dispatched" },
)) {
  throw new Error("Tracking number changes must not be treated as identical saves.");
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
if (httpsOk.ok && httpsOk.value.status === "delivered") {
  throw new Error("Saving a tracking URL must not set shipment status to delivered.");
}
if (parseAdminFulfilmentInput({ carrierName: "", trackingNumber: "", trackingUrl: "", status: "lost" }).ok) {
  throw new Error("Unknown shipment statuses must be rejected.");
}
const missingTracking = parseAdminDispatchInput({
  carrierName: "Royal Mail",
  trackingNumber: "",
  trackingUrl: "",
});
if (!missingTracking.ok || missingTracking.value.shipmentStatus !== "tracking_unavailable") {
  throw new Error("Dispatch without a tracking number must record tracking unavailable, not a failure.");
}
if (resolveDispatchShipmentStatus("AB123") !== "dispatched") {
  throw new Error("Dispatch with a tracking number must set the shipment to dispatched.");
}
const invalidDispatch = parseAdminDispatchInput({
  carrierName: " ",
  trackingNumber: "javascript:alert(1)",
  trackingUrl: "http://example.com/track",
});
if (invalidDispatch.ok) {
  throw new Error("Dispatch must require a carrier and reject invalid tracking.");
}
if (
  invalidDispatch.errors.carrierName !== ADMIN_DISPATCH_CARRIER_ERROR ||
  !invalidDispatch.errors.trackingNumber ||
  !invalidDispatch.errors.trackingUrl
) {
  throw new Error("Dispatch must require a carrier and reject invalid tracking.");
}
if (ADMIN_DISPATCH_UNPAID_ERROR !== "Only paid orders can be dispatched.") {
  throw new Error("Unpaid dispatch must stay a specific operator-facing error.");
}
const placedPath = legalOrderStatusPath("placed", "dispatched");
if (!placedPath || placedPath.join(",") !== "processing,dispatched") {
  throw new Error("Dispatch must follow the existing placed → processing → dispatched path.");
}
if (legalOrderStatusPath("delivered", "dispatched") !== null) {
  throw new Error("Delivered orders must not be dispatched backwards.");
}
if (orderStatusForShipment("pending") !== null) {
  throw new Error("A pending shipment must not move the order status.");
}
if (orderStatusForShipment("dispatched") !== "dispatched") {
  throw new Error("Shared shipment statuses must map onto the same order status.");
}
if (!canDispatchOrder({ paymentStatus: "captured", orderStatus: "placed", shipmentStatus: null })) {
  throw new Error("A paid order with no shipment must be dispatchable.");
}
if (canDispatchOrder({ paymentStatus: "authorized", orderStatus: "processing", shipmentStatus: null })) {
  throw new Error("Authorized but unpaid orders must not be dispatchable.");
}
if (canDispatchOrder({ paymentStatus: "captured", orderStatus: "processing", shipmentStatus: "in_transit" })) {
  throw new Error("Dispatch must not rewind a shipment that is already in transit.");
}
if (!isIdempotentDispatch(
  { carrierName: "Royal Mail", trackingNumber: "AB123", trackingUrl: "https://example.com/track", status: "dispatched" },
  { carrierName: "Royal Mail", trackingNumber: "AB123", trackingUrl: "https://example.com/track", shipmentStatus: "dispatched" },
)) {
  throw new Error("Repeating the same dispatch must be treated as already done.");
}
if (isIdempotentDispatch(null, {
  carrierName: "Royal Mail",
  trackingNumber: "AB123",
  trackingUrl: "",
  shipmentStatus: "dispatched",
})) {
  throw new Error("The first dispatch must not be treated as a duplicate.");
}
if (!isIdempotentDispatch(
  { carrierName: "Royal Mail", trackingNumber: "AB123", trackingUrl: "https://example.com/track", status: "in_transit" },
  { carrierName: "Other", trackingNumber: "ZZ", trackingUrl: "", shipmentStatus: "dispatched" },
)) {
  throw new Error("A later shipment status must not be overwritten by a second dispatch.");
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
  ADMIN_ORDER_UPDATE_FAILED_TITLE !== "Couldn’t update order" ||
  ADMIN_ORDER_SAVE_FAILED_TITLE !== "Couldn’t save changes" ||
  ADMIN_ORDER_SAVING !== "Saving" ||
  ADMIN_ORDER_UPDATE_SAVED !== "Saved just now ✓" ||
  ADMIN_ORDERS_RETRY !== "Try again"
) {
  throw new Error("Orders empty/error/save copy must stay operational and honest.");
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
if (!service.includes("COMMITTED_PURCHASE_PAYMENT_STATUSES")) {
  throw new Error("The default admin order list must be committed purchases, not every checkout attempt.");
}
const lifecycle = read("supabase/migrations/20260928180000_checkout_attempt_lifecycle.sql");
if (!lifecycle.includes("add value if not exists 'checkout'")) {
  throw new Error("Checkout attempts need an explicit order status.");
}
if (lifecycle.toLowerCase().includes("delete from public.orders") || lifecycle.toLowerCase().includes("truncate")) {
  throw new Error("Lifecycle migration must not delete existing orders.");
}
if (!service.includes("actor_user_id") || !service.includes("created_by")) {
  throw new Error("Events must record the acting admin for RLS and audit.");
}
if (service.includes("status: \"delivered\"") && service.includes("trackingUrl") && /trackingUrl[\s\S]*status:\s*\"delivered\"/.test(service)) {
  throw new Error("Saving tracking must not automatically mark a shipment delivered.");
}
const fulfilmentFn = service.slice(
  service.indexOf("export async function saveAdminFulfilment"),
  service.indexOf("function shipmentWritePayload"),
);
if (fulfilmentFn.includes('.from("orders").update') || fulfilmentFn.includes("status: parsed.status")) {
  throw new Error("Saving fulfilment must not write orders.status directly.");
}
if (!fulfilmentFn.includes("syncCapturedOrder")) {
  throw new Error("Captured fulfilment saves must synchronize order status.");
}
const syncFn = service.slice(
  service.indexOf("async function syncOrderStatusWithShipment"),
  service.indexOf("export async function dispatchAdminOrder"),
);
if (!syncFn.includes("legalOrderStatusPath") || !syncFn.includes("orderStatusForShipment")) {
  throw new Error("Order/shipment sync must follow the legal status path.");
}
if (syncFn.includes("trackingUrl") || syncFn.includes("status: \"delivered\"")) {
  throw new Error("Status sync must not mark an order delivered because a tracking URL was saved.");
}
if (!service.includes("export async function dispatchAdminOrder") || !service.includes("isIdempotentDispatch")) {
  throw new Error("Dispatch must be a dedicated idempotent action.");
}
if (!service.includes("23505")) {
  throw new Error("A unique shipment conflict must be treated as a duplicate dispatch, not a second insert.");
}
if (!service.includes("AWAITING_FULFILMENT_ORDER_STATUSES") || !service.includes('query.fulfilment === "awaiting"')) {
  throw new Error("The order list must be able to load paid orders awaiting fulfilment.");
}
if (!fulfilmentFn.includes("isUnchangedAdminFulfilment")) {
  throw new Error("Identical fulfilment saves must skip duplicate event writes.");
}
if (!service.includes("TRACKING_EVENT_COLUMNS") || !service.includes("parseTrackingEvent")) {
  throw new Error("Admin order detail must load tracking_events for display.");
}
if (service.includes("notes") && /select\([^)]*notes/.test(service)) {
  throw new Error("Admin Orders must not select shipment notes that clients cannot read.");
}

const actions = read("src/app/admin/orders/actions.ts");
if (!actions.includes("\"use server\"") || !actions.includes("getAdminGate")) {
  throw new Error("Order mutations must be server actions behind getAdminGate().");
}
if (!actions.includes("cartActionOriginAllowed") || !actions.includes("hasForbiddenOwnershipKey")) {
  throw new Error("Order mutations must keep origin and ownership-key guards.");
}
if (!actions.includes("dispatchAdminOrder") || !actions.includes('intent === "dispatch"')) {
  throw new Error("Dispatch must be a server action behind the same admin gate.");
}
if (!actions.includes("revalidatePath(routes.adminOrders)") || !actions.includes("adminOrderPath")) {
  throw new Error("Successful mutations must revalidate the order list and detail.");
}
if (!actions.includes('result.status === "ok"') || actions.includes("revalidatePath") === false) {
  throw new Error("Successful mutations must revalidate only after a persisted ok result.");
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
    source.includes("razorpay") || source.includes("checkout.paypal") || source.includes("web-sdk/v6") ||
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
if (!forms.includes("ADMIN_ORDER_SAVING") || !forms.includes("ADMIN_ORDER_UPDATE_SAVED") || !forms.includes("ADMIN_ORDERS_RETRY")) {
  throw new Error("Fulfilment forms must expose Saving, Saved, and Try again states.");
}
if (!forms.includes("loading={pending}")) {
  throw new Error("Fulfilment submit must disable while pending to prevent duplicate saves.");
}
if (!forms.includes('value="dispatch"') || !forms.includes("canDispatchOrder")) {
  throw new Error("Paid orders awaiting fulfilment must expose a dispatch action.");
}

const detail = read("src/components/admin/AdminOrderDetail.tsx");
if (!detail.includes("ADMIN_ORDER_GUEST") || !detail.includes("ADMIN_ORDER_NO_FULFILMENT_TITLE")) {
  throw new Error("Order detail must handle guest orders and missing fulfilment.");
}
if (!detail.includes("ADMIN_ORDER_HISTORY_EMPTY_TITLE") || !detail.includes("adminOrderStatusLabel")) {
  throw new Error("Order detail must show event history or an empty state, with textual statuses.");
}
if (!detail.includes("ADMIN_ORDERS_AWAITING_FULFILMENT") || !detail.includes("isAwaitingFulfilment")) {
  throw new Error("Order detail must identify paid orders awaiting fulfilment.");
}
if (!detail.includes("ADMIN_ORDER_TRACKING_EVENTS") || !detail.includes("order.shipment.events")) {
  throw new Error("Order detail must show tracking events from the existing tracking_events table.");
}

const rls = [
  read("supabase/migrations/20260914230750_initial_production_schema.sql"),
  read("supabase/migrations/20260914231056_optimize_foundation_indexes_and_rls.sql"),
  read("supabase/migrations/20260916063709_admin_v1_role_rls.sql"),
].join("\n");
if (!rls.includes("shipments_admin_update") || !rls.includes("tracking_events_admin_insert") || !rls.includes("orders_admin_update")) {
  throw new Error("Staff fulfilment mutations must stay on existing admin RLS policies.");
}
if (rls.includes("tracking_events_customer_insert") || rls.includes("shipments_customer_update") || rls.includes("orders_customer_update")) {
  throw new Error("Customers must not be able to update shipments, order status, or insert tracking events.");
}
if (!rls.includes("'admin'::public.admin_role") || !rls.includes("'superadmin'::public.admin_role")) {
  throw new Error("private.is_admin() must continue to allow both Admin and Superadmin.");
}

const session = read("src/lib/admin-session.ts");
if (!session.includes("getAdminGate") || !session.includes("toAdminV1Role")) {
  throw new Error("Admin authorization must stay on getAdminGate().");
}

const customerOrders = read("src/services/customer-orders.ts");
if (!customerOrders.includes('from("shipments")') || !customerOrders.includes('from("tracking_events")')) {
  throw new Error("Customer order service must read the same shipments and tracking_events tables.");
}
if (customerOrders.includes(".update(") || customerOrders.includes(".insert(")) {
  throw new Error("Customer order service must remain read-only.");
}

const checkout = read("src/app/(storefront)/checkout/page.tsx");
if (!checkout.includes("Checkout") && !read("src/components/checkout/CheckoutContact.tsx").includes("CONTINUE_AS_GUEST")) {
  throw new Error("Guest checkout must remain present.");
}
const checkoutContact = read("src/components/checkout/CheckoutContact.tsx");
if (!checkoutContact.includes("CONTINUE_AS_GUEST")) {
  throw new Error("Guest checkout must remain unaffected.");
}

const dto = read("src/contracts/order/dto.ts");
if (!dto.includes("shipment notes") || !dto.includes("actor ids stay off this view")) {
  throw new Error("Customer DTOs must keep stripping internal notes and actor ids.");
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

for (const file of ["src/app/admin/settings/page.tsx"]) {
  const source = read(file);
  if (file !== "src/app/admin/settings/page.tsx" && !source.includes("AdminPlaceholderPage")) {
    throw new Error(`${file} must remain a later-step placeholder.`);
  }
  if (file === "src/app/admin/settings/page.tsx" && !source.includes("canAccessSettings")) {
    throw new Error("Settings must remain Superadmin-only.");
  }
}

console.log("verify-admin-orders: ok");
