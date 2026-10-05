import { PEGGED_PER_USD } from "@/contracts/countries";
import { majorToMinorGbp } from "@/contracts/money";
import { multiplyMinorByRateHalfUp, parsePositiveDecimalRate, type DecimalRate } from "@/contracts/pricing";
import { resolvePaymentRoute } from "@/lib/payment/payment-route";

/**
 * Storefront display amounts are whole major units.
 * Review charge amounts keep cents. Catalogue amounts stay GBP minor units.
 * A missing rate falls back to whole GBP. It does not invent a price.
 */

export type PublicFxRate = {
  currency: string;
  rate: string;
};

const ZERO_DECIMAL = new Set(["JPY", "KRW"]);

export function currencyExponent(currency: string): number {
  return ZERO_DECIMAL.has(currency) ? 0 : 2;
}

/** Half-up to a whole major unit. 13742 pence → 13700. 13750 → 13800. */
export function roundMinorToWholeMajor(amountMinor: number, exponent = 2): number | null {
  if (!Number.isInteger(amountMinor) || amountMinor < 0 || !Number.isSafeInteger(amountMinor)) {
    return null;
  }
  if (exponent <= 0) {
    return amountMinor;
  }
  const unit = 10 ** exponent;
  const major = Math.floor((amountMinor + unit / 2) / unit);
  const rounded = major * unit;
  return Number.isSafeInteger(rounded) ? rounded : null;
}

export function formatDisplayMinor(amountMinor: number, currency: string): string {
  const rounded = roundMinorToWholeMajor(amountMinor, currencyExponent(currency));
  if (rounded == null) {
    return "";
  }
  const exponent = currencyExponent(currency);
  const major = exponent === 0 ? rounded : rounded / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(major);
}

/** Charge figure with cents, for Review. */
export function formatChargeMinor(amountMinor: number, currency: string): string {
  const exponent = currencyExponent(currency);
  const major = exponent === 0 ? amountMinor : amountMinor / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: exponent === 0 ? 0 : 2,
    maximumFractionDigits: exponent === 0 ? 0 : 2,
  }).format(major);
}

/** "USD 82.40" — the Review disclosure, not a warning. */
export function formatChargeCode(amountMinor: number, currency: string): string {
  const exponent = currencyExponent(currency);
  if (exponent === 0) {
    return `${currency} ${amountMinor}`;
  }
  const major = Math.floor(amountMinor / 100);
  const fraction = String(amountMinor % 100).padStart(2, "0");
  return `${currency} ${major}.${fraction}`;
}

export function chargeDisclosure(input: {
  displayCurrency: string;
  chargeCurrency: string;
  chargeMinor: number;
  provider: "paypal" | "razorpay";
}): string | null {
  if (input.displayCurrency === input.chargeCurrency) {
    return null;
  }
  const name = input.provider === "razorpay" ? "Razorpay" : "PayPal";
  return `You'll be charged ${formatChargeCode(input.chargeMinor, input.chargeCurrency)} by ${name}.`;
}

export function formatDisplayGbpMinor(
  gbpMinor: number,
  currency: string,
  rates: readonly PublicFxRate[],
): string {
  const shown = displayMinorFromGbp(gbpMinor, currency, rates);
  if (shown == null) {
    const fallback = roundMinorToWholeMajor(gbpMinor, 2);
    return fallback == null ? "" : formatDisplayMinor(fallback, "GBP");
  }
  return formatDisplayMinor(shown, currency);
}

export function formatStorefrontMinor(
  gbpMinor: number,
  country: string,
  rates: readonly PublicFxRate[],
): string {
  const route = resolvePaymentRoute(country);
  return formatDisplayGbpMinor(gbpMinor, route?.displayCurrency ?? "GBP", rates);
}

export function formatStorefrontMajor(
  amountMajor: number,
  country: string,
  rates: readonly PublicFxRate[],
): string {
  try {
    return formatStorefrontMinor(majorToMinorGbp(amountMajor), country, rates);
  } catch {
    return "";
  }
}

export function presentCheckoutAmount(input: {
  gbpMinor: number;
  chargeMinor?: number | null;
  displayCurrency: string;
  chargeCurrency: string;
  rates: readonly PublicFxRate[];
  cents: boolean;
}): string {
  if (
    input.cents &&
    input.displayCurrency === input.chargeCurrency &&
    input.chargeMinor != null &&
    Number.isInteger(input.chargeMinor)
  ) {
    return formatChargeMinor(input.chargeMinor, input.chargeCurrency);
  }
  return formatDisplayGbpMinor(input.gbpMinor, input.displayCurrency, input.rates);
}

export function displayMinorFromGbp(
  gbpMinor: number,
  currency: string,
  rates: readonly PublicFxRate[],
): number | null {
  if (!Number.isInteger(gbpMinor) || gbpMinor < 0) {
    return null;
  }
  if (currency === "GBP") {
    return roundMinorToWholeMajor(gbpMinor, 2);
  }
  const rate = rateForDisplay(currency, rates);
  if (!rate) {
    return null;
  }
  const converted = convertGbpMinor(gbpMinor, currency, rate);
  if (converted == null) {
    return null;
  }
  return roundMinorToWholeMajor(converted, currencyExponent(currency));
}

function convertGbpMinor(gbpMinor: number, currency: string, rate: DecimalRate): number | null {
  const scale = BigInt(10) ** BigInt(Math.max(0, 2 - currencyExponent(currency)));
  return multiplyMinorByRateHalfUp(gbpMinor, {
    text: rate.text,
    numerator: rate.numerator,
    denominator: rate.denominator * scale,
  });
}

function rateForDisplay(currency: string, rates: readonly PublicFxRate[]): DecimalRate | null {
  const peg = PEGGED_PER_USD[currency];
  if (peg) {
    const usd = rates.find((row) => row.currency === "USD")?.rate;
    const usdRate = usd ? parsePositiveDecimalRate(usd) : null;
    const pegRate = parsePositiveDecimalRate(peg);
    if (!usdRate || !pegRate) {
      return null;
    }
    return {
      text: peg,
      numerator: usdRate.numerator * pegRate.numerator,
      denominator: usdRate.denominator * pegRate.denominator,
    };
  }
  const row = rates.find((entry) => entry.currency === currency);
  return row ? parsePositiveDecimalRate(row.rate) : null;
}
