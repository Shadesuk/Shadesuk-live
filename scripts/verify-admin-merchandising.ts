import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canAccessMerchandising,
  canAccessSettings,
} from "../src/contracts/admin/roles";
import {
  isNewArrivalFromPublishedAt,
  merchandisingFlagsFromState,
  newArrivalDaysRemaining,
  NEW_ARRIVAL_WINDOW_MS,
} from "../src/contracts/catalogue/merchandising";
import {
  parseAdminMerchandisingSaveInput,
  parseMerchandisingSearch,
} from "../src/contracts/admin/merchandising";
import { adminNavForRole } from "../src/lib/admin-nav";
import {
  ADMIN_MERCHANDISING_BEST_SELLERS_EMPTY,
  ADMIN_MERCHANDISING_FEATURED_EMPTY,
  ADMIN_MERCHANDISING_FLAGSHIP_EMPTY,
  ADMIN_MERCHANDISING_FORBIDDEN,
  ADMIN_MERCHANDISING_NEW_ARRIVALS_EMPTY,
  ADMIN_MERCHANDISING_SEARCH_EMPTY,
} from "../src/lib/admin-copy";
import { routes } from "../src/lib/navigation";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (routes.adminMerchandising !== "/admin/merchandising") {
  throw new Error("Merchandising must live at /admin/merchandising.");
}
if (canAccessMerchandising("admin") || canAccessSettings("admin")) {
  throw new Error("Admin must not access Merchandising or Settings.");
}
if (!canAccessMerchandising("superadmin") || !canAccessSettings("superadmin")) {
  throw new Error("Superadmin must access Merchandising and Settings.");
}
if (adminNavForRole("admin").merchandising !== null) {
  throw new Error("Merchandising must be hidden from Admin navigation.");
}
if (!adminNavForRole("superadmin").merchandising) {
  throw new Error("Merchandising must appear in Superadmin navigation.");
}

const now = Date.parse("2026-09-16T12:00:00.000Z");
const fresh = "2026-09-14T12:00:00.000Z";
const stale = "2026-09-01T12:00:00.000Z";
if (!isNewArrivalFromPublishedAt(fresh, now) || isNewArrivalFromPublishedAt(stale, now)) {
  throw new Error("New Arrivals must use a 7-day published_at window.");
}
if (newArrivalDaysRemaining(fresh, now) !== 5) {
  throw new Error("New Arrival remaining days must be derived from published_at.");
}
if (NEW_ARRIVAL_WINDOW_MS !== 7 * 24 * 60 * 60 * 1000) {
  throw new Error("New Arrival window must stay 7 days.");
}

const flags = merchandisingFlagsFromState({
  productId: "aaa",
  publishedAt: fresh,
  bestSellerIds: new Set(["bbb"]),
  nowMs: now,
});
if (!flags.isNewArrival || flags.isBestSeller) {
  throw new Error("Best seller membership must not be inferred from publication time.");
}

const parsed = parseAdminMerchandisingSaveInput(
  (() => {
    const form = new FormData();
    form.set("featuredEnabled", "on");
    form.append("featuredId", "11111111-1111-4111-8111-111111111111");
    form.append("featuredId", "11111111-1111-4111-8111-111111111111");
    form.append("bestSellerId", "22222222-2222-4222-8222-222222222222");
    form.set("flagshipId", "33333333-3333-4333-8333-333333333333");
    return form;
  })(),
);
if (
  !parsed.ok ||
  parsed.value.featuredIds.length !== 1 ||
  parsed.value.bestSellerIds.length !== 1 ||
  parsed.value.flagshipId !== "33333333-3333-4333-8333-333333333333"
) {
  throw new Error("Merchandising save must keep ordered unique product ids and a single flagship.");
}

const duplicateFlagship = parseAdminMerchandisingSaveInput(
  (() => {
    const form = new FormData();
    form.set("flagshipId", "not-a-uuid");
    return form;
  })(),
);
if (duplicateFlagship.ok) {
  throw new Error("Invalid flagship ids must be rejected.");
}
if (parseMerchandisingSearch('sku","()\\%_*') !== "sku") {
  throw new Error("Merchandising product search must reuse the sanitiser.");
}

if (
  ADMIN_MERCHANDISING_FORBIDDEN !== "Merchandising is reserved for Superadmin." ||
  ADMIN_MERCHANDISING_FEATURED_EMPTY !== "No featured products selected." ||
  ADMIN_MERCHANDISING_BEST_SELLERS_EMPTY !== "No best sellers selected." ||
  ADMIN_MERCHANDISING_FLAGSHIP_EMPTY !== "No flagship product selected." ||
  ADMIN_MERCHANDISING_NEW_ARRIVALS_EMPTY !== "No new arrivals in the last 7 days." ||
  ADMIN_MERCHANDISING_SEARCH_EMPTY !== "No matching products."
) {
  throw new Error("Merchandising empty/forbidden copy must stay operational.");
}

const page = read("src/app/admin/merchandising/page.tsx");
if (!page.includes("getAdminGate") || !page.includes("canAccessMerchandising") || !page.includes("ADMIN_MERCHANDISING_FORBIDDEN")) {
  throw new Error("Merchandising must deny Admin server-side with the Settings-class forbidden treatment.");
}
if (page.includes("createSupabaseAdminClient")) {
  throw new Error("Merchandising must not use the service-role client.");
}

const actions = read("src/app/admin/merchandising/actions.ts");
if (!actions.includes("\"use server\"") || !actions.includes("getAdminGate") || !actions.includes("canAccessMerchandising")) {
  throw new Error("Merchandising mutations must be server actions behind Superadmin.");
}
if (!actions.includes("cartActionOriginAllowed") || !actions.includes("hasForbiddenOwnershipKey")) {
  throw new Error("Merchandising mutations must keep origin and ownership-key guards.");
}

const service = read("src/services/admin-merchandising.ts");
if (!service.includes("server-only") || !service.includes("createSupabaseServerClient")) {
  throw new Error("Merchandising queries must use the cookie-bound server client.");
}
if (service.includes("createSupabaseAdminClient") || service.includes("SUPABASE_SECRET_KEY")) {
  throw new Error("Merchandising must not use the service-role client.");
}
if (!service.includes("status\", \"published\"") && !service.includes('.eq("status", "published")')) {
  throw new Error("Only published products may be merchandised.");
}

const editor = read("src/components/admin/AdminMerchandisingEditor.tsx");
if (!editor.includes("ADMIN_MERCHANDISING_MOVE_UP") || editor.includes("onDrag")) {
  throw new Error("Merchandising reorder must be keyboard accessible, not drag-only.");
}
if (!editor.includes("AdminProductSelector")) {
  throw new Error("Featured, Best Sellers, and Flagship must use the product selector.");
}

const selector = read("src/components/admin/AdminProductSelector.tsx");
if (!selector.includes("searchMerchandisingProductsAction")) {
  throw new Error("Product selector must search on the server.");
}

const home = read("src/app/(storefront)/page.tsx");
if (!home.includes("loadStorefrontMerchandisingConfig") || !home.includes("getAutomaticNewArrivals")) {
  throw new Error("Homepage must consume production merchandising state.");
}
if (!home.includes("getFlagshipProduct")) {
  throw new Error("Homepage flagship must come from Superadmin selection.");
}

const live = read("src/services/live-catalogue.ts");
if (!live.includes("bestSellerIds") || !live.includes("published_at")) {
  throw new Error("Live catalogue must map published_at and Superadmin best sellers.");
}

const mapper = read("src/contracts/catalogue/map-product.ts");
if (mapper.includes("merchandisingFromCollectionSlugs(")) {
  throw new Error("Storefront merchandising flags must not come from collection slugs.");
}
if (!mapper.includes("product.status !== \"published\"")) {
  throw new Error("Draft products must still be excluded from the storefront mapper.");
}

const rail = read("src/components/home/ProductRail.tsx");
if (!rail.includes("scroll-snap") && !read("src/components/home/ProductRail.module.css").includes("scroll-snap-type")) {
  throw new Error("Featured must be a customer-controlled rail, not an auto carousel.");
}
if (rail.toLowerCase().includes("autoplay") || rail.toLowerCase().includes("setinterval")) {
  throw new Error("Featured must not auto-rotate.");
}

const story = read("src/components/home/ProductStory.tsx");
if (!story.includes("getPrimaryImage") || !story.includes("View product")) {
  throw new Error("Flagship must use catalogue imagery and link to the PDP.");
}

const migration = read("supabase/migrations/20260916193000_homepage_merchandising.sql");
for (const token of [
  "published_at",
  "homepage_merchandising",
  "homepage_featured_products",
  "homepage_best_seller_products",
  "private.is_superadmin()",
  "merchandising products must be published",
  "enable row level security",
]) {
  if (!migration.includes(token)) {
    throw new Error(`Merchandising migration must include ${token}.`);
  }
}
if (migration.includes("to anon, authenticated") && migration.includes("for all")) {
  throw new Error("Merchandising must not add a broad authenticated write policy.");
}

const css = read("src/components/admin/AdminMerchandising.module.css");
if (!css.includes("min-width: 768px") || !css.includes("min-width: 1200px") || !css.includes("min-height: var(--touch-min)")) {
  throw new Error("Merchandising CSS must follow Admin breakpoints and 44px targets.");
}
if (!css.includes("prefers-reduced-motion")) {
  throw new Error("Merchandising CSS must respect reduced motion.");
}

console.log("verify-admin-merchandising: ok");
