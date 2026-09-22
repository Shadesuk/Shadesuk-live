import "server-only";

import { variantAvailability } from "@/contracts/catalogue/availability";
import { isUuid } from "@/lib/ids";
import { checkoutUnavailableBlocked, type CheckoutQuote } from "@/lib/checkout-quote";
import {
  buildPendingPaymentAttempt,
  type PendingPaymentLine,
} from "@/lib/payment/pending-attempt";
import {
  createSupabasePendingPaymentStore,
  pendingPaymentWritesAvailable,
  type PendingPaymentStore,
} from "@/lib/payment/pending-store";
import { createRazorpayOrder } from "@/lib/razorpay/create-order";
import { getOptionalAccountUser } from "@/lib/account-session";
import { readGuestCartSessionId } from "@/lib/guest-cart-cookie";
import type { CheckoutFieldErrors, PublicCheckoutDraft } from "@/types/checkout";
import type { PublicCart } from "@/types/cart";
import { getPublicCart } from "@/services/cart";
import { readCheckoutDraft } from "@/lib/checkout-draft-store";
import {
  fetchLiveVariantForCart,
  loadLiveAccountCart,
  loadLiveGuestCart,
} from "@/services/cart-live";

export type InitiatePendingPaymentResult =
  | {
      status: "ok";
      orderId: string;
      orderReference: string;
      paymentId: string;
      providerOrderId: string;
      amountMinor: number;
      currency: "GBP";
      paymentStatus: "created";
      orderPaymentStatus: "created";
      orderStatus: "placed";
      quote: CheckoutQuote;
    }
  | { status: "invalid"; errors: CheckoutFieldErrors }
  | { status: "empty" }
  | { status: "expired" }
  | { status: "blocked" }
  | { status: "unavailable" }
  | { status: "provider_failed"; error: string }
  | { status: "error" };

export type InitiatePendingPaymentOptions = {
  cart?: PublicCart;
  draft?: PublicCheckoutDraft;
  userId?: string | null;
  loadLines?: () => Promise<PendingPaymentLine[] | null>;
  store?: PendingPaymentStore;
  createProviderOrder?: typeof createRazorpayOrder;
};

/**
 * Creates a pending `orders` + `order_items` + `payments` attempt and a
 * Razorpay order from the same server-authoritative quote.
 *
 * Not a capture writer. Does not decrement stock, convert the cart, send
 * email, or trust a frontend success flag.
 *
 * Persistence is sequential (no existing multi-table transaction helper).
 * A Razorpay failure leaves the application order unpaid (`created`).
 *
 * Duplicate initiation is not prevented (`PAYMENT_ATTEMPT_IDEMPOTENCY`).
 */
export async function initiatePendingRazorpayPayment(
  options?: InitiatePendingPaymentOptions,
): Promise<InitiatePendingPaymentResult> {
  const loaded = await loadInitiationInputs(options);
  if (!loaded.ok) {
    return loaded.result;
  }

  const built = buildPendingPaymentAttempt({
    draft: loaded.draft,
    lines: loaded.lines,
    userId: loaded.userId,
  });
  if (!built.ok) {
    if (built.reason === "invalid") {
      return { status: "invalid", errors: built.errors };
    }
    return { status: built.reason };
  }

  const { attempt } = built;
  if (
    attempt.payment.status !== "created" ||
    attempt.order.payment_status !== "created" ||
    attempt.payment.amount_minor !== attempt.quote.totalMinor ||
    attempt.razorpay.amountMinor !== attempt.quote.totalMinor ||
    attempt.razorpay.currency !== "GBP" ||
    attempt.payment.currency !== "GBP"
  ) {
    return { status: "error" };
  }

  const store = options?.store ?? createSupabasePendingPaymentStore();
  let persisted;
  try {
    persisted = await store.insertAttempt({
      order: attempt.order,
      items: attempt.items,
      payment: attempt.payment,
    });
  } catch {
    return { status: "error" };
  }

  if (
    persisted.order.payment_status !== "created" ||
    persisted.payment.status !== "created" ||
    persisted.payment.captured_at ||
    persisted.order.status !== "placed"
  ) {
    return { status: "error" };
  }

  const createProviderOrder = options?.createProviderOrder ?? createRazorpayOrder;
  const provider = await createProviderOrder({
    amountMinor: attempt.quote.totalMinor,
    currency: attempt.quote.currency,
    receipt: attempt.razorpay.receipt,
  });

  if (!provider.ok) {
    try {
      await store.markInitiationFailed(persisted.payment.id, provider.error);
    } catch {
      // Keep the unpaid application rows; do not mark captured.
    }
    return { status: "provider_failed", error: provider.error };
  }

  if (
    provider.order.amountMinor !== attempt.quote.totalMinor ||
    provider.order.currency !== attempt.quote.currency
  ) {
    try {
      await store.markInitiationFailed(
        persisted.payment.id,
        "Razorpay order amount or currency did not match the server quote.",
      );
    } catch {
      // Unpaid application rows stay unpaid.
    }
    return { status: "provider_failed", error: "Razorpay order amount or currency did not match the server quote." };
  }

  try {
    const attached = await store.attachProviderOrderId(
      persisted.payment.id,
      provider.order.providerOrderId,
    );
    if (attached.status !== "created" || attached.captured_at) {
      return { status: "error" };
    }
    return {
      status: "ok",
      orderId: persisted.order.id,
      orderReference: persisted.order.order_reference,
      paymentId: attached.id,
      providerOrderId: provider.order.providerOrderId,
      amountMinor: attempt.quote.totalMinor,
      currency: "GBP",
      paymentStatus: "created",
      orderPaymentStatus: "created",
      orderStatus: "placed",
      quote: attempt.quote,
    };
  } catch {
    return { status: "provider_failed", error: "Could not attach the Razorpay order id." };
  }
}

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

  const userId = options?.userId !== undefined ? options.userId : (await getOptionalAccountUser())?.id ?? null;

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
