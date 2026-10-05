import { isEuMember, supportedCountry } from "@/contracts/countries";
import { normalizeCountry } from "@/lib/checkout-validate";

/**
 * Server-authoritative payment route.
 * India charges INR on Razorpay. The UK charges GBP on PayPal.
 * EU members charge EUR on PayPal. Every other supported country
 * displays its local currency and charges USD on PayPal.
 */

export type PayPalChargeCurrency = "GBP" | "EUR" | "USD";
export type ChargeCurrency = PayPalChargeCurrency | "INR";
export type PaymentRouteProvider = "paypal" | "razorpay";

export type PaymentRoute = {
  countryCode: string;
  countryName: string;
  displayCurrency: string;
  paymentCurrency: ChargeCurrency;
  provider: PaymentRouteProvider;
};

export function isPayPalChargeCurrency(value: string): value is PayPalChargeCurrency {
  return value === "GBP" || value === "EUR" || value === "USD";
}

export function isChargeCurrency(value: string): value is ChargeCurrency {
  return isPayPalChargeCurrency(value) || value === "INR";
}

export function resolvePaymentRoute(country: string): PaymentRoute | null {
  const countryCode = normalizeCountry(country);
  const row = supportedCountry(countryCode);
  if (!row) {
    return null;
  }
  if (countryCode === "IN") {
    return {
      countryCode,
      countryName: row.name,
      displayCurrency: "INR",
      paymentCurrency: "INR",
      provider: "razorpay",
    };
  }
  if (countryCode === "GB") {
    return {
      countryCode,
      countryName: row.name,
      displayCurrency: "GBP",
      paymentCurrency: "GBP",
      provider: "paypal",
    };
  }
  if (isEuMember(countryCode)) {
    return {
      countryCode,
      countryName: row.name,
      displayCurrency: "EUR",
      paymentCurrency: "EUR",
      provider: "paypal",
    };
  }
  return {
    countryCode,
    countryName: row.name,
    displayCurrency: row.currency,
    paymentCurrency: "USD",
    provider: "paypal",
  };
}
