import "server-only";

import { STORE_CURRENCY, type StoreCurrency } from "@/contracts/money";
import { getRazorpayClient } from "./client";
import { razorpayFailureMessage } from "./errors";
import { razorpaySubunitToGbpMinor } from "./amount";

export type FetchedRazorpayPayment = {
  providerPaymentId: string;
  providerOrderId: string;
  amountMinor: number;
  currency: StoreCurrency;
  providerStatus: string;
};

export type FetchRazorpayPaymentResult =
  | { ok: true; payment: FetchedRazorpayPayment }
  | { ok: false; error: string };

export async function fetchRazorpayPayment(
  providerPaymentId: string,
): Promise<FetchRazorpayPaymentResult> {
  const id = providerPaymentId.trim();
  if (!id) {
    return { ok: false, error: "Razorpay payment id is missing." };
  }
  const clientResult = getRazorpayClient();
  if (!clientResult.ok) {
    return { ok: false, error: "Razorpay is not configured." };
  }
  try {
    const fetched = await clientResult.client.payments.fetch(id);
    return parseFetchedPayment(fetched, id);
  } catch (error) {
    return { ok: false, error: razorpayFailureMessage(error) };
  }
}

function parseFetchedPayment(
  value: unknown,
  expectedId: string,
): FetchRazorpayPaymentResult {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Razorpay did not return a payment." };
  }
  const row = value as Record<string, unknown>;
  const providerPaymentId = typeof row.id === "string" ? row.id.trim() : "";
  const providerOrderId = typeof row.order_id === "string" ? row.order_id.trim() : "";
  const amountMinor = razorpaySubunitToGbpMinor(row.amount, row.currency);
  if (!providerPaymentId || providerPaymentId !== expectedId) {
    return { ok: false, error: "Razorpay payment id did not match." };
  }
  if (!providerOrderId) {
    return { ok: false, error: "Razorpay payment is missing an order id." };
  }
  if (amountMinor == null) {
    return { ok: false, error: "Razorpay payment is not a GBP minor-unit amount." };
  }
  return {
    ok: true,
    payment: {
      providerPaymentId,
      providerOrderId,
      amountMinor,
      currency: STORE_CURRENCY,
      providerStatus: typeof row.status === "string" ? row.status : "",
    },
  };
}
