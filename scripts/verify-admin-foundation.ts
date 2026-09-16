import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AUTHENTICATED_ROLE_ASSIGNMENT_ALLOWED,
  canAccessAdmin,
  canAccessSettings,
  canArchiveProduct,
  canAssignAdminRole,
  canDeleteProduct,
  canPublishProduct,
  canUnpublishProduct,
  isAdminV1Role,
  isStaffAdmin,
  isSuperadmin,
  toAdminV1Role,
} from "../src/contracts/admin/roles";
import { isAdminAppPath, resolveSafeAdminNextPath, resolveSafeNextPath } from "../src/lib/account-validate";
import {
  ADMIN_NAV_PRIMARY,
  adminNavForRole,
  isAdminNavItemActive,
} from "../src/lib/admin-nav";
import { routes } from "../src/lib/navigation";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (routes.admin !== "/admin" || routes.adminSettings !== "/admin/settings") {
  throw new Error("Admin routes must stay /admin and /admin/settings.");
}
if (
  routes.adminOrders !== "/admin/orders" ||
  routes.adminProducts !== "/admin/products" ||
  routes.adminCollections !== "/admin/collections" ||
  routes.adminCustomers !== "/admin/customers" ||
  routes.adminAnalytics !== "/admin/analytics"
) {
  throw new Error("Admin module routes must be wired under /admin.");
}
if (routes.account !== "/account") {
  throw new Error("Customer account must remain /account.");
}

if (!isAdminV1Role("admin") || !isAdminV1Role("superadmin")) {
  throw new Error("V1 roles must be admin and superadmin.");
}
if (isAdminV1Role("operations") || isAdminV1Role("support") || toAdminV1Role("operations") !== null) {
  throw new Error("operations/support must not be V1 application roles.");
}

if (canAccessAdmin(null) || canAccessAdmin(undefined) || isStaffAdmin(null)) {
  throw new Error("Unauthenticated / missing role must be rejected from Admin.");
}
if (canAccessAdmin("admin") === false || canAccessAdmin("superadmin") === false) {
  throw new Error("Admin and Superadmin must access Admin.");
}

if (canAccessSettings("admin") || canArchiveProduct("admin") || canDeleteProduct("admin")) {
  throw new Error("Admin must not access Settings, archive, or delete.");
}
if (!canAccessSettings("superadmin") || !canArchiveProduct("superadmin") || !canDeleteProduct("superadmin")) {
  throw new Error("Superadmin role must resolve to Settings/archive/delete.");
}
if (!canPublishProduct("admin") || !canUnpublishProduct("admin") || !isSuperadmin("superadmin")) {
  throw new Error("Admin must keep publish/unpublish; Superadmin flag must resolve.");
}

if (AUTHENTICATED_ROLE_ASSIGNMENT_ALLOWED) {
  throw new Error("Authenticated sessions must not assign admin roles.");
}
if (
  canAssignAdminRole("admin", "superadmin") ||
  canAssignAdminRole("superadmin", "admin") ||
  canAssignAdminRole(null, "superadmin")
) {
  throw new Error("Admin must not be able to become Superadmin from the app.");
}

if (resolveSafeNextPath("/admin") !== "/account" || resolveSafeNextPath("/admin/settings") !== "/account") {
  throw new Error("Customer next paths must not enter /admin.");
}
if (!isAdminAppPath("/admin") || resolveSafeAdminNextPath("/account") !== "/admin") {
  throw new Error("Admin next paths must stay inside /admin.");
}

if (adminNavForRole("admin").settings !== null) {
  throw new Error("Settings must not appear in Admin navigation.");
}
if (!adminNavForRole("superadmin").settings) {
  throw new Error("Settings must be visible in Superadmin navigation.");
}
if (!isAdminNavItemActive("/admin/products/abc", ADMIN_NAV_PRIMARY[2])) {
  throw new Error("Nested product routes must keep Products active.");
}
if (isAdminNavItemActive("/admin/orders/abc", ADMIN_NAV_PRIMARY[1]) === false) {
  throw new Error("Nested order routes must keep Orders active.");
}
if (isAdminNavItemActive("/admin/orders", { href: routes.admin, exact: true, label: "Home" })) {
  throw new Error("Home must be exact /admin only.");
}
if (!isAdminNavItemActive("/admin", { href: routes.admin, exact: true, label: "Home" })) {
  throw new Error("Home must be active on /admin.");
}

const rootLayout = read("src/app/layout.tsx");
if (rootLayout.includes("SiteChrome")) {
  throw new Error("Root layout must not include SiteChrome.");
}
const storefrontLayout = read("src/app/(storefront)/layout.tsx");
if (!storefrontLayout.includes("SiteChrome")) {
  throw new Error("Storefront layout must own SiteChrome.");
}
const adminLayout = read("src/app/admin/layout.tsx");
if (adminLayout.includes("SiteChrome")) {
  throw new Error("Admin layout must not include SiteChrome.");
}
if (!adminLayout.includes("AdminShell") || !adminLayout.includes("AdminAuthFrame")) {
  throw new Error("Admin layout must switch AuthFrame and AdminShell from the gate.");
}
const adminNotFound = read("src/app/admin/not-found.tsx");
if (adminNotFound.includes("SiteChrome") || adminNotFound.includes("routes.shop")) {
  throw new Error("Admin not-found must not inherit storefront chrome or Shop CTA.");
}
const adminCatchAll = read("src/app/admin/[...slug]/page.tsx");
if (!adminCatchAll.includes("AdminNotFound") || adminCatchAll.includes("from \"@/components/navigation/SiteChrome\"")) {
  throw new Error("Unmatched /admin/* must render Admin not-found without SiteChrome.");
}
if (!adminLayout.includes("privatePathMetadata")) {
  throw new Error("Admin layout must stay noindex.");
}

const adminPage = read("src/app/admin/page.tsx");
if (!adminPage.includes("AdminDashboard") || !adminPage.includes("parseDashboardPeriod")) {
  throw new Error("Admin home must render the dashboard for an authorised session.");
}
if (adminPage.includes("createSupabaseAdminClient") || adminPage.includes("ADMIN_SIGNED_IN_AS")) {
  throw new Error("Admin home must not use the service-role client or the auth-foundation meta list.");
}

const dashboard = read("src/components/admin/AdminDashboard.tsx");
if (!dashboard.includes("AdminPageHeader") || !dashboard.includes("ADMIN_HOME_BODY")) {
  throw new Error("Dashboard must keep AdminPageHeader.");
}
if (!dashboard.includes("AdminDashboardKpis") || !dashboard.includes("AdminSalesOverview")) {
  throw new Error("Dashboard must include KPIs and sales overview.");
}
if (!dashboard.includes("AdminRecentOrders") || !dashboard.includes("AdminOperationalAlerts")) {
  throw new Error("Dashboard must include recent orders and operational alerts.");
}
if (!dashboard.includes("Suspense") || !dashboard.includes("AdminKpiSkeleton")) {
  throw new Error("Dashboard must stream section loading states.");
}

const settingsPage = read("src/app/admin/settings/page.tsx");
if (!settingsPage.includes("canAccessSettings") || !settingsPage.includes("ADMIN_SETTINGS_FORBIDDEN")) {
  throw new Error("Settings must deny Admin server-side.");
}
if (settingsPage.includes("service-role") || settingsPage.includes("createSupabaseAdminClient")) {
  throw new Error("Settings must not use the service-role client.");
}

const adminActions = read("src/app/admin/actions.ts");
if (!adminActions.includes("adminSignInAction") || !adminActions.includes("toAdminV1Role")) {
  throw new Error("Admin sign-in must resolve V1 roles server-side.");
}
if (/input\.role|role:\s*input/.test(adminActions)) {
  throw new Error("Admin sign-in must not take a role from the browser.");
}
if (adminActions.includes("createSupabaseAdminClient")) {
  throw new Error("Admin auth must not use the service-role client.");
}
if (!adminActions.includes("signOut()") || !adminActions.includes("ADMIN_FORBIDDEN")) {
  throw new Error("Non-staff sign-in must sign out and deny Admin.");
}

const shell = read("src/components/admin/AdminShell.tsx");
if (!shell.includes("AdminSidebar") || !shell.includes("AdminTopbar") || !shell.includes("AdminMobileDrawer")) {
  throw new Error("AdminShell must compose sidebar, topbar, and mobile drawer.");
}
if (shell.includes("SiteChrome") || shell.includes("SiteHeader")) {
  throw new Error("AdminShell must not import storefront chrome.");
}

const drawer = read("src/components/admin/AdminMobileDrawer.tsx");
if (!drawer.includes("Drawer") || !drawer.includes("ADMIN_CLOSE_MENU")) {
  throw new Error("Mobile Admin navigation must use the accessible Drawer.");
}

const header = read("src/components/admin/AdminPageHeader.tsx");
if (!header.includes("action") || !header.includes("title")) {
  throw new Error("AdminPageHeader must support title and an optional action.");
}

for (const file of [
  "src/app/admin/orders/page.tsx",
  "src/app/admin/orders/[id]/page.tsx",
  "src/app/admin/products/page.tsx",
  "src/app/admin/products/new/page.tsx",
  "src/app/admin/products/[id]/page.tsx",
  "src/app/admin/collections/page.tsx",
  "src/app/admin/collections/[id]/page.tsx",
  "src/app/admin/customers/page.tsx",
  "src/app/admin/customers/[id]/page.tsx",
  "src/app/admin/analytics/page.tsx",
]) {
  const source = read(file);
  if (!source.includes("AdminPlaceholderPage") || source.includes("MetricCard")) {
    throw new Error(`${file} must be a shell placeholder, not a module.`);
  }
}

const productsPage = read("src/app/admin/products/page.tsx");
if (productsPage.includes("Add product") || productsPage.includes("ADD PRODUCT")) {
  throw new Error("Products placeholder must not ship the Add Product action yet.");
}

const proxy = read("src/proxy.ts");
if (!proxy.includes('"/admin"') || !proxy.includes('"/admin/:path*"')) {
  throw new Error("Proxy matcher must refresh Admin sessions.");
}

const seo = read("src/lib/seo.ts");
if (!seo.includes('"/admin"')) {
  throw new Error("Robots disallow list must include /admin.");
}

const nav = read("src/lib/navigation.ts");
if (nav.includes("href: routes.admin") && nav.includes("primaryNav")) {
  const primary = nav.slice(nav.indexOf("export const primaryNav"), nav.indexOf("export const genderLinks"));
  if (primary.includes("routes.admin")) {
    throw new Error("Storefront primary nav must not link to Admin.");
  }
}

const session = read("src/lib/admin-session.ts");
if (!session.includes("auth.getUser") || session.includes("getSession()")) {
  throw new Error("Admin gate must use getUser(), not getSession() alone.");
}
if (session.includes("user_metadata") || session.includes("app_metadata")) {
  throw new Error("Admin role must not be read from JWT user/app metadata.");
}

const enumMigration = read("supabase/migrations/20260916063656_admin_v1_add_superadmin_enum.sql");
if (!enumMigration.includes("add value if not exists 'superadmin'")) {
  throw new Error("Enum migration must add superadmin without dropping legacy labels.");
}

const rlsMigration = read("supabase/migrations/20260916063709_admin_v1_role_rls.sql");
for (const token of [
  "private.is_superadmin()",
  "role in (",
  "'superadmin'::public.admin_role",
  "admin_users_v1_roles_check",
  "admin_users_block_authenticated_writes",
  "products_superadmin_delete",
  "products_admin_update",
  "drop policy if exists products_admin_manage",
]) {
  if (!rlsMigration.includes(token)) {
    throw new Error(`Role RLS migration must include ${token}.`);
  }
}
if (!rlsMigration.includes("operations and support are unused")) {
  throw new Error("Migration must document leftover enum labels.");
}

const bootstrap = read("docs/ADMIN_V1_AUTH_FOUNDATION.md");
if (!bootstrap.includes("superadmin") || !bootstrap.includes("SQL editor")) {
  throw new Error("Bootstrap procedure must be documented as owner SQL, not an HTTP endpoint.");
}
if (bootstrap.toLowerCase().includes("app/admin/bootstrap") || bootstrap.includes("make this email superadmin")) {
  throw new Error("Bootstrap must not be a public or browser-driven endpoint.");
}

console.log("verify-admin-foundation: ok");
