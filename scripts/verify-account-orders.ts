import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseGuestTrackingRequest,
  GUEST_TRACKING_GENERIC_ERROR,
} from "../src/contracts/order/tracking";
import { parseOrderReferenceInput } from "../src/contracts/order/reference";
import { CUSTOMER_ORDER_STATUS_LABELS } from "../src/contracts/order/status";
import { CONTINUE_AS_GUEST } from "../src/lib/checkout-copy";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (CUSTOMER_ORDER_STATUS_LABELS.placed !== "ORDER PLACED") {
  throw new Error("Locked ORDER PLACED label drifted.");
}
if (CUSTOMER_ORDER_STATUS_LABELS.tracking_unavailable !== "TRACKING NOT AVAILABLE") {
  throw new Error("Locked TRACKING NOT AVAILABLE label drifted.");
}
if (CUSTOMER_ORDER_STATUS_LABELS.exception !== "EXCEPTION") {
  throw new Error("Locked EXCEPTION label drifted.");
}

const guessable = parseGuestTrackingRequest({ orderReference: "SHU10294", email: "a@b.com" });
if (guessable.ok || guessable.message !== GUEST_TRACKING_GENERIC_ERROR) {
  throw new Error("Guest tracking must reject guessable references with a generic error.");
}
if (parseOrderReferenceInput("12345") !== null) {
  throw new Error("Numeric order numbers must not be treated as order_reference.");
}

if (CONTINUE_AS_GUEST !== "Continue as guest") {
  throw new Error("Guest checkout CTA must remain locked.");
}

const customerOrders = read("src/services/customer-orders.ts");
if (!customerOrders.includes("server-only")) {
  throw new Error("Customer order access must stay server-only.");
}
if (!customerOrders.includes("createSupabaseServerClient")) {
  throw new Error("Customer order access must use the cookie-bound Supabase client.");
}
if (customerOrders.includes("createSupabaseAdminClient") || customerOrders.includes("SUPABASE_SECRET_KEY")) {
  throw new Error("Customer order access must not use the service-role client.");
}
if (customerOrders.includes(".update(") || customerOrders.includes(".insert(") || customerOrders.includes(".delete(")) {
  throw new Error("Customer order access must be read-only.");
}
if (!customerOrders.includes("getOptionalAccountUser") || !customerOrders.includes("user_id")) {
  throw new Error("Customer order access must derive ownership from the authenticated session.");
}
if (!customerOrders.includes("order_events") || !customerOrders.includes("tracking_events")) {
  throw new Error("Customer order detail must load shipment tracking and order events.");
}
if (customerOrders.includes("actor_user_id") || customerOrders.includes("notes")) {
  throw new Error("Customer order queries must not select actor ids or shipment notes.");
}

const guestTracking = read("src/services/guest-tracking.ts");
if (!guestTracking.includes("guestTrackingVerified") || !guestTracking.includes("createSupabaseAdminClient")) {
  throw new Error("Guest tracking must keep the existing reference+email verification path.");
}
if (guestTracking.includes("CustomerOrderView") || guestTracking.includes("toCustomerOrderView")) {
  throw new Error("Guest tracking must not reuse CustomerOrderView.");
}
if (guestTracking.includes("from(\"orders\")") && !guestTracking.includes("order_reference")) {
  throw new Error("Guest tracking must look up by order_reference, not a guessable id.");
}

const account = read("src/services/account.ts");
if (!account.includes("getOptionalAccountUser") || !account.includes("session.id !== userId")) {
  throw new Error("Address access must require the authenticated session user id.");
}
if (account.includes("createSupabaseAdminClient")) {
  throw new Error("Account profile/address access must stay on the cookie-bound client.");
}

const accountActions = read("src/app/(storefront)/account/actions.ts");
if (accountActions.includes("createSupabaseAdminClient")) {
  throw new Error("Account mutations must not use the service-role client.");
}
if (!accountActions.includes("getOptionalAccountUser") || !accountActions.includes("hasForbiddenOwnershipKey")) {
  throw new Error("Account mutations must use the session and reject client ownership keys.");
}
if (!accountActions.includes("signInWithPassword") || !accountActions.includes("signInWithOAuth")) {
  throw new Error("Account auth must keep email/password and Google OAuth paths.");
}
if (!accountActions.includes("resetPasswordForEmail") || !accountActions.includes("signOut")) {
  throw new Error("Account auth must keep password reset and sign out.");
}

const proxy = read("src/proxy.ts");
if (!proxy.includes("/account/:path*") || proxy.includes("/checkout")) {
  throw new Error("Session proxy must cover /account and must not hijack guest checkout.");
}

const rls = [
  read("supabase/migrations/20260914230750_initial_production_schema.sql"),
  read("supabase/migrations/20260914231056_optimize_foundation_indexes_and_rls.sql"),
  read("supabase/migrations/20260916063709_admin_v1_role_rls.sql"),
].join("\n");

const requiredPolicies = [
  "profiles_customer_select_own",
  "addresses_customer_select_own",
  "addresses_customer_insert_own",
  "addresses_customer_update_own",
  "addresses_customer_delete_own",
  "orders_customer_select_own",
  "order_items_customer_select_own",
  "shipments_customer_select_own",
  "tracking_events_customer_select_own",
  "order_events_customer_select_visible_own",
  "orders_admin_update",
  "shipments_admin_update",
  "tracking_events_admin_insert",
  "order_events_admin_insert",
];
for (const policy of requiredPolicies) {
  if (!rls.includes(policy)) {
    throw new Error(`Required RLS policy missing: ${policy}`);
  }
}
if (!rls.includes("enable row level security")) {
  throw new Error("RLS must stay enabled in the foundation schema.");
}
if (rls.includes("for all\nto anon") || rls.includes("orders_anon")) {
  throw new Error("Anon must not have a broad orders policy.");
}

const adminOrders = read("src/services/admin-orders.ts");
if (!adminOrders.includes("createSupabaseServerClient") || adminOrders.includes("createSupabaseAdminClient")) {
  throw new Error("Admin Orders must keep the cookie-bound authorization model.");
}
if (!adminOrders.includes("updateAdminOrderStatus") || !adminOrders.includes("order_events")) {
  throw new Error("Admin operational mutations must remain on the admin service.");
}

const roles = read("src/contracts/admin/roles.ts");
if (!roles.includes("superadmin") || !roles.includes("admin")) {
  throw new Error("Admin V1 roles must remain superadmin and admin.");
}

const checkoutContact = read("src/components/checkout/CheckoutContact.tsx");
if (!checkoutContact.includes("CONTINUE_AS_GUEST")) {
  throw new Error("Guest checkout contact must keep Continue as guest.");
}

const ordersPage = read("src/app/(storefront)/account/orders/page.tsx");
if (!ordersPage.includes("listOwnCustomerOrders") || ordersPage.includes("OrdersPlaceholder")) {
  throw new Error("Account orders must use listOwnCustomerOrders, not a placeholder.");
}
if (!ordersPage.includes("requireAccountUser")) {
  throw new Error("Account orders must stay session-gated.");
}

const googleMark = read("src/components/account/GoogleMark.tsx");
if (!googleMark.includes("#4285F4")) {
  throw new Error("Google Auth must use the official G mark.");
}

console.log("verify-account-orders: ok");
