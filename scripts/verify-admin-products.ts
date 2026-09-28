import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { adminProductImageFiles } from "../src/lib/admin-product-image-files";
import {
  canArchiveProduct,
  canDeleteProduct,
  canPublishProduct,
  canUnpublishProduct,
} from "../src/contracts/admin/roles";
import {
  ADMIN_PRODUCTS_PAGE_SIZE,
  ADMIN_PRODUCT_SEARCH_MAX,
  adminProductListQueryString,
  adminProductSlugFromName,
  formatGbpMajorInput,
  groupVariantsByColour,
  isProductSlug,
  nextUniqueProductSlug,
  parseAdminFit,
  parseAdminProductListQuery,
  parseAdminProductSaveInput,
  parseGbpMajorInput,
  parseOptionalGbpMajorInput,
  sanitizeAdminProductSearch,
  suggestedVariantSku,
  variantCombinations,
} from "../src/contracts/admin/products";
import {
  ADMIN_IMAGE_MAX_BYTES,
  ADMIN_IMAGE_MIN_EDGE,
  ADMIN_IMAGE_OUTPUT_EDGE,
  sniffImageType,
} from "../src/lib/admin-product-image";
import {
  ADMIN_PRODUCTS_EMPTY_FILTER_TITLE,
  ADMIN_PRODUCTS_EMPTY_TITLE,
  ADMIN_PRODUCT_IMAGES_EMPTY_TITLE,
  ADMIN_PRODUCT_NOT_FOUND_TITLE,
  ADMIN_PRODUCT_SAVE_FAILED_TITLE,
  ADMIN_PRODUCT_UPLOAD_FAILED,
  ADMIN_PRODUCT_VARIANTS_EMPTY_TITLE,
} from "../src/lib/admin-copy";
import { isUuid } from "../src/lib/ids";
import { adminProductPath, routes } from "../src/lib/navigation";
import { PRODUCT_IMAGES_BUCKET } from "../src/contracts/catalogue/image";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (routes.adminProducts !== "/admin/products" || routes.adminProductsNew !== "/admin/products/new") {
  throw new Error("Admin Products routes must stay /admin/products and /admin/products/new.");
}
if (adminProductPath("abc") !== "/admin/products/abc") {
  throw new Error("Product editor must stay /admin/products/[id].");
}
if (ADMIN_PRODUCTS_PAGE_SIZE !== 20 || ADMIN_PRODUCTS_PAGE_SIZE < 1) {
  throw new Error("Products list must paginate server-side with a bounded page size.");
}

const parsed = parseAdminProductListQuery({
  q: "  frame-01 %_* ",
  status: "draft",
  availability: "in_stock",
  brand: "Line A",
  page: "2",
});
if (parsed.q.includes("%") || parsed.q.includes("*") || parsed.q.includes("_")) {
  throw new Error("Product search must strip wildcard/injection characters.");
}
if (parsed.status !== "draft" || parsed.availability !== "in_stock" || parsed.page !== 2) {
  throw new Error("Product list query parsing must accept known filters.");
}
if (parseAdminProductListQuery({ status: "nope", availability: "maybe", page: "-3" }).page !== 1) {
  throw new Error("Unknown filters must be ignored and invalid pages must fall back to 1.");
}
if (parseAdminProductListQuery({ q: ["alpha"], page: ["3"] }).page !== 3) {
  throw new Error("Array search params must use the first value.");
}

const queryString = adminProductListQueryString(parsed);
if (!queryString.includes("status=draft") || !queryString.includes("page=2")) {
  throw new Error("List query string must round-trip filters and page.");
}
if (
  adminProductListQueryString({ q: "", status: null, availability: "all", brand: "", page: 1 }) !== ""
) {
  throw new Error("Default list query must not add empty params.");
}

if (sanitizeAdminProductSearch("a".repeat(200)).length !== ADMIN_PRODUCT_SEARCH_MAX) {
  throw new Error("Search must be length-limited.");
}
if (sanitizeAdminProductSearch('sku","()\\%_*') !== "sku") {
  throw new Error("Search sanitiser must strip PostgREST control characters.");
}

if (!isProductSlug("frame-01") || isProductSlug("Frame 01") || isProductSlug("-frame-")) {
  throw new Error("Product slugs must be lowercase URL-safe hyphenated tokens.");
}
if (adminProductSlugFromName("Cartier CT0287") !== "cartier-ct0287") {
  throw new Error("Slug-from-name must follow the existing taxonomy slugifier.");
}
if (nextUniqueProductSlug("frame-01", new Set(["frame-01"])) !== "frame-01-2") {
  throw new Error("Slug collisions must suffix rather than reuse an existing slug.");
}
if (parseAdminFit("medium") !== "Medium" || parseAdminFit("unknown") !== "") {
  throw new Error("Fit must be optional Small/Medium/Large, never invented.");
}
if (groupVariantsByColour([{ colourName: "Black" }, { colourName: "Black" }, { colourName: "Tortoise" }]).length !== 2) {
  throw new Error("Colour grouping must keep sizes under their colour.");
}

const price = parseGbpMajorInput("99.99");
if (!price.ok || price.minor !== 9999) {
  throw new Error("GBP major input must convert to integer minor units.");
}
if (parseGbpMajorInput("-1").ok || parseGbpMajorInput("99.999").ok || parseGbpMajorInput("abc").ok) {
  throw new Error("Invalid or negative money must be rejected, not coerced.");
}
const blank = parseOptionalGbpMajorInput("");
if (!blank.ok || blank.minor !== null) {
  throw new Error("Blank compare-at price must be allowed.");
}
if (formatGbpMajorInput(9900) !== "99" || formatGbpMajorInput(9999) !== "99.99") {
  throw new Error("Money display helpers must not invent floating-point storage.");
}

if (suggestedVariantSku("frame-01", "Black", "M") !== "FRAME-01-BLACK-M") {
  throw new Error("Suggested SKUs must stay stable and derived from slug/colour/size.");
}
const combos = variantCombinations(["Black", "Brown", "black"], ["M", "L", "XL"]);
if (combos.length !== 6) {
  throw new Error("Variant generation must unique-combine colours and sizes.");
}
if (variantCombinations(["Black"], []).length !== 1 || variantCombinations(["Black"], [])[0]?.sizeName !== null) {
  throw new Error("Colour-only generation must not invent sizes.");
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

const draft = parseAdminProductSaveInput(
  saveForm({
    intent: "save",
    name: "Frame 01",
    slug: "frame-01",
    disclosure: "High-quality 1:1 Superclone",
    variantCount: "1",
    variant_0_colourName: "Black",
    variant_0_sizeName: "M",
    variant_0_sku: "FRAME-01-BLACK-M",
    variant_0_price: "79",
    variant_0_compareAt: "99",
    variant_0_stock: "4",
    variant_0_status: "available",
  }),
);
if (!draft.ok || draft.value.variants[0]?.priceMinor !== 7900 || draft.value.variants[0]?.compareAtMinor !== 9900) {
  throw new Error("Valid draft payload must parse selling and compare-at as minor units.");
}

const saleTooHigh = parseAdminProductSaveInput(
  saveForm({
    intent: "save",
    name: "Frame 01",
    slug: "frame-01",
    variantCount: "1",
    variant_0_colourName: "Black",
    variant_0_sku: "FRAME-01-BLACK-M",
    variant_0_price: "99",
    variant_0_compareAt: "79",
    variant_0_stock: "1",
    variant_0_status: "available",
  }),
);
if (saleTooHigh.ok || saleTooHigh.errors?.sale == null) {
  throw new Error("Sale price above regular/compare-at must show a validation error.");
}

const duplicateSku = parseAdminProductSaveInput(
  saveForm({
    intent: "save",
    name: "Frame 01",
    slug: "frame-01",
    variantCount: "2",
    variant_0_colourName: "Black",
    variant_0_sku: "FRAME-01-BLACK",
    variant_0_price: "79",
    variant_0_stock: "1",
    variant_0_status: "draft",
    variant_1_colourName: "Brown",
    variant_1_sku: "FRAME-01-BLACK",
    variant_1_price: "79",
    variant_1_stock: "1",
    variant_1_status: "draft",
  }),
);
if (duplicateSku.ok || duplicateSku.errors?.sku == null) {
  throw new Error("Duplicate SKUs in one product must be rejected.");
}

const duplicateCombo = parseAdminProductSaveInput(
  saveForm({
    intent: "save",
    name: "Frame 01",
    slug: "frame-01",
    variantCount: "2",
    variant_0_colourName: "Black",
    variant_0_sizeName: "M",
    variant_0_sku: "A",
    variant_0_price: "79",
    variant_0_stock: "1",
    variant_0_status: "draft",
    variant_1_colourName: "Black",
    variant_1_sizeName: "M",
    variant_1_sku: "B",
    variant_1_price: "79",
    variant_1_stock: "1",
    variant_1_status: "draft",
  }),
);
if (duplicateCombo.ok || duplicateCombo.errors?.variants == null) {
  throw new Error("Duplicate colour/size combinations must be rejected.");
}

const publishEmpty = parseAdminProductSaveInput(
  saveForm({
    intent: "publish",
    name: "Frame 01",
    slug: "frame-01",
    variantCount: "0",
  }),
);
if (publishEmpty.ok || publishEmpty.errors?.variants == null) {
  throw new Error("Publishing must require at least one complete available variant.");
}

const ignoredSlug = parseAdminProductSaveInput(saveForm({ intent: "save", name: "Cartier CT0287", slug: "manual-slug" }));
if (!ignoredSlug.ok || ignoredSlug.value.slug !== "cartier-ct0287") {
  throw new Error("Submitted slugs must be ignored; slugs are generated from the product name.");
}

const nameless = parseAdminProductSaveInput(saveForm({ intent: "save", name: "!!!" }));
if (nameless.ok || nameless.errors?.name == null) {
  throw new Error("Names that cannot generate a URL must be rejected.");
}

const noStatus = parseAdminProductSaveInput(
  saveForm({
    intent: "save",
    name: "Frame 01",
    variantCount: "1",
    variant_0_colourName: "Black",
    variant_0_sizeName: "52 mm",
    variant_0_sku: "FRAME-01-BLACK-52",
    variant_0_price: "49",
    variant_0_stock: "0",
  }),
);
if (!noStatus.ok || noStatus.value.variants[0]?.status !== "available") {
  throw new Error("Variant availability must be derived, not required from the merchant.");
}

const withMeasurements = parseAdminProductSaveInput(
  saveForm({
    intent: "save",
    name: "Frame 01",
    lensWidthMm: "52",
    bridgeWidthMm: "18",
    templeLengthMm: "145",
    variantCount: "1",
    variant_0_colourName: "Black",
    variant_0_sku: "FRAME-01-BLACK",
    variant_0_price: "49",
    variant_0_stock: "2",
  }),
);
if (
  !withMeasurements.ok ||
  withMeasurements.value.variants[0]?.lensWidthMm !== 52 ||
  withMeasurements.value.fit !== ""
) {
  throw new Error("Frame measurements must apply to variants and fit must stay optional.");
}

const archiveWithoutFields = parseAdminProductSaveInput(
  saveForm({ intent: "archive", productId: "11111111-1111-4111-8111-111111111111" }),
);
if (!archiveWithoutFields.ok || archiveWithoutFields.intent !== "archive") {
  throw new Error("Archive/delete must not require a full product form.");
}

if (canArchiveProduct("admin") || canDeleteProduct("admin")) {
  throw new Error("Admin must not archive or permanently delete.");
}
if (!canArchiveProduct("superadmin") || !canDeleteProduct("superadmin")) {
  throw new Error("Superadmin must be able to archive and delete.");
}
if (!canPublishProduct("admin") || !canUnpublishProduct("admin")) {
  throw new Error("Admin must keep publish/unpublish.");
}

if (!isUuid("11111111-1111-4111-8111-111111111111") || isUuid("frame-01")) {
  throw new Error("Product detail must reject non-UUID ids as not found.");
}

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const exe = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]);
if (sniffImageType(jpeg) !== "jpeg" || sniffImageType(png) !== "png" || sniffImageType(webp) !== "webp") {
  throw new Error("Image sniffing must recognise JPEG, PNG, and WebP magic bytes.");
}
if (sniffImageType(exe) !== null) {
  throw new Error("Image sniffing must reject non-image content.");
}
if (ADMIN_IMAGE_MAX_BYTES !== 8 * 1024 * 1024 || ADMIN_IMAGE_MIN_EDGE !== 200 || ADMIN_IMAGE_OUTPUT_EDGE !== 1600) {
  throw new Error("Image pipeline bounds must stay 8MB / 200px min / 1600px output.");
}
if (PRODUCT_IMAGES_BUCKET !== "product-images") {
  throw new Error("Product images must use the existing product-images bucket.");
}

if (
  ADMIN_PRODUCTS_EMPTY_TITLE !== "No products yet" ||
  ADMIN_PRODUCTS_EMPTY_FILTER_TITLE !== "No products found" ||
  ADMIN_PRODUCT_VARIANTS_EMPTY_TITLE !== "No sizes" ||
  ADMIN_PRODUCT_IMAGES_EMPTY_TITLE !== "No product images" ||
  ADMIN_PRODUCT_NOT_FOUND_TITLE !== "Product not found" ||
  ADMIN_PRODUCT_SAVE_FAILED_TITLE !== "Couldn’t save changes" ||
  ADMIN_PRODUCT_UPLOAD_FAILED !== "Image upload failed"
) {
  throw new Error("Products empty/error copy must stay operational and honest.");
}

const service = read("src/services/admin-products.ts");
if (!service.includes("server-only") || !service.includes("createSupabaseServerClient")) {
  throw new Error("Admin Products queries must use the cookie-bound server client.");
}
if (service.includes("createSupabaseAdminClient") || service.includes("SUPABASE_SECRET_KEY")) {
  throw new Error("Admin Products must not use the service-role client.");
}
if (!service.includes(".range(") || !service.includes("ADMIN_PRODUCTS_PAGE_SIZE")) {
  throw new Error("Product list must paginate on the server.");
}
if (!service.includes("canArchiveProduct") || !service.includes("canDeleteProduct")) {
  throw new Error("Archive and delete must use the PR #26 role helpers.");
}
if (!service.includes("allocateUniqueProductSlug") || !service.includes("published_at")) {
  throw new Error("Product save must generate unique slugs and keep published_at.");
}
if (/slug:\s*input\.payload\.slug/.test(service)) {
  throw new Error("Existing product slugs must not be overwritten from the form.");
}
if (service.includes(".channel(") || service.includes("realtime")) {
  throw new Error("Admin Products must not open realtime subscriptions.");
}
if (/\.from\("order_items"\)[\s\S]{0,160}\.(update|delete)\(/.test(service)) {
  throw new Error("Product edits must not rewrite or delete historical order items.");
}

const actions = read("src/app/admin/products/actions.ts");
if (!actions.includes("\"use server\"") || !actions.includes("getAdminGate")) {
  throw new Error("Product mutations must be server actions behind getAdminGate().");
}
if (!actions.includes("cartActionOriginAllowed") || !actions.includes("hasForbiddenOwnershipKey")) {
  throw new Error("Product mutations must keep origin and ownership-key guards.");
}
if (actions.includes("createSupabaseAdminClient") || actions.includes("error.message")) {
  throw new Error("Actions must not use the service-role client or leak database errors.");
}

const listPage = read("src/app/admin/products/page.tsx");
const newPage = read("src/app/admin/products/new/page.tsx");
const detailPage = read("src/app/admin/products/[id]/page.tsx");
if (
  listPage.includes("AdminPlaceholderPage") ||
  newPage.includes("AdminPlaceholderPage") ||
  detailPage.includes("AdminPlaceholderPage")
) {
  throw new Error("Products routes must not remain placeholders.");
}
if (!listPage.includes("getAdminGate") || !newPage.includes("getAdminGate") || !detailPage.includes("getAdminGate")) {
  throw new Error("Products pages must require getAdminGate().");
}

const editor = read("src/components/admin/AdminProductEditor.tsx");
if (!editor.includes("\"use client\"") || !editor.includes("useActionState")) {
  throw new Error("Product editor must be a client form posting to server actions.");
}
if (!editor.includes("canArchiveProduct") || !editor.includes("canDeleteProduct")) {
  throw new Error("Archive/delete controls must follow the role helpers.");
}
if (!editor.includes("ADMIN_PRODUCT_UNSAVED") || !editor.includes("beforeunload")) {
  throw new Error("Editor must warn before discarding unsaved changes.");
}
if (!editor.includes("ADMIN_PRODUCT_LEAVE") || !editor.includes("ADMIN_PRODUCT_KEEP_EDITING")) {
  throw new Error("Unsaved changes must offer leave or keep editing.");
}
if (!editor.includes("ADMIN_PRODUCT_COLOUR_ADD") || !editor.includes("ADMIN_PRODUCT_SIZE_ADD")) {
  throw new Error("Product editor must use a colour-first size workflow.");
}
if (!editor.includes("ADMIN_PRODUCT_SAVING") || !editor.includes("ADMIN_PRODUCT_SAVED_JUST_NOW")) {
  throw new Error("Save lifecycle must show saving and saved states.");
}
if (!editor.includes("ADMIN_PRODUCT_MEASUREMENTS") || !editor.includes("ADMIN_FIT_VALUES")) {
  throw new Error("Fit must expose optional classification and numerical measurements.");
}
if (editor.includes("name=\"slug\"") || editor.includes("ADMIN_PRODUCT_GENERATE") || editor.includes("variantCombinations")) {
  throw new Error("Slug must not be editable and the variant matrix generator must be removed.");
}
if (editor.includes("ADMIN_PRODUCT_VARIANT_STATUS") || editor.includes("VARIANT_STATUSES")) {
  throw new Error("Manual variant availability controls must not be shown.");
}
if (!editor.includes("ADMIN_PRODUCT_PLACEMENT")) {
  throw new Error("Product editor must show storefront placement.");
}

const images = read("src/components/admin/AdminProductImages.tsx");
if (!images.includes("ADMIN_PRODUCT_IMAGE_MOVE_UP") || !images.includes("ADMIN_PRODUCT_IMAGE_MOVE_DOWN")) {
  throw new Error("Image reorder must have an accessible alternative to drag-and-drop.");
}
if (images.includes("<form")) {
  throw new Error("Image upload/reorder must not nest forms inside the product editor.");
}
if (!images.includes("multiple") || !images.includes('data.append("image"')) {
  throw new Error("Gallery upload must accept multiple files on the existing control.");
}
if (images.includes("variants[0]") || images.includes("colourVariantId")) {
  throw new Error("Colour image upload must use the selected variant, not the first saved variant.");
}
if (!images.includes("ADMIN_PRODUCT_IMAGE_NONE")) {
  throw new Error("Image upload must allow a product-level association when no variant is selected.");
}

const imageActions = read("src/app/admin/products/actions.ts");
if (!imageActions.includes("adminProductImageFiles") || !imageActions.includes("uploadAdminProductImage")) {
  throw new Error("Each gallery file must go through uploadAdminProductImage.");
}
const imageFiles = read("src/lib/admin-product-image-files.ts");
if (!imageFiles.includes('getAll("image")')) {
  throw new Error("Image upload action must process every selected file.");
}
const batch = new FormData();
batch.append("image", new File([new Uint8Array([1])], "hero.webp", { type: "image/webp" }));
batch.append("image", new File([], "empty.webp", { type: "image/webp" }));
batch.append("image", new File([new Uint8Array([2])], "side.webp", { type: "image/webp" }));
const chosen = adminProductImageFiles(batch);
if (chosen.map((file) => file.name).join(",") !== "hero.webp,side.webp") {
  throw new Error("Multi-file upload must keep every non-empty file, in picker order.");
}

const imageService = read("src/services/admin-products.ts");
if (
  !imageService.includes("processAdminProductImage") ||
  !imageService.includes("PRODUCT_IMAGES_BUCKET") ||
  !imageService.includes("variant_id: input.variantId")
) {
  throw new Error("Upload must keep validate → WebP → product-images bucket → variant_id.");
}
if (!imageService.includes('!input.variantId && !hasProductPrimary ? "primary" : "secondary"')) {
  throw new Error("Product-level hero stays primary; extra and variant shots stay secondary.");
}
if (!imageService.includes("sort_order: rows.length")) {
  throw new Error("New images must append by sort_order.");
}

const imageLib = read("src/lib/admin-product-image.ts");
if (!imageLib.includes("webp") || !imageLib.includes("sniffImageType") || !imageLib.includes("resize")) {
  throw new Error("Image pipeline must validate, resize, and emit WebP.");
}

const live = read("src/services/live-catalogue.ts");
if (!live.includes('.eq("status", "published")')) {
  throw new Error("Public catalogue must still filter to published products.");
}

const migration = read("supabase/migrations/20260916154500_admin_product_images.sql");
if (!migration.includes("add column if not exists width") || !migration.includes("product-images")) {
  throw new Error("Image migration must add width/height and the product-images bucket.");
}
if (!migration.includes("private.is_admin()") || !migration.includes("product_images_storage_public_read")) {
  throw new Error("Storage RLS must allow public read and admin write only.");
}

const rls = read("supabase/migrations/20260916063709_admin_v1_role_rls.sql");
if (!rls.includes("products_admin_update") || !rls.includes("products_superadmin_delete")) {
  throw new Error("Existing product archive/delete RLS must remain the authorization boundary.");
}

const sources = [
  "src/app/admin/products/page.tsx",
  "src/app/admin/products/new/page.tsx",
  "src/app/admin/products/[id]/page.tsx",
  "src/app/admin/products/actions.ts",
  "src/components/admin/AdminProductsPage.tsx",
  "src/components/admin/AdminProductsTable.tsx",
  "src/components/admin/AdminProductEditor.tsx",
  "src/components/admin/AdminProductEditorPage.tsx",
  "src/components/admin/AdminProductImages.tsx",
  "src/services/admin-products.ts",
  "src/contracts/admin/products.ts",
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
    source.includes("coupon") ||
    source.includes("discount code")
  ) {
    throw new Error(`${file} must not add payments, shipping APIs, or promotion engines.`);
  }
}

const css = read("src/components/admin/AdminProducts.module.css");
if (!css.includes("min-width: 768px") || !css.includes("min-width: 1200px")) {
  throw new Error("Products CSS must follow the locked tablet and desktop breakpoints.");
}
if (!css.includes("min-height: var(--touch-min)")) {
  throw new Error("Product rows must keep the 44px touch minimum.");
}
if (!css.includes("prefers-reduced-motion")) {
  throw new Error("Products CSS must respect reduced motion.");
}

const skeletons = read("src/components/admin/AdminProductsSkeletons.tsx");
if (!skeletons.includes("AdminProductsTableSkeleton") || !skeletons.includes("AdminProductEditorSkeleton")) {
  throw new Error("Products must use section skeletons, not a page spinner.");
}

console.log("verify-admin-products: ok");
