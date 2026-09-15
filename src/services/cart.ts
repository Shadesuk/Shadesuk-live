import "server-only";

import { revalidatePath } from "next/cache";
import type { CartRevalidationIssue } from "@/contracts";
import { majorToMinorGbp, minorToMajorGbp } from "@/contracts";
import { ADD_TO_BAG_QUANTITY_MAX, evaluateAddToBag, resolveCartVariantId } from "@/lib/add-to-bag";
import { cartIssueMessage } from "@/lib/cart-copy";
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
import {
  getPrimaryImage,
  getProductBySlug,
  getProducts,
  isProductAvailable,
} from "@/services/catalogue";
import {
  fetchLiveVariantForCart,
  getOrCreateLiveGuestCart,
  listLiveCartItems,
  liveCartWritesAvailable,
  loadLiveGuestCart,
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
  const sessionId = await readGuestCartSessionId();
  if (!sessionId) {
    return emptyCart();
  }
  return assemblePublicCart(sessionId);
}

export async function addItemToGuestCart(input: AddToBagInput): Promise<AddToBagResult> {
  const record = await getStorefrontProductBySlug(input.slug);
  const evaluation = evaluateAddToBag(record?.product, input);
  if (evaluation.status !== "ready" || !record) {
    return evaluation;
  }

  const product = record.product;
  const colour = product.colours.find((item) => item.id === input.colourId);
  if (!colour) {
    return { status: "error" };
  }

  const sessionId = await bindGuestCartSession();
  const variantId = resolveCartVariantId(product, input.colourId, input.size);
  const quantity = Math.floor(input.quantity);
  const unitPriceMinor = resolveUnitPriceMinor(product, variantId);

  const live = await tryAddLiveLine({
    sessionId,
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
      size: input.size,
      variantId,
      quantity,
      unitPriceMinor,
    });
  }

  const cart = await assemblePublicCart(sessionId);
  revalidateCartPaths();
  return { status: "added", cart };
}

export async function updateGuestCartQuantity(
  itemId: string,
  quantity: number,
): Promise<PublicCart | null> {
  const sessionId = await readGuestCartSessionId();
  if (!sessionId || !itemId.trim()) {
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

  const liveCart = await loadLiveGuestCart(sessionId);
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
    return assemblePublicCart(sessionId);
  }

  const demo = await readDemoCartLines(sessionId);
  const index = demo.findIndex((item) => item.id === itemId);
  if (index === -1) {
    return assemblePublicCart(sessionId);
  }
  const current = demo[index];
  if (!current) {
    return assemblePublicCart(sessionId);
  }
  demo[index] = { ...current, quantity: Math.min(nextQty, ADD_TO_BAG_QUANTITY_MAX) };
  await writeDemoCartLines(sessionId, demo);
  revalidateCartPaths();
  return assemblePublicCart(sessionId);
}

export async function removeGuestCartItem(itemId: string): Promise<PublicCart | null> {
  const sessionId = await readGuestCartSessionId();
  if (!sessionId || !itemId.trim()) {
    return null;
  }

  const liveCart = await loadLiveGuestCart(sessionId);
  if (liveCart?.items.some((item) => item.id === itemId)) {
    await removeLiveCartItem({ cartId: liveCart.cart.id, itemId });
  }

  const demo = await readDemoCartLines(sessionId);
  const next = demo.filter((item) => item.id !== itemId);
  if (next.length !== demo.length) {
    await writeDemoCartLines(sessionId, next);
  }

  revalidateCartPaths();
  return assemblePublicCart(sessionId);
}

export function getCartSuggestions(cart: PublicCart, products = getProducts()) {
  return suggestCartProducts(cart, products);
}

async function assemblePublicCart(sessionId: string): Promise<PublicCart> {
  const issues: PublicCart["issues"] = [];
  const items: PublicCartItem[] = [];

  const liveCart = await loadLiveGuestCart(sessionId);
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

  const demo = await readDemoCartLines(sessionId);
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
  if (demoDirty) {
    await writeDemoCartLines(sessionId, keptDemo);
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
  if (variantAvailability(live.variant) !== "in_stock") {
    return "unavailable";
  }
  const cart = await getOrCreateLiveGuestCart(input.sessionId);
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
      unitPrice: minorToMajorGbp(row.unit_price_minor),
      lineTotal: minorToMajorGbp(row.unit_price_minor * quantity),
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
  const product = record?.product ?? getProductBySlug(line.slug);
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
      unitPrice: minorToMajorGbp(line.unitPriceMinor),
      lineTotal: minorToMajorGbp(line.unitPriceMinor * quantity),
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
}
