import type { PaymentStatus } from "./schema";

/**
 * A committed purchase has taken money or recorded a later refund of that money.
 * `created` / `authorized` are unpaid checkout attempts.
 * `failed` / `cancelled` are not completed purchases.
 * Historical rows stay in the database; reporting uses this predicate
 * instead of deleting them.
 */
export const COMMITTED_PURCHASE_PAYMENT_STATUSES = [
  "captured",
  "refunded",
  "partially_refunded",
] as const satisfies readonly PaymentStatus[];

export type CommittedPurchasePaymentStatus =
  (typeof COMMITTED_PURCHASE_PAYMENT_STATUSES)[number];

export function isCommittedPurchase(
  status: PaymentStatus | string | null | undefined,
): status is CommittedPurchasePaymentStatus {
  return (
    status === "captured" || status === "refunded" || status === "partially_refunded"
  );
}

/** Provisional checkout: an order row exists, but no purchase was committed. */
export function isProvisionalCheckoutPayment(
  status: PaymentStatus | string | null | undefined,
): boolean {
  return !isCommittedPurchase(status);
}
