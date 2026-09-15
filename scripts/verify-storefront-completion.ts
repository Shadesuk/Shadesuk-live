import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ANALYTICS_EVENTS, sanitizeAnalyticsPayload } from "../src/lib/analytics";
import { FAQ_GROUPS } from "../src/lib/legal-copy";
import { routes } from "../src/lib/navigation";
import {
  INDEX_FOLLOW,
  NOINDEX_NOFOLLOW,
  hasCatalogueQueryParams,
  storefrontMetadata,
} from "../src/lib/seo";
import { safeHttpUrl } from "../src/lib/tracking-url";

const root = resolve(process.cwd());

const layout = readFileSync(resolve(root, "src/app/layout.tsx"), "utf8");
if (!layout.includes("NOINDEX_NOFOLLOW")) {
  throw new Error("Root layout must fail closed to noindex.");
}

const home = readFileSync(resolve(root, "src/app/page.tsx"), "utf8");
if (!home.includes("INDEX_FOLLOW") && !home.includes("index: true")) {
  throw new Error("Homepage must opt in to indexation.");
}

const search = readFileSync(resolve(root, "src/app/(catalogue)/search/page.tsx"), "utf8");
if (!search.includes("privatePathMetadata")) {
  throw new Error("Search must stay noindex via privatePathMetadata.");
}

const robots = readFileSync(resolve(root, "src/app/robots.ts"), "utf8");
if (!robots.includes("ROBOTS_DISALLOW")) {
  throw new Error("robots.txt must use ROBOTS_DISALLOW.");
}
const seoSource = readFileSync(resolve(root, "src/lib/seo.ts"), "utf8");
for (const path of ["/search", "/account", "/checkout", "/cart", "/track-order", "/api/", "/auth/"]) {
  if (!seoSource.includes(`"${path}"`)) {
    throw new Error(`SEO robots disallow list must include ${path}.`);
  }
}

const sitemap = readFileSync(resolve(root, "src/app/sitemap.ts"), "utf8");
for (const token of [
  "INFO_PAGES",
  "routes.shop",
  "routes.men",
  "routes.women",
  "routes.unisex",
  "routes.newArrivals",
  "routes.bestSellers",
  "routes.collections",
  "routes.brands",
  "productPath",
  "brandPath",
]) {
  if (!sitemap.includes(token)) {
    throw new Error(`sitemap must include ${token}.`);
  }
}
if (sitemap.includes("routes.search") || sitemap.includes("routes.cart")) {
  throw new Error("sitemap must not list search or cart.");
}

const shop = readFileSync(resolve(root, "src/app/(catalogue)/shop/page.tsx"), "utf8");
if (!shop.includes("cataloguePathMetadata")) {
  throw new Error("Shop PLP must canonicalise filtered URLs.");
}

const product = readFileSync(resolve(root, "src/app/product/[slug]/page.tsx"), "utf8");
if (!product.includes("productJsonLd") || !product.includes("JsonLd")) {
  throw new Error("PDP must emit Product JSON-LD.");
}

if (!INDEX_FOLLOW.index || NOINDEX_NOFOLLOW.index) {
  throw new Error("Indexation constants are inverted.");
}

const filtered = hasCatalogueQueryParams({ gender: "men" });
const clean = hasCatalogueQueryParams({});
if (!filtered || clean) {
  throw new Error("Filter query params must be treated as thin URLs.");
}

const meta = storefrontMetadata({
  title: "All shades",
  description: "The full SHADESUK catalogue.",
  path: routes.shop,
});
if (meta.alternates?.canonical == null) {
  throw new Error("Storefront metadata must set a canonical.");
}

const paymentFaq = FAQ_GROUPS.flatMap((group) => group.items).find(
  (item) => item.question === "How do I pay?",
);
if (!paymentFaq?.paragraphs.some((paragraph) => paragraph.includes("not live"))) {
  throw new Error("FAQ payment copy must stay future-tense until payment is wired.");
}

if (ANALYTICS_EVENTS.includes("page_view") === false || ANALYTICS_EVENTS.includes("purchase") === false) {
  throw new Error("Analytics contract must include page_view and purchase.");
}

const analyticsSource = readFileSync(resolve(root, "src/lib/analytics.ts"), "utf8");
if (/G-[A-Z0-9]+|GTM-|AW-|UA-/.test(analyticsSource)) {
  throw new Error("Do not invent GA / GTM ids.");
}

const dirty = sanitizeAnalyticsPayload({
  email: "hidden@example.com",
  item_id: "p1",
  password: "secret",
});
if (!dirty || dirty.email || dirty.password || dirty.item_id !== "p1") {
  throw new Error("Analytics payload sanitizer must drop PII and keep item_id.");
}

if (safeHttpUrl("http://carrier.example/t") !== null) {
  throw new Error("Tracking URLs must be https-only.");
}

const security = readFileSync(
  resolve(root, "docs/STOREFRONT_SECURITY_CLASSIFICATION.md"),
  "utf8",
);
if (!security.includes("BLOCKING") || !security.includes("DEFERRED")) {
  throw new Error("Security classification must use BLOCKING / NON-BLOCKING / DEFERRED.");
}

const suggestRoute = readFileSync(
  resolve(root, "src/app/api/search/suggest/route.ts"),
  "utf8",
);
if (!suggestRoute.includes("searchSuggestAttemptAllowed")) {
  throw new Error("Search suggest must be rate-limited.");
}

const liveCatalogue = readFileSync(
  resolve(root, "src/services/live-catalogue.ts"),
  "utf8",
);
if (!liveCatalogue.includes("SNAPSHOT_TTL_MS") || !liveCatalogue.includes("snapshotCache")) {
  throw new Error("Published catalogue snapshot must be TTL-cached for suggest/PLP.");
}

const collectionsSource = readFileSync(
  resolve(root, "src/services/collections.ts"),
  "utf8",
);
if (
  collectionsSource.includes("products: Product[] = getProducts()") ||
  collectionsSource.includes("scoped ?? getCollectionProducts(collection)")
) {
  throw new Error("Collection membership must not default to the demo catalogue.");
}

const demoMode = readFileSync(resolve(root, "src/lib/demo-catalogue-mode.ts"), "utf8");
if (!demoMode.includes("isProductionCatalogueLock")) {
  throw new Error("DEMO_CATALOGUE must be ignored on the production origin.");
}

const catalogueService = readFileSync(resolve(root, "src/services/catalogue.ts"), "utf8");
const catalogueData = readFileSync(resolve(root, "src/data/catalogue.ts"), "utf8");
if (!catalogueService.includes('import "server-only"') || !catalogueData.includes('import "server-only"')) {
  throw new Error("Demo catalogue modules must be marked server-only.");
}

const homepage = readFileSync(resolve(root, "src/components/home/Homepage.tsx"), "utf8");
if (!homepage.includes("HomepageCatalogueError") || !homepage.includes("catalogueUnavailable")) {
  throw new Error("Homepage must distinguish live catalogue errors from empty rails.");
}

if (!security.includes("GET /api/search/suggest") && !security.includes("Rate-limit `GET /api/search/suggest`")) {
  throw new Error("Security classification must record the suggest rate-limit.");
}

const notes = readFileSync(
  resolve(root, "docs/STOREFRONT_PHASE_COMPLETION_NOTES.md"),
  "utf8",
);
if (!notes.includes("SEO") || !notes.includes("DEFERRED")) {
  throw new Error("Completion notes must record SEO evidence and deferred work.");
}

console.log("verify-storefront-completion: ok");
