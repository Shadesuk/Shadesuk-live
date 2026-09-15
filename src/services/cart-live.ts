import "server-only";

import type { CartItemRow, CartMergeConflict, CartRow, ProductVariantRow } from "@/contracts";
import { variantAvailability } from "@/contracts/catalogue/availability";
import { isUuid } from "@/lib/ids";
import { isLiveVariantEligibleForCart } from "@/lib/live-cart-eligibility";
import { hasSupabaseSecretKey, createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const CART_COLUMNS = "id, user_id, session_id, status, currency, created_at, updated_at";
const CART_ITEM_COLUMNS =
  "id, cart_id, product_variant_id, quantity, unit_price_minor, created_at, updated_at";
const VARIANT_COLUMNS =
  "id, product_id, sku, colour_name, size_name, price_minor, compare_at_price_minor, currency, lens_width_mm, bridge_width_mm, temple_length_mm, stock_quantity, status, created_at, updated_at";

export type LiveVariantForCart = {
  variant: ProductVariantRow;
  productId: string;
  productSlug: string;
  productName: string;
};

export function liveCartWritesAvailable(): boolean {
  return (
    hasSupabaseSecretKey() &&
    isSupabaseConfigured() &&
    Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export async function getOrCreateLiveGuestCart(sessionId: string): Promise<CartRow | null> {
  if (!liveCartWritesAvailable()) {
    return null;
  }
  const admin = createSupabaseAdminClient();
  const existing = await admin
    .from("carts")
    .select(CART_COLUMNS)
    .eq("session_id", sessionId)
    .is("user_id", null)
    .eq("status", "active")
    .maybeSingle();

  if (existing.error) {
    return null;
  }
  if (existing.data) {
    return parseCartRow(existing.data);
  }

  const inserted = await admin
    .from("carts")
    .insert({
      session_id: sessionId,
      user_id: null,
      status: "active",
      currency: "GBP",
    })
    .select(CART_COLUMNS)
    .single();

  if (inserted.data) {
    return parseCartRow(inserted.data);
  }

  const raced = await admin
    .from("carts")
    .select(CART_COLUMNS)
    .eq("session_id", sessionId)
    .is("user_id", null)
    .eq("status", "active")
    .maybeSingle();
  return raced.data ? parseCartRow(raced.data) : null;
}

export async function getOrCreateLiveAccountCart(userId: string): Promise<CartRow | null> {
  if (!liveCartWritesAvailable() || !isUuid(userId)) {
    return null;
  }
  const admin = createSupabaseAdminClient();
  const existing = await admin
    .from("carts")
    .select(CART_COLUMNS)
    .eq("user_id", userId)
    .is("session_id", null)
    .eq("status", "active")
    .maybeSingle();

  if (existing.error) {
    return null;
  }
  if (existing.data) {
    return parseCartRow(existing.data);
  }

  const inserted = await admin
    .from("carts")
    .insert({
      session_id: null,
      user_id: userId,
      status: "active",
      currency: "GBP",
    })
    .select(CART_COLUMNS)
    .single();

  if (inserted.data) {
    return parseCartRow(inserted.data);
  }

  const raced = await admin
    .from("carts")
    .select(CART_COLUMNS)
    .eq("user_id", userId)
    .is("session_id", null)
    .eq("status", "active")
    .maybeSingle();
  return raced.data ? parseCartRow(raced.data) : null;
}

export async function loadLiveAccountCart(userId: string): Promise<{
  cart: CartRow;
  items: CartItemRow[];
} | null> {
  if (!liveCartWritesAvailable() || !isUuid(userId)) {
    return null;
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("carts")
    .select(CART_COLUMNS)
    .eq("user_id", userId)
    .is("session_id", null)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const cart = parseCartRow(data);
  if (!cart) {
    return null;
  }
  const items = await listLiveCartItems(cart.id);
  return { cart, items };
}

/**
 * Guest → account merge. Bound to the httpOnly guest cookie + verified user id.
 * Never accepts session_id from the client. Drops are returned as conflicts.
 */
export async function mergeLiveGuestCartIntoAccount(input: {
  sessionId: string;
  userId: string;
}): Promise<CartMergeConflict[]> {
  if (!liveCartWritesAvailable() || !isUuid(input.userId)) {
    return [];
  }
  const guest = await loadLiveGuestCart(input.sessionId);
  const account = await getOrCreateLiveAccountCart(input.userId);
  if (!guest || !account || guest.cart.id === account.id) {
    return [];
  }

  const conflicts: CartMergeConflict[] = [];
  const accountItems = await listLiveCartItems(account.id);

  for (const item of guest.items) {
    const live = await fetchLiveVariantForCart(item.product_variant_id);
    if (!live) {
      conflicts.push("product_removed_dropped");
      continue;
    }
    if (variantAvailability(live.variant) !== "in_stock") {
      conflicts.push("variant_sold_out_dropped");
      continue;
    }

    const existing = accountItems.find(
      (row) => row.product_variant_id === item.product_variant_id,
    );
    const summed = (existing?.quantity ?? 0) + item.quantity;
    const capped = Math.max(1, Math.min(summed, live.variant.stock_quantity));
    if (existing) {
      conflicts.push("same_variant_quantities_summed");
      if (capped < summed) {
        conflicts.push("quantity_capped_to_stock");
      }
      const updated = await updateLiveCartItemQuantity({
        cartId: account.id,
        itemId: existing.id,
        quantity: capped,
      });
      if (updated) {
        existing.quantity = updated.quantity;
      }
      continue;
    }

    if (capped < item.quantity) {
      conflicts.push("quantity_capped_to_stock");
    }
    if (item.unit_price_minor !== live.variant.price_minor) {
      conflicts.push("price_changed_retained_pending_revalidation");
    }
    const written = await upsertLiveCartItem({
      cartId: account.id,
      variantId: item.product_variant_id,
      quantity: capped,
      unitPriceMinor: item.unit_price_minor,
    });
    if (written) {
      accountItems.push(written);
    }
  }

  await convertLiveGuestCart(guest.cart.id);
  return conflicts;
}

async function convertLiveGuestCart(cartId: string): Promise<void> {
  if (!liveCartWritesAvailable() || !isUuid(cartId)) {
    return;
  }
  const admin = createSupabaseAdminClient();
  await admin
    .from("carts")
    .update({
      status: "converted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", cartId)
    .is("user_id", null)
    .eq("status", "active");
}

export async function loadLiveGuestCart(sessionId: string): Promise<{
  cart: CartRow;
  items: CartItemRow[];
} | null> {
  if (!liveCartWritesAvailable()) {
    return null;
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("carts")
    .select(CART_COLUMNS)
    .eq("session_id", sessionId)
    .is("user_id", null)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const cart = parseCartRow(data);
  if (!cart) {
    return null;
  }
  const items = await listLiveCartItems(cart.id);
  return { cart, items };
}

export async function listLiveCartItems(cartId: string): Promise<CartItemRow[]> {
  if (!liveCartWritesAvailable() || !isUuid(cartId)) {
    return [];
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("cart_items")
    .select(CART_ITEM_COLUMNS)
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data
    .map(parseCartItemRow)
    .filter((row): row is CartItemRow => Boolean(row));
}

export async function upsertLiveCartItem(input: {
  cartId: string;
  variantId: string;
  quantity: number;
  unitPriceMinor: number;
}): Promise<CartItemRow | null> {
  if (!liveCartWritesAvailable() || !isUuid(input.cartId) || !isUuid(input.variantId)) {
    return null;
  }
  const admin = createSupabaseAdminClient();
  const existing = await admin
    .from("cart_items")
    .select(CART_ITEM_COLUMNS)
    .eq("cart_id", input.cartId)
    .eq("product_variant_id", input.variantId)
    .maybeSingle();

  if (existing.data) {
    const current = parseCartItemRow(existing.data);
    if (!current) {
      return null;
    }
    const updated = await admin
      .from("cart_items")
      .update({
        quantity: input.quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .eq("cart_id", input.cartId)
      .select(CART_ITEM_COLUMNS)
      .single();
    return updated.data ? parseCartItemRow(updated.data) : null;
  }

  const inserted = await admin
    .from("cart_items")
    .insert({
      cart_id: input.cartId,
      product_variant_id: input.variantId,
      quantity: input.quantity,
      unit_price_minor: input.unitPriceMinor,
    })
    .select(CART_ITEM_COLUMNS)
    .single();
  if (inserted.data) {
    return parseCartItemRow(inserted.data);
  }
  if (isForeignKeyError(inserted.error)) {
    return null;
  }
  return null;
}

export async function updateLiveCartItemQuantity(input: {
  cartId: string;
  itemId: string;
  quantity: number;
}): Promise<CartItemRow | null> {
  if (!liveCartWritesAvailable() || !isUuid(input.cartId) || !isUuid(input.itemId)) {
    return null;
  }
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("cart_items")
    .update({
      quantity: input.quantity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.itemId)
    .eq("cart_id", input.cartId)
    .select(CART_ITEM_COLUMNS)
    .maybeSingle();
  return data ? parseCartItemRow(data) : null;
}

export async function removeLiveCartItem(input: {
  cartId: string;
  itemId: string;
}): Promise<boolean> {
  if (!liveCartWritesAvailable() || !isUuid(input.cartId) || !isUuid(input.itemId)) {
    return false;
  }
  const admin = createSupabaseAdminClient();
  const { error, count } = await admin
    .from("cart_items")
    .delete({ count: "exact" })
    .eq("id", input.itemId)
    .eq("cart_id", input.cartId);
  return !error && (count == null || count > 0);
}

export async function fetchLiveVariantForCart(
  variantId: string,
): Promise<LiveVariantForCart | null> {
  if (!liveCartWritesAvailable() || !isUuid(variantId)) {
    return null;
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("product_variants")
    .select(VARIANT_COLUMNS)
    .eq("id", variantId)
    .eq("status", "available")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const variant = parseVariantRow(data);
  if (!variant) {
    return null;
  }
  const product = await admin
    .from("products")
    .select("id, slug, name, status")
    .eq("id", variant.product_id)
    .eq("status", "published")
    .maybeSingle();
  if (
    !product.data ||
    typeof product.data.slug !== "string" ||
    typeof product.data.name !== "string" ||
    !isLiveVariantEligibleForCart({
      productStatus: String(product.data.status),
      variantStatus: variant.status,
    })
  ) {
    return null;
  }
  return {
    variant,
    productId: product.data.id as string,
    productSlug: product.data.slug,
    productName: product.data.name,
  };
}

function parseCartRow(value: unknown): CartRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asString(value.id);
  const status = value.status;
  const createdAt = asString(value.created_at);
  const updatedAt = asString(value.updated_at);
  if (
    !id ||
    (status !== "active" &&
      status !== "converted" &&
      status !== "abandoned" &&
      status !== "expired") ||
    value.currency !== "GBP" ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }
  return {
    id,
    user_id: typeof value.user_id === "string" ? value.user_id : null,
    session_id: typeof value.session_id === "string" ? value.session_id : null,
    status,
    currency: "GBP",
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function parseCartItemRow(value: unknown): CartItemRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asString(value.id);
  const cartId = asString(value.cart_id);
  const variantId = asString(value.product_variant_id);
  const quantity = asInteger(value.quantity);
  const unitPriceMinor = asInteger(value.unit_price_minor);
  const createdAt = asString(value.created_at);
  const updatedAt = asString(value.updated_at);
  if (
    !id ||
    !cartId ||
    !variantId ||
    quantity == null ||
    quantity < 1 ||
    unitPriceMinor == null ||
    unitPriceMinor < 0 ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }
  return {
    id,
    cart_id: cartId,
    product_variant_id: variantId,
    quantity,
    unit_price_minor: unitPriceMinor,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function parseVariantRow(value: unknown): ProductVariantRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const status = value.status;
  if (
    status !== "draft" &&
    status !== "available" &&
    status !== "unavailable" &&
    status !== "archived"
  ) {
    return null;
  }
  const id = asString(value.id);
  const productId = asString(value.product_id);
  const sku = asString(value.sku);
  const colourName = asString(value.colour_name);
  const createdAt = asString(value.created_at);
  const updatedAt = asString(value.updated_at);
  const priceMinor = asInteger(value.price_minor);
  const stockQuantity = asInteger(value.stock_quantity);
  if (
    !id ||
    !productId ||
    !sku ||
    !colourName ||
    !createdAt ||
    !updatedAt ||
    priceMinor == null ||
    stockQuantity == null ||
    value.currency !== "GBP"
  ) {
    return null;
  }
  return {
    id,
    product_id: productId,
    sku,
    colour_name: colourName,
    size_name: typeof value.size_name === "string" ? value.size_name : null,
    price_minor: priceMinor,
    compare_at_price_minor: asInteger(value.compare_at_price_minor),
    currency: "GBP",
    lens_width_mm: asInteger(value.lens_width_mm),
    bridge_width_mm: asInteger(value.bridge_width_mm),
    temple_length_mm: asInteger(value.temple_length_mm),
    stock_quantity: stockQuantity,
    status,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function isForeignKeyError(error: { code?: string } | null): boolean {
  return error?.code === "23503";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
