/** Razorpay ids used in API paths. Reject anything that is not a single token. */
export const RAZORPAY_PAYMENT_ID = /^pay_[A-Za-z0-9]+$/;
export const RAZORPAY_ORDER_ID = /^order_[A-Za-z0-9]+$/;

export function isRazorpayPaymentId(value: string): boolean {
  return RAZORPAY_PAYMENT_ID.test(value);
}

export function isRazorpayOrderId(value: string): boolean {
  return RAZORPAY_ORDER_ID.test(value);
}
