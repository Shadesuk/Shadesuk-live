import type { StoreCurrency } from "../money";
import { STORE_CURRENCY } from "../money";
import type { PaymentStatus } from "../order/schema";
import { PAYMENT_STATUSES } from "../order/schema";

/**
 * Locked production payment provider. Matches `payments.provider`.
 * Do not add a second provider adapter.
 */
export const PAYMENT_PROVIDER_RAZORPAY = "razorpay" as const;
export type PaymentProviderId = typeof PAYMENT_PROVIDER_RAZORPAY;

/** Row shape for `public.payments` (PR #10). No metadata column exists. */
export type PaymentRow = {
  id: string;
  order_id: string;
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  amount_minor: number;
  currency: StoreCurrency;
  status: PaymentStatus;
  failure_reason: string | null;
  captured_at: string | null;
  created_at: string;
  updated_at: string;
};

export function isPaymentProviderRazorpay(value: string): value is PaymentProviderId {
  return value === PAYMENT_PROVIDER_RAZORPAY;
}

export function isSchemaPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Checkout draft/session has no payment-attempt key, and `payments` has no
 * cart_id / session_id. Duplicate initiation is not deduped here.
 * Capture-time idempotency is a later step.
 */
export const PAYMENT_ATTEMPT_IDEMPOTENCY = {
  mechanism: "none",
  reason:
    "No existing draft/session payment-attempt identifier maps to payments. Capture idempotency is out of scope.",
} as const;

export const PAYMENT_CURRENCY = STORE_CURRENCY;
