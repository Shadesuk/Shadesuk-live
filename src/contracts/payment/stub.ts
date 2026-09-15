import type { PaymentStatus } from "../order/schema";

/**
 * Payment fields are opaque stubs until Syed locks a provider (3.2 D1).
 * Do not invent `STRIPE_*` / `RAZORPAY_*` env names as final.
 * Do not implement paid-state webhooks in Phase 3.3.
 *
 * PR #10 columns used as a provider-agnostic envelope:
 * `payments.provider`, `provider_order_id`, `provider_payment_id`.
 */

export const PAYMENT_PROVIDER_UNSET = "unset" as const;

export type PaymentProviderStub = {
  /** Opaque vendor key. Not a lock. Never treat integrations.ts "stripe" as final. */
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: PaymentStatus;
};

/** Handoff §20 customer vocabulary. Not PR #10 enum values. */
export const CUSTOMER_PAYMENT_STATES = [
  "PAYMENT_READY",
  "PAYMENT_PROCESSING",
  "PAYMENT_SUCCEEDED",
  "PAYMENT_FAILED",
  "PAYMENT_CANCELLED",
  "PAYMENT_REQUIRES_ACTION",
  "PAYMENT_UNKNOWN",
] as const;
export type CustomerPaymentState = (typeof CUSTOMER_PAYMENT_STATES)[number];

/**
 * Best-effort map from schema enum → handoff UI states.
 * `PAYMENT_REQUIRES_ACTION` has no schema value — stays unused until a provider is locked.
 * Refunds are operational, not a customer "paid" success.
 */
export const SCHEMA_PAYMENT_TO_CUSTOMER: Record<PaymentStatus, CustomerPaymentState> = {
  created: "PAYMENT_READY",
  authorized: "PAYMENT_PROCESSING",
  captured: "PAYMENT_SUCCEEDED",
  failed: "PAYMENT_FAILED",
  cancelled: "PAYMENT_CANCELLED",
  refunded: "PAYMENT_UNKNOWN",
  partially_refunded: "PAYMENT_UNKNOWN",
};

export function customerPaymentState(status: PaymentStatus): CustomerPaymentState {
  return SCHEMA_PAYMENT_TO_CUSTOMER[status];
}

export function paymentStub(row: {
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  status: PaymentStatus;
}): PaymentProviderStub {
  return {
    provider: row.provider.trim() || PAYMENT_PROVIDER_UNSET,
    providerOrderId: row.provider_order_id,
    providerPaymentId: row.provider_payment_id,
    status: row.status,
  };
}

export const PAYMENT_TRUST_RULES = {
  frontendReturnIsNotPaid: true,
  paidRequiresVerifiedProviderConfirmation: true,
  webhooksOutOfScopeForPhase33: true,
  noProviderEnvNamesAsFinal: true,
} as const;
