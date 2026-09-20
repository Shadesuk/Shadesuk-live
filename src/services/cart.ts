import "server-only";

import { revalidatePath } from "next/cache";
import type { CartRevalidationIssue } from "@/contracts";
import { majorToMinorGbp, minorToMajorGbp } from "@/contracts";
import {
  ADD_TO_BAG_QUANTITY_MAX,
  evaluateAddToBag,
  resolveCartVariantId,
  resolveSelectedVariant,
} from "@/lib/add-to-bag";
import { cartIssueMessage } from "@/lib/cart-copy";
import { getOptionalAccountUser } from "@/lib/account-session";
import {
  readDemoCartLines,
  writeDemoCartLines,
} from "@/lib/demo-cart-cookie-store";
import type { DemoCartLine } from "@/lib/demo-cart-cookie";
import { bindGuestCartSession, readGuestCartSessionId } from "@/lib/guest-cart-cookie";
import { isDemoVariantId, isUuid } from "@/lib/ids";
import { containsForbiddenCartOwnership } from "@/lib/ownership-keys";
import { getCartSuggestions as suggestCartProducts } from "@/lib/cart-suggestions";
import { productPath } from "@/lib/navigation";
import { getPrimaryImage, isProductAvailable } from "@/lib/product-display";
import { isDemoCatalogueEnabled } from "@/lib/demo-catalogue-mode";
import { getProductBySlug } from "@/services/catalogue";
import {
  fetchLiveVariantForCart,
  getOrCreateLiveAccountCart,
  getOrCreateLiveGuestCart,
  listLiveCartItems,
  liveCartWritesAvailable,
  loadLiveAccountCart,
  loadLiveGuestCart,
  mergeLiveGuestCartIntoAccount,
  removeLiveCartItem,
  updateLiveCartItemQuantity,
  upsertLiveCartItem,
} from "@/services/cart-live";
import { getStorefrontProductBySlug } from "@/services/product";
import type { PublicCart, PublicCartItem } from "@/types/cart";
import type { AddToBagInput, AddToBagResult } from "@/types/pdp";
import type { Product } from "@/types/catalogue";
import { variantAvailability } from "@/contracts/catalogue/availability";

const emptyCart = (): PublicCart => ({
  items: [],
  itemCount: 0,
  subtotal: 0,
  currency: "GBP",
  issues: [],
});

export async function getPublicCart(): Promise<PublicCart> {
  const ctx = await resolveCartContext();
  if (ctx.userId && ctx.sessionId) {
    await mergeGuestCartOnSignIn(ctx.userId);
  }
  if (!ctx.userId && !ctx.sessionId) {
    return emptyCart();
  }
  return assemblePublicCart(ctx);
}

export async function mergeGuestCartOnSignIn(userId: string): Promise<void> {
  const sessionId = await readGuestCartSessionId();
  if (!sessionId) {
    return;
  }
  await mergeLiveGuestCartIntoAccount({ sessionId, userId });
  const demo = await readDemoCartLines(sessionId);
  if (!demo.length) {
    return;
  }
  const kept: DemoCartLine[] = [];
  for (const line of demo) {
    if (!isUuid(line.variantId)) {
      kept.push(line);
      continue;
    }
    const live = await tryAddLiveLine({
      sessionId,
      userId,
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
    });
    if (live !== "written") {
      kept.push(line);
    }
  }
  if (kept.length !== demo.length) {
    await writeDemoCartLines(sessionId, kept);
  }
}

export async function addItemToGuestCart(input: AddToBagInput): Promise<AddToBagResult> {
  const record = await getStorefrontProductBySlug(input.slug);
  const evaluation = evaluateAddToBag(record?.product, input);
  if (evaluation.status !== "ready" || !record) {
    return evaluation;
  }

  const product = record.product;
  const variant = resolveSelectedVariant(product, input);
  const colourId = variant?.colourId ?? input.colourId;
  const colour = colourId
    ? product.colours.find((item) => item.id === colourId)
    : undefined;
  if (!colour) {
    return { status: "error" };
  }

  const variantId = resolveCartVariantId(product, input);
  if (!variantId) {
    return { status: "error" };
  }

  const ctx = await resolveCartContext();
  const sessionId = ctx.userId ? ctx.sessionId ?? (await bindGuestCartSession()) : await bindGuestCartSession();
  const quantity = Math.floor(input.quantity);
  const unitPriceMinor = resolveUnitPriceMinor(product, variantId);
  const size = variant?.size ?? input.size;

  const live = await tryAddLiveLine({
    sessionId,
    userId: ctx.userId,
    productId: product.id,
    variantId,
    quantity,
    unitPriceMinor,
  });
  if (live === "error") {
    return { status: "error" };
  }
  if (live === "unavailable") {
    return { status: "unavailable", availability: "out_of_stock" };
  }
  if (live === "miss") {
    await addDemoLine({
      sessionId,
      product,
      colourId: colour.id,
      size,
      variantId,
      quantity,
      unitPriceMinor,
    });
  }

  const cart = await assemblePublicCart(await resolveCartContext());
  revalidateCartPaths();
  return { status: "added", cart };
}

export async function updateGuestCartQuantity(
  itemId: string,
  quantity: number,
): Promise<PublicCart | null> {
  const ctx = await resolveCartContext();
  if ((!ctx.userId && !ctx.sessionId) || !itemId.trim()) {
    return null;
  }
  const nextQty = Math.floor(quantity);
  if (!Number.isInteger(nextQty) || nextQty < 0) {
    return null;
  }
  if (nextQty === 0) {
    return removeGuestCartItem(itemId);
  }
  if (nextQty > ADD_TO_BAG_QUANTITY_MAX) {
    return null;
  }

  const liveCart = ctx.userId
    ? await loadLiveAccountCart(ctx.userId)
    : ctx.sessionId
      ? await loadLiveGuestCart(ctx.sessionId)
      : null;
  const liveItem = liveCart?.items.find((item) => item.id === itemId);
  if (liveItem && liveCart) {
    const liveVariant = await fetchLiveVariantForCart(liveItem.product_variant_id);
    const stock = liveVariant?.variant.stock_quantity ?? 0;
    const capped = Math.min(nextQty, ADD_TO_BAG_QUANTITY_MAX, Math.max(stock, 0) || nextQty);
    if (stock <= 0) {
      await removeLiveCartItem({ cartId: liveCart.cart.id, itemId });
    } else {
      await updateLiveCartItemQuantity({
        cartId: liveCart.cart.id,
        itemId,
        quantity: Math.min(capped, stock),
      });
    }
    revalidateCartPaths();
    return assemblePublicCart(ctx);
  }

  if (!ctx.sessionId) {
    return assemblePublicCart(ctx);
  }

  const demo = await readDemoCartLines(ctx.sessionId);
  const index = demo.findIndex((item) => item.id === itemId);
  if (index === -1) {
    return assemblePublicCart(ctx);
  }
  const current = demo[index];
  if (!current) {
    return assemblePublicCart(ctx);
  }
  demo[index] = { ...current, quantity: Math.min(nextQty, ADD_TO_BAG_QUANTITY_MAX) };
  await writeDemoCartLines(ctx.sessionId, demo);
  revalidateCartPaths();
  return assemblePublicCart(ctx);
}

export async function removeGuestCartItem(itemId: string): Promise<PublicCart | null> {
  const ctx = await resolveCartContext();
  if ((!ctx.userId && !ctx.sessionId) || !itemId.trim()) {
    return null;
  }

  const liveCart = ctx.userId
    ? await loadLiveAccountCart(ctx.userId)
    : ctx.sessionId
      ? await loadLiveGuestCart(ctx.sessionId)
      : null;
  if (liveCart?.items.some((item) => item.id === itemId)) {
    await removeLiveCartItem({ cartId: liveCart.cart.id, itemId });
  }

  if (ctx.sessionId) {
    const demo = await readDemoCartLines(ctx.sessionId);
    const next = demo.filter((item) => item.id !== itemId);
    if (next.length !== demo.length) {
      await writeDemoCartLines(ctx.sessionId, next);
    }
  }

  revalidateCartPaths();
  return assemblePublicCart(ctx);
}

export function getCartSuggestions(cart: PublicCart, products: Product[] = []) {
  return suggestCartProducts(cart, products);
}

type CartContext = {
  userId?: string;
  sessionId?: string | null;
};

async function resolveCartContext(): Promise<CartContext> {
  const user = await getOptionalAccountUser();
  const sessionId = await readGuestCartSessionId();
  return {
    userId: user?.id,
    sessionId,
  };
}

async function assemblePublicCart(ctx: CartContext): Promise<PublicCart> {
  const issues: PublicCart["issues"] = [];
  const items: PublicCartItem[] = [];

  const liveCart = ctx.userId
    ? await loadLiveAccountCart(ctx.userId)
    : ctx.sessionId
      ? await loadLiveGuestCart(ctx.sessionId)
      : null;
  if (liveCart) {
    const dropped: string[] = [];
    for (const row of liveCart.items) {
      const hydrated = await hydrateLiveLine(row, liveCart.cart.id);
      if (hydrated.drop) {
        dropped.push(row.id);
        issues.push({
          issue: hydrated.issue ?? "product_removed",
          message: cartIssueMessage(hydrated.issue ?? "product_removed"),
          itemId: row.id,
        });
        continue;
      }
      if (hydrated.item) {
        items.push(hydrated.item);
        if (hydrated.issue) {
          issues.push({
            issue: hydrated.issue,
            message: cartIssueMessage(hydrated.issue),
            itemId: row.id,
          });
        }
      }
    }
    for (const itemId of dropped) {
      await removeLiveCartItem({ cartId: liveCart.cart.id, itemId });
    }
  }

  const demo = ctx.sessionId ? await readDemoCartLines(ctx.sessionId) : [];
  const keptDemo: DemoCartLine[] = [];
  let demoDirty = false;
  for (const line of demo) {
    const hydrated = await hydrateDemoLine(line);
    if (hydrated.drop) {
      demoDirty = true;
      issues.push({
        issue: hydrated.issue ?? "product_removed",
        message: cartIssueMessage(hydrated.issue ?? "product_removed"),
        itemId: line.id,
      });
      continue;
    }
    if (hydrated.line && hydrated.line.quantity !== line.quantity) {
      demoDirty = true;
    }
    if (hydrated.line) {
      keptDemo.push(hydrated.line);
    }
    if (hydrated.item) {
      items.push(hydrated.item);
      if (hydrated.issue) {
        issues.push({
          issue: hydrated.issue,
          message: cartIssueMessage(hydrated.issue),
          itemId: line.id,
        });
      }
    }
  }
  if (demoDirty && ctx.sessionId) {
    await writeDemoCartLines(ctx.sessionId, keptDemo);
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const cart: PublicCart = {
    items,
    itemCount,
    subtotal,
    currency: "GBP",
    issues,
  };
  if (containsForbiddenCartOwnership(cart)) {
    return emptyCart();
  }
  return cart;
}

async function tryAddLiveLine(input: {
  sessionId: string;
  userId?: string;
  productId: string;
  variantId: string;
  quantity: number;
  unitPriceMinor: number;
}): Promise<"written" | "miss" | "error" | "unavailable"> {
  if (!isUuid(input.variantId) || !liveCartWritesAvailable()) {
    return "miss";
  }
  const live = await fetchLiveVariantForCart(input.variantId);
  if (!live) {
    return "miss";
  }
  if (live.productId !== input.productId) {
    return "error";
  }
  if (variantAvailability(live.variant) !== "in_stock") {
    return "unavailable";
  }
  const cart = input.userId
    ? await getOrCreateLiveAccountCart(input.userId)
    : await getOrCreateLiveGuestCart(input.sessionId);
  if (!cart) {
    return "error";
  }
  const existing = (await listLiveCartItems(cart.id)).find(
    (item) => item.product_variant_id === input.variantId,
  );
  const nextQty = Math.min(
    ADD_TO_BAG_QUANTITY_MAX,
    live.variant.stock_quantity,
    (existing?.quantity ?? 0) + input.quantity,
  );
  if (nextQty < 1) {
    return "unavailable";
  }
  const written = await upsertLiveCartItem({
    cartId: cart.id,
    variantId: input.variantId,
    quantity: nextQty,
    unitPriceMinor: live.variant.price_minor,
  });
  return written ? "written" : "error";
}

async function addDemoLine(input: {
  sessionId: string;
  product: Product;
  colourId: string;
  size?: string;
  variantId: string;
  quantity: number;
  unitPriceMinor: number;
}): Promise<void> {
  const items = await readDemoCartLines(input.sessionId);
  const existing = items.find((item) => item.variantId === input.variantId);
  if (existing) {
    existing.quantity = Math.min(
      ADD_TO_BAG_QUANTITY_MAX,
      existing.quantity + input.quantity,
    );
    await writeDemoCartLines(input.sessionId, items);
    return;
  }
  items.push({
    id: crypto.randomUUID(),
    variantId: input.variantId,
    productId: input.product.id,
    slug: input.product.slug,
    colourId: input.colourId,
    quantity: Math.min(input.quantity, ADD_TO_BAG_QUANTITY_MAX),
    unitPriceMinor: input.unitPriceMinor,
    size: input.size,
  });
  await writeDemoCartLines(input.sessionId, items);
}

async function hydrateLiveLine(
  row: {
    id: string;
    product_variant_id: string;
    quantity: number;
    unit_price_minor: number;
  },
  cartId: string,
): Promise<{
  item?: PublicCartItem;
  issue?: CartRevalidationIssue;
  drop?: boolean;
}> {
  const live = await fetchLiveVariantForCart(row.product_variant_id);
  if (!live) {
    return { drop: true, issue: "product_removed" };
  }
  const availability = variantAvailability(live.variant);
  if (availability !== "in_stock") {
    return { drop: true, issue: "variant_unavailable" };
  }

  let quantity = row.quantity;
  let issue: CartRevalidationIssue | undefined;
  if (quantity > live.variant.stock_quantity) {
    quantity = Math.max(1, live.variant.stock_quantity);
    issue = "quantity_exceeds_stock";
    await updateLiveCartItemQuantity({ cartId, itemId: row.id, quantity });
  }
  if (row.unit_price_minor !== live.variant.price_minor) {
    issue = issue ?? "price_changed";
  }

  const colourName = live.variant.colour_name;
  const sizeName = live.variant.size_name?.trim() || undefined;
  const storefront = await getStorefrontProductBySlug(live.productSlug);
  const product = storefront?.product;
  const image = product ? toPublicImage(product) : undefined;

  return {
    item: {
      id: row.id,
      productId: live.productId,
      slug: live.productSlug,
      name: live.productName,
      href: productPath(live.productSlug),
      colourName,
      sizeName,
      quantity,
      unitPrice: minorToMajorGbp(live.variant.price_minor),
      lineTotal: minorToMajorGbp(live.variant.price_minor * quantity),
      currency: "GBP",
      image,
      issue,
    },
    issue,
  };
}

async function hydrateDemoLine(line: DemoCartLine): Promise<{
  item?: PublicCartItem;
  line?: DemoCartLine;
  issue?: CartRevalidationIssue;
  drop?: boolean;
}> {
  const record = await getStorefrontProductBySlug(line.slug);
  const product =
    record?.product ??
    (isDemoCatalogueEnabled() ? getProductBySlug(line.slug) : undefined);
  if (!product) {
    return { drop: true, issue: "product_removed" };
  }
  if (!isProductAvailable(product)) {
    return { drop: true, issue: "variant_unavailable" };
  }
  const colour =
    product.colours.find((item) => item.id === line.colourId) ??
    product.colours.find((item) => item.slug === line.colourId);
  if (!colour || !colour.available) {
    return { drop: true, issue: "variant_unavailable" };
  }

  const livePrice = resolveUnitPriceMinor(product, line.variantId);
  let issue: CartRevalidationIssue | undefined;
  if (livePrice !== line.unitPriceMinor) {
    issue = "price_changed";
  }
  let quantity = line.quantity;
  if (quantity > ADD_TO_BAG_QUANTITY_MAX) {
    quantity = ADD_TO_BAG_QUANTITY_MAX;
    issue = "quantity_exceeds_stock";
  }
  const nextLine: DemoCartLine = { ...line, quantity };
  const image = toPublicImage(product);

  return {
    line: nextLine,
    issue,
    item: {
      id: line.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      href: productPath(product.slug),
      colourName: colour.name,
      sizeName: line.size,
      quantity,
      unitPrice: minorToMajorGbp(livePrice),
      lineTotal: minorToMajorGbp(livePrice * quantity),
      currency: "GBP",
      image,
      issue,
    },
  };
}

function resolveUnitPriceMinor(product: Product, variantId: string): number {
  if (isDemoVariantId(variantId)) {
    return majorToMinorGbp(product.price);
  }
  return majorToMinorGbp(product.price);
}

function toPublicImage(product: Product): PublicCartItem["image"] {
  const image = getPrimaryImage(product);
  if (!image) {
    return undefined;
  }
  return {
    alt: image.alt,
    width: image.width,
    height: image.height,
    src: image.src,
  };
}

function revalidateCartPaths(): void {
  revalidatePath("/", "layout");
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/account");
}
