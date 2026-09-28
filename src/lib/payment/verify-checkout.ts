import "server-only";

/**
 * Legacy Razorpay checkout verify — retired.
 * Use `verifyPayPalClientReturn` from `@/lib/paypal/verify-client-return`.
 */
export {
  verifyPayPalClientReturn as verifyRazorpayCheckoutPayment,
  type UntrustedPayPalClientReturn as UntrustedCheckoutCallback,
  type VerifyPayPalClientReturnResult as VerifyCheckoutResult,
  type VerifyPayPalClientRejectReason as VerifyCheckoutRejectReason,
  type VerifyPayPalClientReturnDependencies as VerifyCheckoutDependencies,
} from "@/lib/paypal/verify-client-return";
