/**
 * Customer-facing payment method presentation for checkout.
 * Presentation only. No SDK, charges, or merchant API calls.
 *
 * Enable a reserved method by setting `enabled: true` after PayPal confirms it.
 * Optional `markSrc` is for approved brand artwork later — do not invent logos.
 */

export const PAYMENT_METHOD_IDS = [
  "paypal",
  "razorpay",
  "visa",
  "mastercard",
  "amex",
  "apple_pay",
  "google_pay",
  "klarna",
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

export type PaymentMethod = {
  id: PaymentMethodId;
  label: string;
  enabled: boolean;
  markSrc?: string;
};

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  { id: "paypal", label: "PayPal", enabled: true },
  { id: "razorpay", label: "Razorpay", enabled: true },
  { id: "visa", label: "Visa", enabled: false, markSrc: "/payment/visa.jpg" },
  { id: "mastercard", label: "Mastercard", enabled: false, markSrc: "/payment/mastercard.jpg" },
  { id: "amex", label: "American Express", enabled: false, markSrc: "/payment/amex.png" },
  { id: "apple_pay", label: "Apple Pay", enabled: false },
  { id: "google_pay", label: "Google Pay", enabled: false },
  { id: "klarna", label: "Klarna", enabled: false },
];

export function enabledPaymentMethods(
  methods: readonly PaymentMethod[] = PAYMENT_METHODS,
): PaymentMethod[] {
  return methods.filter((method) => method.enabled);
}
