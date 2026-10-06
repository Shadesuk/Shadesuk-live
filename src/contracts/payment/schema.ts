import type { ChargeCurrency } from "@/lib/payment/payment-route";
import { STORE_CURRENCY } from "../money";
import type { PaymentStatus } from "../order/schema";
import { PAYMENT_STATUSES } from "../order/schema";

/**
 * Locked production payment provider. Matches `payments.provider`.
 * Hard cut from Razorpay — do not add a second active provider adapter.
 * Historical `provider=razorpay` rows remain as-is (no backfill).
 */
export const PAYMENT_PROVIDER_PAYPAL = "paypal" as const;
export type PaymentProviderId = typeof PAYMENT_PROVIDER_PAYPAL;

/** Row shape for `public.payments` (PR #10). No metadata column exists. */
export type PaymentRow = {
  id: string;
  order_id: string;
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  amount_minor: number;
  currency: ChargeCurrency;
  status: PaymentStatus;
  failure_reason: string | null;
  captured_at: string | null;
  created_at: string;
  updated_at: string;
};

export function isPaymentProviderPaypal(value: string): value is PaymentProviderId {
  return value === PAYMENT_PROVIDER_PAYPAL;
}

export function isSchemaPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Checkout draft/session has no payment-attempt key, and `payments` has no
 * cart_id / session_id. Duplicate initiation is not deduped here.
 * Capture idempotency uses `payments.status` / `captured_at` and unique
 * `provider_payment_id`.
 *
 * Known risk (PR review MEDIUM — deferred): double-click / retry can create
 * multiple unpaid attempts. Inventory decrement remains best-effort after
 * capture. Do not invent a new idempotency cookie without a product decision.
 */
export const PAYMENT_ATTEMPT_IDEMPOTENCY = {
  mechanism: "none",
  reason:
    "No existing draft/session payment-attempt identifier maps to payments. Capture uses payment row status, captured_at, and unique provider_payment_id.",
} as const;

export const PAYMENT_CURRENCY = STORE_CURRENCY;
