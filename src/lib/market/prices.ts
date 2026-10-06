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

/**
 * Checkout figures.
 * When the display currency is the charge currency, show exact minor units
 * with cents: locked chargeMinor if present, otherwise GBP converted at the
 * rate and kept to the cent (465 pence stays £4.65). Shop pages do not use
 * this. A display-only currency (AED while the charge is USD) stays on whole
 * units; the charge sentence carries the exact amount.
 */
export function presentCheckoutAmount(input: {
  gbpMinor: number;
  chargeMinor?: number | null;
  displayCurrency: string;
  chargeCurrency: string;
  rates: readonly PublicFxRate[];
  cents: boolean;
}): string {
  const chargeCents = input.cents && input.displayCurrency === input.chargeCurrency;
  if (!chargeCents) {
    return formatDisplayGbpMinor(input.gbpMinor, input.displayCurrency, input.rates);
  }
  if (input.chargeMinor != null && Number.isInteger(input.chargeMinor) && input.chargeMinor >= 0) {
    return formatChargeMinor(input.chargeMinor, input.chargeCurrency);
  }
  const exact = exactMinorFromGbp(input.gbpMinor, input.displayCurrency, input.rates);
  if (exact == null) {
    return Number.isInteger(input.gbpMinor) && input.gbpMinor >= 0
      ? formatChargeMinor(input.gbpMinor, "GBP")
      : "";
  }
  return formatChargeMinor(exact, input.displayCurrency);
}

type PresentedMinor = {
  minor: number;
  currency: string;
};

/**
 * One checkout line as shown.
 * Charge currency: exact minor units (locked charge, otherwise GBP converted
 * and kept to the cent). Display-only currency: whole major units.
 * A missing rate falls back to whole GBP. It does not invent a price.
 */
export function presentedCheckoutMinor(input: {
  gbpMinor: number;
  chargeMinor?: number | null;
  displayCurrency: string;
  chargeCurrency: string;
  rates: readonly PublicFxRate[];
}): PresentedMinor | null {
  const cents = input.displayCurrency === input.chargeCurrency;
  if (!cents) {
    const shown = displayMinorFromGbp(input.gbpMinor, input.displayCurrency, input.rates);
    if (shown != null) {
      return { minor: shown, currency: input.displayCurrency };
    }
    const fallback = roundMinorToWholeMajor(input.gbpMinor, 2);
    return fallback == null ? null : { minor: fallback, currency: "GBP" };
  }
  if (input.chargeMinor != null && Number.isInteger(input.chargeMinor) && input.chargeMinor >= 0) {
    return { minor: input.chargeMinor, currency: input.chargeCurrency };
  }
  const exact = exactMinorFromGbp(input.gbpMinor, input.displayCurrency, input.rates);
  if (exact != null) {
    return { minor: exact, currency: input.displayCurrency };
  }
  if (Number.isInteger(input.gbpMinor) && input.gbpMinor >= 0) {
    return { minor: input.gbpMinor, currency: "GBP" };
  }
  return null;
}

/**
 * Checkout total. Each part is converted (or whole-rounded) on its own, then
 * the parts are added. The GBP grand total is not converted as one figure,
 * so a 1-minor rounding gap cannot disagree with the quote lock.
 */
export function sumPresentedCheckoutMinors(input: {
  parts: readonly { gbpMinor: number; chargeMinor?: number | null }[];
  displayCurrency: string;
  chargeCurrency: string;
  rates: readonly PublicFxRate[];
}): PresentedMinor | null {
  if (input.parts.length === 0) {
    return null;
  }
  let total = 0;
  let currency: string | null = null;
  for (const part of input.parts) {
    const presented = presentedCheckoutMinor({
      gbpMinor: part.gbpMinor,
      chargeMinor: part.chargeMinor,
      displayCurrency: input.displayCurrency,
      chargeCurrency: input.chargeCurrency,
      rates: input.rates,
    });
    if (!presented) {
      return null;
    }
    if (currency == null) {
      currency = presented.currency;
    } else if (currency !== presented.currency) {
      return null;
    }
    total += presented.minor;
    if (!Number.isSafeInteger(total)) {
      return null;
    }
  }
  return currency == null ? null : { minor: total, currency };
}

export function presentCheckoutPartsTotal(input: {
  parts: readonly { gbpMinor: number; chargeMinor?: number | null }[];
  displayCurrency: string;
  chargeCurrency: string;
  rates: readonly PublicFxRate[];
}): string {
  const summed = sumPresentedCheckoutMinors(input);
  if (!summed) {
    return "";
  }
  const cents = input.displayCurrency === input.chargeCurrency;
  if (summed.currency === "GBP" && input.displayCurrency !== "GBP") {
    return cents ? formatChargeMinor(summed.minor, "GBP") : formatDisplayMinor(summed.minor, "GBP");
  }
  if (cents) {
    return formatChargeMinor(summed.minor, input.chargeCurrency);
  }
  return formatDisplayMinor(summed.minor, input.displayCurrency);
}

/** GBP minor units converted to the target currency, kept to the cent. */
function exactMinorFromGbp(
  gbpMinor: number,
  currency: string,
  rates: readonly PublicFxRate[],
): number | null {
  if (!Number.isInteger(gbpMinor) || gbpMinor < 0) {
    return null;
  }
  if (currency === "GBP") {
    return gbpMinor;
  }
  const rate = rateForDisplay(currency, rates);
  if (!rate) {
    return null;
  }
  return convertGbpMinor(gbpMinor, currency, rate);
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
