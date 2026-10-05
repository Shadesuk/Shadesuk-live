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
 * Capture checks the stored INR amount and currency, and the Razorpay order id
 * is checked by the caller. Lock expiry is decided when the order is created,
 * not against the clock after the customer has paid.
 * The same provider payment id captures once.
 */
export function assessRazorpayCapture(input: {
  stored: StoredRazorpayPayment;
  returnedAmountMinor: number;
  returnedCurrency: string;
  incomingPaymentId: string;
}): RazorpayCaptureDecision {
  if (input.stored.status === "captured") {
    return input.stored.providerPaymentId === input.incomingPaymentId ? "duplicate" : "reject";
  }
  if (input.stored.status !== "created" && input.stored.status !== "authorized") {
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
