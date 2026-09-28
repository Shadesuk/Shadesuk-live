import "server-only";

import { variantAvailability } from "@/contracts/catalogue/availability";
import { isUuid } from "@/lib/ids";
import { checkoutUnavailableBlocked } from "@/lib/checkout-quote";
import type { PendingPaymentLine } from "@/lib/payment/pending-attempt";
import { commitPendingPayPalPayment } from "@/lib/payment/initiate";
import {
  createSupabasePendingPaymentStore,
  type PendingPaymentStore,
} from "@/lib/payment/pending-store";
import { createPayPalOrder } from "@/lib/paypal/create-order";
import { getOptionalAccountUser } from "@/lib/account-session";
import { readGuestCartSessionId } from "@/lib/guest-cart-cookie";
import type { PublicCheckoutDraft } from "@/types/checkout";
import type { PublicCart } from "@/types/cart";
import { getPublicCart } from "@/services/cart";
import { readCheckoutDraft } from "@/lib/checkout-draft-store";
import {
  fetchLiveVariantForCart,
  loadLiveAccountCart,
  loadLiveGuestCart,
} from "@/services/cart-live";
import type { CommitPendingPaymentResult } from "@/lib/payment/initiate";

export type InitiatePendingPaymentResult =
  | CommitPendingPaymentResult
  | { status: "unavailable" };

export type InitiatePendingPaymentOptions = {
  cart?: PublicCart;
  draft?: PublicCheckoutDraft;
  userId?: string | null;
  loadLines?: () => Promise<PendingPaymentLine[] | null>;
  store?: PendingPaymentStore;
  createProviderOrder?: typeof createPayPalOrder;
};

/**
 * Creates a pending `orders` + `order_items` + `payments` attempt and a
 * PayPal order from the same server-authoritative quote.
 *
 * Not a capture writer. Does not decrement stock, convert the cart, send
 * email, or trust a frontend success flag.
 *
 * Persistence is sequential (no existing multi-table transaction helper).
 * A PayPal failure leaves the application order unpaid (`created`).
 *
 * Duplicate initiation is not prevented (`PAYMENT_ATTEMPT_IDEMPOTENCY`).
 */
export async function initiatePendingPayPalPayment(
  options?: InitiatePendingPaymentOptions,
): Promise<InitiatePendingPaymentResult> {
  const loaded = await loadInitiationInputs(options);
  if (!loaded.ok) {
    return loaded.result;
  }

  return commitPendingPayPalPayment({
    draft: loaded.draft,
    lines: loaded.lines,
    userId: loaded.userId,
    store: options?.store ?? createSupabasePendingPaymentStore(),
    createProviderOrder: options?.createProviderOrder,
  });
}

/** @deprecated Use `initiatePendingPayPalPayment`. */
export const initiatePendingRazorpayPayment = initiatePendingPayPalPayment;

async function loadInitiationInputs(options?: InitiatePendingPaymentOptions): Promise<
  | { ok: true; draft: PublicCheckoutDraft; lines: PendingPaymentLine[]; userId: string | null }
  | { ok: false; result: InitiatePendingPaymentResult }
> {
  const cart = options?.cart ?? (await getPublicCart());
  if (cart.items.length === 0) {
    return { ok: false, result: { status: "empty" } };
  }
  if (checkoutUnavailableBlocked(cart)) {
    return { ok: false, result: { status: "blocked" } };
  }

  let draft = options?.draft;
  if (!draft) {
    const sessionId = await readGuestCartSessionId();
    draft = await readCheckoutDraft(sessionId);
  }

  const userId =
    options?.userId !== undefined ? options.userId : (await getOptionalAccountUser())?.id ?? null;

  const lines = options?.loadLines
    ? await options.loadLines()
    : await loadLivePendingPaymentLines(userId);
  if (!lines || lines.length === 0) {
    return { ok: false, result: { status: "unavailable" } };
  }

  return { ok: true, draft, lines, userId };
}

export async function loadLivePendingPaymentLines(
  userId?: string | null,
): Promise<PendingPaymentLine[] | null> {
  let liveCart = null;
  if (userId) {
    liveCart = await loadLiveAccountCart(userId);
  } else {
    const sessionId = await readGuestCartSessionId();
    if (!sessionId) {
      return null;
    }
    liveCart = await loadLiveGuestCart(sessionId);
  }
  if (!liveCart || liveCart.items.length === 0) {
    return null;
  }

  const lines: PendingPaymentLine[] = [];
  for (const row of liveCart.items) {
    if (!isUuid(row.product_variant_id)) {
      return null;
    }
    const live = await fetchLiveVariantForCart(row.product_variant_id);
    if (!live || variantAvailability(live.variant) !== "in_stock") {
      return null;
    }
    const quantity = row.quantity;
    const unitPriceMinor = live.variant.price_minor;
    lines.push({
      productId: live.productId,
      productVariantId: live.variant.id,
      sku: live.variant.sku,
      productName: live.productName,
      colourName: live.variant.colour_name,
      variantName: live.variant.size_name,
      quantity,
      unitPriceMinor,
      lineTotalMinor: unitPriceMinor * quantity,
      productSnapshot: {
        sku: live.variant.sku,
        product_name: live.productName,
        colour_name: live.variant.colour_name,
        variant_name: live.variant.size_name,
        unit_price_minor: unitPriceMinor,
        slug: live.productSlug,
      },
    });
  }
  return lines;
}
