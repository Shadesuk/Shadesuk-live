import { QUOTE_LOCK_TTL_MS } from "@/lib/checkout-quote-lock";

export type StoredRazorpayPayment = {
  amountMinor: number;
  currency: string;
  fxRateId: string | null;
  frozenAt: number | null;
  status: string;
  providerPaymentId: string | null;
};

export type RazorpayCaptureDecision = "capture" | "duplicate" | "reject";

/**
 * The stored row is the locked quote: INR `chargeTotalMinor`, `fxRateId`, and `frozenAt`.
 * A later Razorpay payload must match that row. Expiry and amount drift reject.
 * The same provider payment id captures once.
 */
export function assessRazorpayCapture(input: {
  stored: StoredRazorpayPayment;
  returnedAmountMinor: number;
  returnedCurrency: string;
  incomingPaymentId: string;
  now?: number;
}): RazorpayCaptureDecision {
  const now = input.now ?? Date.now();
  if (input.stored.status === "captured") {
    return input.stored.providerPaymentId === input.incomingPaymentId ? "duplicate" : "reject";
  }
  if (input.stored.status !== "created" && input.stored.status !== "authorized") {
    return "reject";
  }
  if (
    input.stored.frozenAt == null ||
    !Number.isInteger(input.stored.frozenAt) ||
    now - input.stored.frozenAt >= QUOTE_LOCK_TTL_MS
  ) {
    return "reject";
  }
  if (!input.stored.fxRateId) {
    return "reject";
  }
  const amountMatches =
    input.returnedAmountMinor === input.stored.amountMinor &&
    input.returnedCurrency === "INR" &&
    input.stored.currency === "INR" &&
    Number.isInteger(input.returnedAmountMinor) &&
    input.returnedAmountMinor > 0;
  return amountMatches ? "capture" : "reject";
}
