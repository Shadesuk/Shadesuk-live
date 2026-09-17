import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canArchiveCollection,
  canDeleteCollection,
  canManageCollections,
} from "../src/contracts/admin/roles";
import {
  ADMIN_COLLECTIONS_PAGE_SIZE,
  ADMIN_COLLECTION_STATUS_LABELS,
  adminCollectionListQueryString,
  adminCollectionSlugFromName,
  collectionStatusFromVisibility,
  collectionVisibilityFromStatus,
  isCollectionSlug,
  isReservedCollectionSlug,
  nextUniqueCollectionSlug,
  parseAdminCollectionListQuery,
  parseAdminCollectionSaveInput,
  statusesForVisibilityFilter,
} from "../src/contracts/admin/collections";
import {
  ADMIN_COLLECTION_NOT_FOUND_TITLE,
  ADMIN_COLLECTION_SAVE_FAILED_TITLE,
  ADMIN_COLLECTION_SAVED_JUST_NOW,
  ADMIN_COLLECTION_SAVING,
  ADMIN_COLLECTIONS_EMPTY_FILTER_TITLE,
  ADMIN_COLLECTIONS_EMPTY_TITLE,
  ADMIN_COLLECTION_UPLOAD_FAILED,
  ADMIN_PRODUCT_KEEP_EDITING,
  ADMIN_PRODUCT_LEAVE,
  ADMIN_PRODUCT_UNSAVED,
} from "../src/lib/admin-copy";
import { isUuid } from "../src/lib/ids";
import { adminCollectionPath, collectionPath, routes } from "../src/lib/navigation";
import { PRODUCT_IMAGES_BUCKET } from "../src/contracts/catalogue/image";
import { getCollectionBySlug, getCollectionProducts } from "../src/services/collections";
import { getBrands, getProducts } from "../src/services/catalogue";
import { ADMIN_IMAGE_MAX_BYTES, sniffImageType } from "../src/lib/admin-product-image";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (routes.adminCollections !== "/admin/collections" || routes.adminCollectionsNew !== "/admin/collections/new") {
  throw new Error("Admin Collections routes must stay /admin/collections and /admin/collections/new.");
}
if (adminCollectionPath("abc") !== "/admin/collections/abc") {
  throw new Error("Collection editor must stay /admin/collections/[id].");
}
if (collectionPath("summer") !== "/collections/summer") {
  throw new Error("Public collection URLs must stay /collections/[slug].");
}
if (ADMIN_COLLECTIONS_PAGE_SIZE !== 20 || ADMIN_COLLECTIONS_PAGE_SIZE < 1) {
  throw new Error("Collections list must paginate server-side with a bounded page size.");
}

if (!canManageCollections("admin") || !canManageCollections("superadmin") || canManageCollections(null)) {
  throw new Error("Admin and Superadmin must manage collections; unauthenticated must not.");
}
if (canArchiveCollection("admin") || canDeleteCollection("admin")) {
  throw new Error("Admin must not archive or delete collections.");
}
if (!canArchiveCollection("superadmin") || !canDeleteCollection("superadmin")) {
  throw new Error("Superadmin must be able to archive and delete collections.");
}

const parsed = parseAdminCollectionListQuery({
  q: "  aviator %_* ",
  visibility: "hidden",
  page: "2",
});
if (parsed.q.includes("%") || parsed.q.includes("*") || parsed.q.includes("_")) {
  throw new Error("Collection search must strip wildcard/injection characters.");
}
if (parsed.visibility !== "hidden" || parsed.page !== 2) {
  throw new Error("Collection list query parsing must accept known filters.");
}
if (parseAdminCollectionListQuery({ visibility: "nope", page: "-3" }).page !== 1) {
  throw new Error("Unknown filters must be ignored and invalid pages must fall back to 1.");
}
if (parseAdminCollectionListQuery({ q: ["alpha"], page: ["3"] }).page !== 3) {
  throw new Error("Array search params must use the first value.");
}

const queryString = adminCollectionListQueryString(parsed);
if (!queryString.includes("visibility=hidden") || !queryString.includes("page=2")) {
  throw new Error("List query string must round-trip filters and page.");
}
if (adminCollectionListQueryString({ q: "", visibility: "all", page: 1 }) !== "") {
  throw new Error("Default list query must not add empty params.");
}

if (!isCollectionSlug("aviator") || isCollectionSlug("Aviator") || isCollectionSlug("-frame-")) {
  throw new Error("Collection slugs must be lowercase URL-safe hyphenated tokens.");
}
if (adminCollectionSlugFromName("Aviator") !== "aviator") {
  throw new Error("Slug-from-name must follow the existing taxonomy slugifier.");
}
if (nextUniqueCollectionSlug("summer", new Set(["summer"])) !== "summer-2") {
  throw new Error("Slug collisions must suffix rather than reuse an existing slug.");
}
if (!isReservedCollectionSlug("aviator") || isReservedCollectionSlug("summer")) {
  throw new Error("Locked shape slugs must stay reserved for taxonomy collection routes.");
}
if (nextUniqueCollectionSlug("aviator", new Set()) !== "aviator-2") {
  throw new Error("Reserved storefront slugs must not be issued to Admin collections.");
}

if (collectionStatusFromVisibility("visible") !== "published" || collectionStatusFromVisibility("hidden") !== "draft") {
  throw new Error("Visible/Hidden must map to the existing catalogue_status values.");
}
if (
  collectionVisibilityFromStatus("published") !== "visible" ||
  collectionVisibilityFromStatus("draft") !== "hidden" ||
  collectionVisibilityFromStatus("archived") !== "archived"
) {
  throw new Error("Persisted status must map back to Admin visibility labels.");
}
if (ADMIN_COLLECTION_STATUS_LABELS.published !== "Visible" || ADMIN_COLLECTION_STATUS_LABELS.draft !== "Hidden") {
  throw new Error("Admin visibility labels must be Visible and Hidden.");
}
const hiddenStatuses = statusesForVisibilityFilter("hidden");
if (!hiddenStatuses || hiddenStatuses[0] !== "draft") {
  throw new Error("Hidden filter must use draft collections.");
}

function saveForm(entries: Record<string, string>, extras: Array<[string, string]> = []): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    form.set(key, value);
  }
  for (const [key, value] of extras) {
    form.append(key, value);
  }
  return form;
}

const created = parseAdminCollectionSaveInput(
  saveForm({
    name: "Summer",
    description: "Warm-weather frames.",
    visibility: "visible",
  }),
);
if (!created.ok || created.value.slug !== "summer" || created.value.visibility !== "visible") {
  throw new Error("Create collection must slugify the name and persist visibility.");
}

const reserved = parseAdminCollectionSaveInput(saveForm({ name: "Aviator", visibility: "visible" }));
if (reserved.ok || !reserved.errors.slug) {
  throw new Error("New collections must not take reserved shape slugs.");
}

const duplicateIds = parseAdminCollectionSaveInput(
  saveForm(
    { name: "Summer", visibility: "hidden" },
    [
      ["productId", "11111111-1111-4111-8111-111111111111"],
      ["productId", "11111111-1111-4111-8111-111111111111"],
    ],
  ),
);
if (!duplicateIds.ok || duplicateIds.value.productIds.length !== 1) {
  throw new Error("Duplicate product assignments must be collapsed.");
}

const invalidName = parseAdminCollectionSaveInput(saveForm({ name: "   ", visibility: "hidden" }));
if (invalidName.ok || !invalidName.errors.name) {
  throw new Error("Blank collection names must be rejected.");
}

const archiveIntent = parseAdminCollectionSaveInput(
  saveForm({ intent: "archive", id: "11111111-1111-4111-8111-111111111111" }),
);
if (!archiveIntent.ok || archiveIntent.intent !== "archive") {
  throw new Error("Archive must not require a full collection form.");
}

if (!isUuid("11111111-1111-4111-8111-111111111111") || isUuid("aviator")) {
  throw new Error("Collection detail must reject non-UUID ids as not found.");
}

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
if (sniffImageType(jpeg) !== "jpeg" || ADMIN_IMAGE_MAX_BYTES !== 8 * 1024 * 1024) {
  throw new Error("Collection images must reuse the product image pipeline bounds.");
}
if (PRODUCT_IMAGES_BUCKET !== "product-images") {
  throw new Error("Collection images must reuse the product-images bucket.");
}

if (
  ADMIN_COLLECTIONS_EMPTY_TITLE !== "No collections yet" ||
  ADMIN_COLLECTIONS_EMPTY_FILTER_TITLE !== "No collections found" ||
  ADMIN_COLLECTION_NOT_FOUND_TITLE !== "Collection not found" ||
  ADMIN_COLLECTION_SAVE_FAILED_TITLE !== "Couldn’t save changes" ||
  ADMIN_COLLECTION_UPLOAD_FAILED !== "Image upload failed" ||
  ADMIN_COLLECTION_SAVING !== "Saving" ||
  ADMIN_COLLECTION_SAVED_JUST_NOW !== "Saved just now"
) {
  throw new Error("Collections empty/error/save copy must stay operational and honest.");
}
if (
  ADMIN_PRODUCT_UNSAVED !== "You have changes that haven’t been saved." ||
  ADMIN_PRODUCT_KEEP_EDITING !== "Keep editing" ||
  ADMIN_PRODUCT_LEAVE !== "Leave without saving"
) {
  throw new Error("Collection unsaved-changes copy must reuse the Product Admin pattern.");
}

const snapshot = { products: getProducts(), brands: getBrands() };
const assigned = {
  id: "assigned-test",
  slug: "summer",
  href: "/collections/summer",
  title: "Summer",
  kind: "assigned" as const,
  productIds: [snapshot.products[0]?.id ?? "missing"],
};
const assignedMembers = getCollectionProducts(assigned, snapshot.products, snapshot.brands);
if (assignedMembers.length !== 1 || assignedMembers[0]?.id !== snapshot.products[0]?.id) {
  throw new Error("Assigned collections must resolve members from product_collections ids.");
}
const emptyAssigned = getCollectionProducts(
  { ...assigned, productIds: [] },
  snapshot.products,
  snapshot.brands,
);
if (emptyAssigned.length !== 0) {
  throw new Error("Empty assigned collections must not invent products.");
}
if (getCollectionBySlug("summer")) {
  throw new Error("Assigned slugs must not collide with locked shape collections.");
}

const service = read("src/services/admin-collections.ts");
if (!service.includes("server-only") || !service.includes("createSupabaseServerClient")) {
  throw new Error("Admin Collections queries must use the cookie-bound server client.");
}
if (service.includes("createSupabaseAdminClient") || service.includes("SUPABASE_SECRET_KEY")) {
  throw new Error("Admin Collections must not use the service-role client.");
}
if (!service.includes(".range(") || !service.includes("ADMIN_COLLECTIONS_PAGE_SIZE")) {
  throw new Error("Collection list must paginate on the server.");
}
if (!service.includes("canArchiveCollection") || !service.includes("canDeleteCollection")) {
  throw new Error("Archive and delete must use the collection role helpers.");
}
if (!service.includes("processAdminProductImage") || !service.includes("PRODUCT_IMAGES_BUCKET")) {
  throw new Error("Collection images must reuse the product image pipeline.");
}
if (!service.includes('from("product_collections")') || !service.includes(".delete().eq(\"collection_id\"")) {
  throw new Error("Product assignment must persist through product_collections without duplicating products.");
}
if (service.includes(".channel(") || service.includes("realtime")) {
  throw new Error("Admin Collections must not open realtime subscriptions.");
}
if (service.includes('from("products").delete()')) {
  throw new Error("Deleting a collection must never delete products.");
}

const actions = read("src/app/admin/collections/actions.ts");
if (!actions.includes("\"use server\"") || !actions.includes("getAdminGate")) {
  throw new Error("Collection mutations must be server actions behind getAdminGate().");
}
if (!actions.includes("cartActionOriginAllowed") || !actions.includes("hasForbiddenOwnershipKey")) {
  throw new Error("Collection mutations must keep origin and ownership-key guards.");
}
if (actions.includes("createSupabaseAdminClient") || actions.includes("error.message")) {
  throw new Error("Collection actions must not use service role or leak raw errors.");
}

const storefront = read("src/services/storefront-collections.ts");
if (!storefront.includes("createSupabasePublicClient") || !storefront.includes('eq("status", "published")')) {
  throw new Error("Public collections must be loaded with the publishable client and published status.");
}
if (storefront.includes("createSupabaseAdminClient") || storefront.includes("SUPABASE_SECRET_KEY")) {
  throw new Error("Storefront collections must not use the service-role client.");
}

const render = read("src/components/discovery/renderCollectionPage.tsx");
if (!render.includes("loadPublishedAssignedCollection") || !render.includes("getCollectionBySlug")) {
  throw new Error("Public collection routes must keep locked shape collections and add assigned collections.");
}

const rls = read("supabase/migrations/20260914230750_initial_production_schema.sql");
if (
  !rls.includes("enable row level security") ||
  !rls.includes("collections_public_read_published") ||
  !rls.includes("product_collections_public_read_published") ||
  !rls.includes("collections_admin_manage")
) {
  throw new Error("Existing collection RLS policies must remain intact.");
}

const listPage = read("src/app/admin/collections/page.tsx");
const newPage = read("src/app/admin/collections/new/page.tsx");
const detailPage = read("src/app/admin/collections/[id]/page.tsx");
if (
  listPage.includes("AdminPlaceholderPage") ||
  newPage.includes("AdminPlaceholderPage") ||
  detailPage.includes("AdminPlaceholderPage")
) {
  throw new Error("Collections Admin must be implemented, not a placeholder.");
}
if (!listPage.includes("getAdminGate") || !newPage.includes("getAdminGate") || !detailPage.includes("getAdminGate")) {
  throw new Error("Collections Admin routes must use the Admin gate.");
}

const files = [
  "src/app/admin/collections/page.tsx",
  "src/app/admin/collections/new/page.tsx",
  "src/app/admin/collections/[id]/page.tsx",
  "src/app/admin/collections/actions.ts",
  "src/components/admin/AdminCollectionsPage.tsx",
  "src/components/admin/AdminCollectionEditor.tsx",
  "src/components/admin/AdminCollectionProductPicker.tsx",
  "src/components/admin/AdminCollectionsTable.tsx",
  "src/services/admin-collections.ts",
  "src/services/storefront-collections.ts",
  "src/contracts/admin/collections.ts",
];
for (const file of files) {
  const source = read(file);
  if (source.includes("createSupabaseAdminClient") || source.includes("SUPABASE_SECRET_KEY")) {
    throw new Error(`${file} must not use the service-role client.`);
  }
  const stripped = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
    .join("\n");
  if (/(?::|\bas\s+)\s*any\b|<any>|Promise<any>/.test(stripped)) {
    throw new Error(`${file} must not use any.`);
  }
  if (
    source.includes("razorpay") ||
    source.includes("carrier API") ||
    source.includes("MetricCard") ||
    source.includes("coupon") ||
    source.includes("discount code")
  ) {
    throw new Error(`${file} must not add payments, shipping APIs, or promotion engines.`);
  }
}

const css = read("src/components/admin/AdminCollections.module.css");
if (!css.includes("min-width: 768px") || !css.includes("min-width: 1200px")) {
  throw new Error("Collections CSS must follow the locked tablet and desktop breakpoints.");
}
if (!css.includes("min-height: var(--touch-min)")) {
  throw new Error("Collection rows must keep the 44px touch minimum.");
}
if (!css.includes("prefers-reduced-motion")) {
  throw new Error("Collections CSS must respect reduced motion.");
}

const skeletons = read("src/components/admin/AdminCollectionsSkeletons.tsx");
if (!skeletons.includes("AdminCollectionsTableSkeleton") || !skeletons.includes("AdminCollectionEditorSkeleton")) {
  throw new Error("Collections must use section skeletons, not a page spinner.");
}

const editor = read("src/components/admin/AdminCollectionEditor.tsx");
if (!editor.includes("beforeunload") || !editor.includes("ADMIN_PRODUCT_KEEP_EDITING")) {
  throw new Error("Collection editor must protect unsaved changes.");
}
if (!editor.includes("ADMIN_COLLECTION_SAVING") || !editor.includes("ADMIN_COLLECTION_SAVED_JUST_NOW")) {
  throw new Error("Collection editor must expose the Admin save lifecycle.");
}

console.log("verify-admin-collections: ok");
