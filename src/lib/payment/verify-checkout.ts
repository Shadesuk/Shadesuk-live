import "server-only";

/**
 * Checkout verify entry — PayPal client-return reconcile.
 * Prefer importing `verifyPayPalClientReturn` directly from `@/lib/paypal/verify-client-return`.
 */
export {
  verifyPayPalClientReturn,
  type UntrustedPayPalClientReturn,
  type VerifyPayPalClientReturnResult,
  type VerifyPayPalClientRejectReason,
  type VerifyPayPalClientReturnDependencies,
} from "@/lib/paypal/verify-client-return";
