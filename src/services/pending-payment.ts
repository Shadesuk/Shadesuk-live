import "server-only";

import { variantAvailability } from "@/contracts/catalogue/availability";
import { isUuid } from "@/lib/ids";
import { checkoutUnavailableBlocked } from "@/lib/checkout-quote";
import {
  checkoutAttemptOwnerMatches,
  paymentAttemptBoundToCookie,
} from "@/lib/payment/attempt-binding";
import {
  clearPaymentAttemptId,
  PAYMENT_ATTEMPT_MAX_AGE_SECONDS,
  readPaymentAttemptId,
  rememberPaymentAttemptId,
} from "@/lib/payment/attempt-cookie";
import { sameCheckoutLines } from "@/lib/payment/checkout-lines";
import {
  buildPendingPaymentAttempt,
  type PendingPaymentLine,
} from "@/lib/payment/pending-attempt";
import { commitPendingPayPalPayment } from "@/lib/payment/initiate";
import {
  createSupabasePendingPaymentStore,
  type PendingPaymentStore,
} from "@/lib/payment/pending-store";
import { createPayPalOrder } from "@/lib/paypal/create-order";
import { getOptionalAccountUser } from "@/lib/account-session";
import { readGuestCartSessionId } from "@/lib/guest-cart-cookie";
import { normalizeEmailInput, formatUkPostcode, normalizeCountry } from "@/lib/checkout-validate";
import { CHECKOUT_COUNTRY_GB } from "@/types/checkout";
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
  /** Test seam. Production reads the httpOnly attempt cookie. */
  readAttemptId?: () => Promise<string | null>;
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

  const store = options?.store ?? createSupabasePendingPaymentStore();
  const reused = await reuseOpenAttempt({
    store,
    draft: loaded.draft,
    lines: loaded.lines,
    userId: loaded.userId,
    readAttemptId: options?.readAttemptId,
  });
  if (reused) {
    return reused;
  }

  const committed = await commitPendingPayPalPayment({
    draft: loaded.draft,
    lines: loaded.lines,
    userId: loaded.userId,
    store,
    createProviderOrder: options?.createProviderOrder,
  });
  if (committed.status === "ok") {
    try {
      await rememberPaymentAttemptId(committed.paymentId);
    } catch {
      // The attempt is still payable without the reuse cookie.
    }
  }
  return committed;
}

async function reuseOpenAttempt(input: {
  store: PendingPaymentStore;
  draft: PublicCheckoutDraft;
  lines: PendingPaymentLine[];
  userId: string | null;
  readAttemptId?: () => Promise<string | null>;
}): Promise<InitiatePendingPaymentResult | null> {
  const built = buildPendingPaymentAttempt({
    draft: input.draft,
    lines: input.lines,
    userId: input.userId,
  });
  if (!built.ok) {
    return null;
  }
  let paymentId: string | null = null;
  try {
    paymentId = input.readAttemptId ? await input.readAttemptId() : await readPaymentAttemptId();
  } catch {
    return null;
  }
  if (!paymentId || !input.store.loadOpenAttempt || !input.store.closeOpenAttempt) {
    return null;
  }
  const open = await input.store.loadOpenAttempt(paymentId);
  if (!open || !open.payment.provider_order_id) {
    return null;
  }
  if (!checkoutAttemptOwnerMatches(open.order.user_id, input.userId)) {
    try {
      await clearPaymentAttemptId();
    } catch {
      // The cookie is local. The other shopper's attempt stays open.
    }
    return null;
  }
  const ageMs = Date.now() - new Date(open.order.created_at).getTime();
  const fresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs < PAYMENT_ATTEMPT_MAX_AGE_SECONDS * 1000;
  const email = normalizeEmailInput(input.draft.email);
  const postcode =
    normalizeCountry(input.draft.country) === CHECKOUT_COUNTRY_GB
      ? formatUkPostcode(input.draft.postcode)
      : input.draft.postcode.trim();
  const storedPostcode =
    typeof open.order.delivery_address.postcode === "string"
      ? open.order.delivery_address.postcode
      : "";
  const matches =
    fresh &&
    open.order.total_minor === built.attempt.quote.totalMinor &&
    open.payment.amount_minor === built.attempt.paypal.amountMinor &&
    open.payment.currency === built.attempt.paypal.currency &&
    open.order.customer_email === email &&
    storedPostcode === postcode &&
    sameCheckoutLines(
      open.items.map((item) => ({
        variantId: item.product_variant_id ?? "",
        quantity: item.quantity,
      })),
      input.lines.map((line) => ({
        variantId: line.productVariantId,
        quantity: line.quantity,
      })),
    );
  if (matches) {
    return {
      status: "ok",
      orderId: open.order.id,
      orderReference: open.order.order_reference,
      paymentId: open.payment.id,
      providerOrderId: open.payment.provider_order_id,
      amountMinor: open.payment.amount_minor,
      currency: built.attempt.paypal.currency,
      paymentStatus: "created",
      orderPaymentStatus: "created",
      orderStatus: "checkout",
      quote: built.attempt.quote,
    };
  }
  try {
    await input.store.closeOpenAttempt(
      open.payment.id,
      "cancelled",
      "Checkout changed before PayPal approval.",
    );
    await clearPaymentAttemptId();
  } catch {
    // A newer attempt is still created. The old row stays unpaid.
  }
  return null;
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

export async function closeCheckoutPaymentAttempt(
  paymentId: string,
  status: "cancelled" | "failed",
  reason: string,
  options?: {
    store?: PendingPaymentStore;
    /**
     * Test seam for the httpOnly attempt cookie.
     * Omit it in production so the server reads the cookie itself.
     */
    boundPaymentId?: string | null;
  },
): Promise<boolean> {
  if (!isUuid(paymentId)) {
    return false;
  }
  const bound =
    options && "boundPaymentId" in options
      ? (options.boundPaymentId ?? null)
      : await readPaymentAttemptId();
  if (!paymentAttemptBoundToCookie(paymentId, bound)) {
    return false;
  }
  const store = options?.store ?? createSupabasePendingPaymentStore();
  await store.closeOpenAttempt(paymentId, status, reason);
  try {
    await clearPaymentAttemptId();
  } catch {
    // Closing the row is what keeps the attempt out of confirmed orders.
  }
  return true;
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
