import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ADMIN_CUSTOMERS_PAGE_SIZE,
  ADMIN_CUSTOMER_ORDERS_PAGE_SIZE,
  adminCustomerDisplayName,
  adminCustomerListQueryString,
  adminCustomerSearchReference,
  capturedSpendMinor,
  formatOrderItemSummary,
  guestCustomerId,
  parseAdminCustomerId,
  parseAdminCustomerListQuery,
  parseAdminCustomerOrdersPage,
  sanitizeAdminCustomerSearch,
  summariseOrderItems,
} from "../src/contracts/admin/customers";
import { canAccessAdmin } from "../src/contracts/admin/roles";
import {
  ADMIN_CUSTOMER_GUEST_HINT,
  ADMIN_CUSTOMER_NOT_FOUND_TITLE,
  ADMIN_CUSTOMER_ORDER_HISTORY_EMPTY_TITLE,
  ADMIN_CUSTOMERS_EMPTY_TITLE,
  ADMIN_CUSTOMERS_TYPE_GUEST,
  ADMIN_CUSTOMERS_TYPE_REGISTERED,
  ADMIN_CUSTOMERS_UNAVAILABLE_TITLE,
} from "../src/lib/admin-copy";
import { isUuid } from "../src/lib/ids";
import { formatGbpMinor } from "../src/lib/money";
import { adminCustomerPath, adminOrderPath, routes } from "../src/lib/navigation";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (routes.adminCustomers !== "/admin/customers") {
  throw new Error("Customers list must stay /admin/customers.");
}
if (adminCustomerPath("11111111-1111-4111-8111-111111111111") !== "/admin/customers/11111111-1111-4111-8111-111111111111") {
  throw new Error("Registered customer detail must stay /admin/customers/[id].");
}
if (!adminCustomerPath("guest:ada@example.com").startsWith("/admin/customers/")) {
  throw new Error("Guest customer detail must stay under /admin/customers/[id].");
}
if (adminCustomerPath("guest:ada@example.com").includes("@")) {
  throw new Error("Guest customer ids must be URL-encoded.");
}
if (ADMIN_CUSTOMERS_PAGE_SIZE !== 20 || ADMIN_CUSTOMER_ORDERS_PAGE_SIZE !== 20) {
  throw new Error("Customer lists must paginate server-side with a bounded page size.");
}

const parsed = parseAdminCustomerListQuery({
  q: "  Ada %_* ",
  type: "guest",
  orders: "has_orders",
  page: "2",
});
if (parsed.q.includes("%") || parsed.q.includes("*") || parsed.q.includes("_")) {
  throw new Error("Customer search must strip wildcard/injection characters.");
}
if (parsed.accountType !== "guest" || parsed.orders !== "has_orders" || parsed.page !== 2) {
  throw new Error("Customer list query parsing must accept known filters.");
}
if (parseAdminCustomerListQuery({ type: "vip", orders: "maybe", page: "-3" }).page !== 1) {
  throw new Error("Unknown customer filters must be ignored and invalid pages must fall back to 1.");
}
if (parseAdminCustomerListQuery({ q: ["alpha"], page: ["3"] }).page !== 3) {
  throw new Error("Array search params must use the first value.");
}
if (parseAdminCustomerOrdersPage("4") !== 4 || parseAdminCustomerOrdersPage(["0"]) !== 1) {
  throw new Error("Order-history page parsing must accept positive integers only.");
}

const queryString = adminCustomerListQueryString(parsed);
if (!queryString.includes("type=guest") || !queryString.includes("page=2")) {
  throw new Error("Customer list query string must round-trip filters and page.");
}
if (adminCustomerListQueryString({ q: "", accountType: "all", orders: "all", page: 1 }) !== "") {
  throw new Error("Default customer list query must not add empty params.");
}

if (sanitizeAdminCustomerSearch("a".repeat(200)).length !== 80) {
  throw new Error("Customer search must be length-limited.");
}
if (sanitizeAdminCustomerSearch('name","()\\') !== "name") {
  throw new Error("Customer search sanitiser must strip PostgREST control characters.");
}
if (adminCustomerSearchReference("shu-0123456789ab") !== "SHU-0123456789AB") {
  throw new Error("Customer search must accept a canonical order reference.");
}

if (guestCustomerId("Ada@Example.com") !== "guest:ada@example.com") {
  throw new Error("Guest customer ids must normalise email and stay order-derived.");
}
if (parseAdminCustomerId("11111111-1111-4111-8111-111111111111")?.kind !== "registered") {
  throw new Error("UUID customer ids must resolve to registered profiles.");
}
if (parseAdminCustomerId("guest:ada@example.com")?.kind !== "guest") {
  throw new Error("guest: email ids must resolve to order-derived customers.");
}
if (parseAdminCustomerId("guest:not-an-email") !== null || parseAdminCustomerId("crm:1") !== null) {
  throw new Error("Unknown customer id schemes must be rejected.");
}
if (isUuid("guest:ada@example.com")) {
  throw new Error("Guest ids must not be treated as profile UUIDs.");
}

if (adminCustomerDisplayName("Ada", "West", "ada@example.com") !== "Ada West") {
  throw new Error("Customer name must prefer first and last name.");
}
if (adminCustomerDisplayName("  ", "", "ada@example.com") !== "ada@example.com") {
  throw new Error("Nameless customers must fall back to email, not an invented name.");
}

if (capturedSpendMinor("captured", 4900) !== 4900) {
  throw new Error("Captured orders must count toward total spent.");
}
if (
  capturedSpendMinor("created", 4900) !== 0 ||
  capturedSpendMinor("failed", 4900) !== 0 ||
  capturedSpendMinor("cancelled", 4900) !== 0 ||
  capturedSpendMinor("refunded", 4900) !== 0
) {
  throw new Error("Unpaid, failed, cancelled, and refunded orders must not count toward total spent.");
}
if (formatGbpMinor(0) !== "£0") {
  throw new Error("Zero spend must render as £0.");
}

const summary = summariseOrderItems([
  { productName: "Aviator", quantity: 2 },
  { productName: "Round", quantity: 1 },
]);
if (formatOrderItemSummary(summary) !== "Aviator × 2 · +1") {
  throw new Error("Order summaries must use the first item and remaining count.");
}
if (formatOrderItemSummary(null) !== "—") {
  throw new Error("Orders without items must not invent a product summary.");
}

if (!canAccessAdmin("admin") || !canAccessAdmin("superadmin") || canAccessAdmin(null)) {
  throw new Error("Customers must follow the existing Admin/Superadmin gate.");
}

if (
  ADMIN_CUSTOMERS_EMPTY_TITLE !== "No customers yet" ||
  ADMIN_CUSTOMER_ORDER_HISTORY_EMPTY_TITLE !== "No orders yet" ||
  ADMIN_CUSTOMER_NOT_FOUND_TITLE !== "Customer not found" ||
  ADMIN_CUSTOMERS_UNAVAILABLE_TITLE !== "Customers unavailable" ||
  ADMIN_CUSTOMERS_TYPE_GUEST !== "Guest" ||
  ADMIN_CUSTOMERS_TYPE_REGISTERED !== "Registered"
) {
  throw new Error("Customer empty/error copy must stay operational and honest.");
}
if (!ADMIN_CUSTOMER_GUEST_HINT.includes("not a customer account")) {
  throw new Error("Guest rows must be labelled as order-derived, not accounts.");
}

const service = read("src/services/admin-customers.ts");
if (!service.includes("server-only") || !service.includes("createSupabaseServerClient")) {
  throw new Error("Admin Customers queries must use the cookie-bound server client.");
}
if (service.includes("createSupabaseAdminClient") || service.includes("SUPABASE_SECRET_KEY")) {
  throw new Error("Admin Customers must not use the service-role client.");
}
if (!service.includes(".range(") || !service.includes("ADMIN_CUSTOMERS_PAGE_SIZE")) {
  throw new Error("Customer list must paginate on the server.");
}
if (!service.includes('from("admin_customer_directory")') || !service.includes('from("orders")')) {
  throw new Error("Customers must aggregate profiles/orders, not a CRM table.");
}
if (service.includes('from("customers")') || service.includes("insert(")) {
  throw new Error("Customers V1 must not create or write a customers table.");
}
if (service.includes("password") || service.includes("refresh_token") || service.includes("app_metadata")) {
  throw new Error("Customer payloads must not expose authentication secrets.");
}
if (!service.includes("payment_status = 'captured'") && !service.includes('payment_status') ) {
  throw new Error("Total spent must come from persisted order payment status.");
}

const migration = read("supabase/migrations/20260917124600_admin_customer_directory.sql");
if (!migration.includes("security_invoker") || !migration.includes("private.is_admin()")) {
  throw new Error("Customer directory view must keep RLS and Admin-only visibility.");
}
if (!migration.includes("create or replace view public.admin_customer_directory")) {
  throw new Error("Customer directory must be a view over profiles and orders.");
}
if (migration.includes("create table public.customers") || migration.includes("lifetime_value")) {
  throw new Error("Customers V1 must not add a CRM table or predicted LTV.");
}
if (!migration.includes("user_id is null")) {
  throw new Error("Guest rows must be derived from orders with no user_id.");
}

const listPage = read("src/app/admin/customers/page.tsx");
const detailPage = read("src/app/admin/customers/[id]/page.tsx");
if (listPage.includes("AdminPlaceholderPage") || detailPage.includes("AdminPlaceholderPage")) {
  throw new Error("Customers routes must not remain placeholders.");
}
if (!listPage.includes("getAdminGate") || !detailPage.includes("getAdminGate")) {
  throw new Error("Customers pages must require getAdminGate().");
}
if (!detailPage.includes("AdminCustomerDetailSection")) {
  throw new Error("Customer detail must use the Admin customer detail section.");
}

const table = read("src/components/admin/AdminCustomersTable.tsx");
if (!table.includes("ADMIN_CUSTOMERS_EMPTY_TITLE") || !table.includes("adminCustomerPath")) {
  throw new Error("Customer list must have an empty state and link to detail.");
}
if (!table.includes("ADMIN_CUSTOMERS_TYPE_GUEST")) {
  throw new Error("Customer list must distinguish guest and registered rows.");
}

const detail = read("src/components/admin/AdminCustomerDetail.tsx");
if (!detail.includes("adminOrderPath") || !detail.includes("ADMIN_CUSTOMER_ORDER_HISTORY")) {
  throw new Error("Customer detail must show order history linking to existing Orders Admin.");
}
if (!detail.includes("ADMIN_CUSTOMER_GUEST_HINT") || !detail.includes("ADMIN_CUSTOMER_ORDER_HISTORY_EMPTY_TITLE")) {
  throw new Error("Customer detail must handle guests and customers with no orders.");
}

const skeletons = read("src/components/admin/AdminCustomersSkeletons.tsx");
if (!skeletons.includes("AdminCustomersTableSkeleton") || !skeletons.includes("AdminCustomerDetailSkeleton")) {
  throw new Error("Customers must use section skeletons, not a page spinner.");
}

const css = read("src/components/admin/AdminCustomers.module.css");
if (!css.includes("min-width: 768px") || !css.includes("min-width: 1200px")) {
  throw new Error("Customers CSS must follow the locked tablet and desktop breakpoints.");
}
if (!css.includes("min-height: var(--touch-min)")) {
  throw new Error("Customer rows must keep the 44px touch minimum.");
}

if (adminOrderPath("order-1") !== "/admin/orders/order-1") {
  throw new Error("Customer order history must reuse /admin/orders/[id].");
}

const sources = [
  "src/app/admin/customers/page.tsx",
  "src/app/admin/customers/[id]/page.tsx",
  "src/components/admin/AdminCustomersPage.tsx",
  "src/components/admin/AdminCustomersTable.tsx",
  "src/components/admin/AdminCustomerDetail.tsx",
  "src/components/admin/AdminCustomerFilters.tsx",
  "src/services/admin-customers.ts",
  "src/contracts/admin/customers.ts",
];
for (const file of sources) {
  const source = read(file);
  if (source.includes("SiteChrome") || source.includes("createSupabaseAdminClient")) {
    throw new Error(`${file} must stay inside Admin and the user-scoped server client.`);
  }
  if (
    source.includes("loyalty") ||
    source.includes("churn") ||
    source.includes("segment") ||
    source.includes("razorpay") || source.includes("checkout.paypal") || source.includes("web-sdk/v6")
  ) {
    throw new Error(`${file} must not add CRM, payments, or future-phase features.`);
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
}

console.log("verify-admin-customers: ok");
