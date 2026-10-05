import "server-only";

import { ORDER_REFERENCE_ALLOCATION_ATTEMPTS } from "@/contracts/order/reference";
import {
  buildPendingPaymentAttempt,
  type PendingPaymentAttempt,
  type PendingPaymentLine,
} from "@/lib/payment/pending-attempt";
import {
  OrderReferenceCollisionError,
  type PendingPaymentStore,
  type PersistedPendingPayment,
} from "@/lib/payment/pending-store";
import { createPayPalOrder } from "@/lib/paypal/create-order";
import { isPayPalChargeCurrency, type PayPalChargeCurrency } from "@/lib/payment/payment-route";
import { STORE_CURRENCY } from "@/contracts/money";
import type { CheckoutQuote } from "@/lib/checkout-quote";
import type { CheckoutFieldErrors, PublicCheckoutDraft } from "@/types/checkout";

export type CommitPendingPaymentResult =
  | {
      status: "ok";
      orderId: string;
      orderReference: string;
      paymentId: string;
      providerOrderId: string;
      amountMinor: number;
      currency: PayPalChargeCurrency;
      paymentStatus: "created";
      orderPaymentStatus: "created";
      orderStatus: "checkout";
      quote: CheckoutQuote;
    }
  | { status: "invalid"; errors: CheckoutFieldErrors }
  | { status: "empty" }
  | { status: "expired" }
  | { status: "blocked" }
  | { status: "provider_failed"; error: string }
  | { status: "error" };

/**
 * Persist unpaid order/payment rows, create the PayPal order from the
 * same quote, attach `provider_order_id`. Never marks captured.
 */
export async function commitPendingPayPalPayment(input: {
  draft: PublicCheckoutDraft;
  lines: readonly PendingPaymentLine[];
  userId?: string | null;
  store: PendingPaymentStore;
  createProviderOrder?: typeof createPayPalOrder;
}): Promise<CommitPendingPaymentResult> {
  let persisted: PersistedPendingPayment | undefined;
  let attempt: PendingPaymentAttempt | undefined;
  for (let tries = 0; tries < ORDER_REFERENCE_ALLOCATION_ATTEMPTS; tries += 1) {
    const built = buildPendingPaymentAttempt({
      draft: input.draft,
      lines: input.lines,
      userId: input.userId,
    });
    if (!built.ok) {
      if (built.reason === "invalid") {
        return { status: "invalid", errors: built.errors };
      }
      return { status: built.reason };
    }

    attempt = built.attempt;
    if (
      attempt.payment.status !== "created" ||
      attempt.order.payment_status !== "created" ||
      attempt.order.currency !== STORE_CURRENCY ||
      attempt.paypal.amountMinor !== attempt.payment.amount_minor ||
      attempt.paypal.currency !== attempt.payment.currency ||
      !isPayPalChargeCurrency(attempt.payment.currency) ||
      (attempt.payment.currency === STORE_CURRENCY &&
        attempt.payment.amount_minor !== attempt.quote.totalMinor) ||
      (attempt.payment.currency !== STORE_CURRENCY &&
        (!attempt.payment.fx_rate_id || !attempt.payment.quote_frozen_at))
    ) {
      return { status: "error" };
    }

    try {
      persisted = await input.store.insertAttempt({
        order: attempt.order,
        items: attempt.items,
        payment: attempt.payment,
      });
      break;
    } catch (error) {
      if (
        error instanceof OrderReferenceCollisionError &&
        tries < ORDER_REFERENCE_ALLOCATION_ATTEMPTS - 1
      ) {
        continue;
      }
      return { status: "error" };
    }
  }

  if (!persisted || !attempt) {
    return { status: "error" };
  }

  if (
    persisted.order.payment_status !== "created" ||
    persisted.payment.status !== "created" ||
    persisted.payment.captured_at ||
    persisted.order.status !== "checkout"
  ) {
    return { status: "error" };
  }

  const createProviderOrder = input.createProviderOrder ?? createPayPalOrder;
  const provider = await createProviderOrder({
    amountMinor: attempt.paypal.amountMinor,
    currency: attempt.paypal.currency,
    customId: persisted.payment.id,
    invoiceId: attempt.paypal.invoiceId,
  });

  if (!provider.ok) {
    try {
      await input.store.markInitiationFailed(persisted.payment.id, provider.error);
    } catch {
      // Keep the unpaid application rows; do not mark captured.
    }
    return { status: "provider_failed", error: provider.error };
  }

  if (
    provider.order.amountMinor !== attempt.paypal.amountMinor ||
    provider.order.currency !== attempt.paypal.currency
  ) {
    try {
      await input.store.markInitiationFailed(
        persisted.payment.id,
        "PayPal order amount or currency did not match the server quote.",
      );
    } catch {
      // Unpaid application rows stay unpaid.
    }
    return {
      status: "provider_failed",
      error: "PayPal order amount or currency did not match the server quote.",
    };
  }

  try {
    const attached = await input.store.attachProviderOrderId(
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
      amountMinor: attempt.paypal.amountMinor,
      currency: attempt.paypal.currency,
      paymentStatus: "created",
      orderPaymentStatus: "created",
      orderStatus: "checkout",
      quote: attempt.quote,
    };
  } catch {
    return { status: "provider_failed", error: "Could not attach the PayPal order id." };
  }
}
