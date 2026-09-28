import "server-only";

import {
  buildPendingPaymentAttempt,
  type PendingPaymentLine,
} from "@/lib/payment/pending-attempt";
import type { PendingPaymentStore } from "@/lib/payment/pending-store";
import { createPayPalOrder } from "@/lib/paypal/create-order";
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

  const { attempt } = built;
  if (
    attempt.payment.status !== "created" ||
    attempt.order.payment_status !== "created" ||
    attempt.payment.amount_minor !== attempt.quote.totalMinor ||
    attempt.paypal.amountMinor !== attempt.quote.totalMinor ||
    attempt.paypal.currency !== "GBP" ||
    attempt.payment.currency !== "GBP"
  ) {
    return { status: "error" };
  }

  let persisted;
  try {
    persisted = await input.store.insertAttempt({
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

  const createProviderOrder = input.createProviderOrder ?? createPayPalOrder;
  const provider = await createProviderOrder({
    amountMinor: attempt.quote.totalMinor,
    currency: attempt.quote.currency,
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
    provider.order.amountMinor !== attempt.quote.totalMinor ||
    provider.order.currency !== attempt.quote.currency
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
      amountMinor: attempt.quote.totalMinor,
      currency: "GBP",
      paymentStatus: "created",
      orderPaymentStatus: "created",
      orderStatus: "placed",
      quote: attempt.quote,
    };
  } catch {
    return { status: "provider_failed", error: "Could not attach the PayPal order id." };
  }
}

/** @deprecated Use `commitPendingPayPalPayment`. */
export const commitPendingRazorpayPayment = commitPendingPayPalPayment;
