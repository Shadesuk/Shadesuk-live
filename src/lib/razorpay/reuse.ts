import { checkoutAttemptOwnerMatches } from "@/lib/payment/attempt-binding";
import { sameCheckoutLines } from "@/lib/payment/checkout-lines";
import { isRazorpayOrderId } from "./ids";

export type IndiaOpenAttempt = {
  paymentId: string;
  orderId: string;
  orderReference: string;
  providerOrderId: string | null;
  amountMinor: number;
  currency: string;
  frozenAt: number | null;
  userId: string | null;
  email: string;
  status: string;
  lines: { variantId: string; quantity: number }[];
};

/**
 * One open India attempt per browser cookie and frozen quote.
 * A matching attempt is reused, so the same shopper does not open a second order.
 * A changed quote is closed first; the caller then inserts a new order.
 * Another shopper's attempt is left alone.
 * The payments unique index only stops a second open row on the same order.
 */
export function decideIndiaAttemptReuse(input: {
  open: IndiaOpenAttempt | null;
  ownerUserId: string | null;
  email: string;
  frozenAt: number;
  amountMinor: number;
  lines: readonly { variantId: string; quantity: number }[];
}): "reuse" | "close" | "ignore" {
  if (!input.open) {
    return "ignore";
  }
  if (!checkoutAttemptOwnerMatches(input.open.userId, input.ownerUserId)) {
    return "ignore";
  }
  const reusable =
    input.open.status === "created" &&
    typeof input.open.providerOrderId === "string" &&
    isRazorpayOrderId(input.open.providerOrderId) &&
    input.open.currency === "INR" &&
    input.open.amountMinor === input.amountMinor &&
    input.open.frozenAt === input.frozenAt &&
    input.open.email === input.email &&
    sameCheckoutLines(input.open.lines, input.lines);
  return reusable ? "reuse" : "close";
}
