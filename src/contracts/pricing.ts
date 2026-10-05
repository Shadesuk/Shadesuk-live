/**
 * Central localized-price conversion.
 *
 * Catalogue amounts stay integer GBP minor units. This is the only FX
 * rounding path. The quote lock calls it. The checkout quote module does not.
 * V1 tax and discount are
 * zero and are not arguments here.
 *
 * Rounding is half away from zero on a positive rational. The rate is a
 * decimal string, never a binary float.
 */

import { CATALOGUE_BASE_CURRENCY, V1_CURRENCIES, type V1CurrencyCode } from "./markets";

export const LOCALIZED_PRICE_REASONS = [
  "invalid_amount",
  "unsupported_currency",
  "missing_rate",
  "invalid_rate",
] as const;

export type LocalizedPriceReason = (typeof LOCALIZED_PRICE_REASONS)[number];

export type DecimalRate = {
  /** Provider literal, used when persisting. */
  text: string;
  numerator: bigint;
  denominator: bigint;
};

export type LocalizedPrice = {
  amountMinor: number;
  currency: V1CurrencyCode;
  baseAmountMinor: number;
  baseCurrency: typeof CATALOGUE_BASE_CURRENCY;
  /** Null when the target is the catalogue currency and no conversion ran. */
  fxRateId: string | null;
  fxVersion: number | null;
  /** Null for a GBP identity conversion. */
  rate: string | null;
};

export type LocalizedPriceResult =
  | { ok: true; price: LocalizedPrice }
  | { ok: false; reason: LocalizedPriceReason };

const DECIMAL_RATE = /^(0|[1-9]\d{0,9})(?:\.(\d{1,10}))?$/;

export function isV1CurrencyCode(value: string): value is V1CurrencyCode {
  return V1_CURRENCIES.some((currency) => currency.code === value);
}

/** Accepts a positive decimal with at most 10 fractional digits. Rejects zero. */
export function parsePositiveDecimalRate(value: string): DecimalRate | null {
  const match = DECIMAL_RATE.exec(value);
  if (!match) {
    return null;
  }
  const whole = match[1] ?? "";
  const fraction = match[2] ?? "";
  if (whole === "0" && /^0*$/.test(fraction)) {
    return null;
  }
  const numerator = BigInt(whole + fraction);
  const denominator = BigInt(10) ** BigInt(fraction.length);
  if (numerator <= BigInt(0) || denominator <= BigInt(0)) {
    return null;
  }
  return { text: value, numerator, denominator };
}

/**
 * Multiply integer minor units by a positive decimal rate and round half up.
 * 100 minor × 1.005 → 101. 1 minor × 0.5 → 1.
 */
export function multiplyMinorByRateHalfUp(amountMinor: number, rate: DecimalRate): number | null {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    return null;
  }
  if (amountMinor === 0) {
    return 0;
  }
  const product = BigInt(amountMinor) * rate.numerator;
  const rounded = (product + rate.denominator / BigInt(2)) / rate.denominator;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  return Number(rounded);
}

export function getLocalizedPrice(input: {
  baseAmountMinor: number;
  baseCurrency: string;
  targetCurrency: string;
  fxRate?: string | null;
  fxRateId?: string | null;
  fxVersion?: number | null;
}): LocalizedPriceResult {
  if (!Number.isInteger(input.baseAmountMinor) || input.baseAmountMinor < 0) {
    return { ok: false, reason: "invalid_amount" };
  }
  if (input.baseCurrency.trim().toUpperCase() !== CATALOGUE_BASE_CURRENCY) {
    return { ok: false, reason: "unsupported_currency" };
  }
  const target = input.targetCurrency.trim().toUpperCase();
  if (!isV1CurrencyCode(target)) {
    return { ok: false, reason: "unsupported_currency" };
  }
  if (target === CATALOGUE_BASE_CURRENCY) {
    return {
      ok: true,
      price: {
        amountMinor: input.baseAmountMinor,
        currency: target,
        baseAmountMinor: input.baseAmountMinor,
        baseCurrency: CATALOGUE_BASE_CURRENCY,
        fxRateId: null,
        fxVersion: null,
        rate: null,
      },
    };
  }
  const rateText = input.fxRate?.trim() ?? "";
  const rate = parsePositiveDecimalRate(rateText);
  if (!rate) {
    return { ok: false, reason: rateText ? "invalid_rate" : "missing_rate" };
  }
  const amountMinor = multiplyMinorByRateHalfUp(input.baseAmountMinor, rate);
  if (amountMinor == null) {
    return { ok: false, reason: "invalid_amount" };
  }
  const version = input.fxVersion;
  return {
    ok: true,
    price: {
      amountMinor,
      currency: target,
      baseAmountMinor: input.baseAmountMinor,
      baseCurrency: CATALOGUE_BASE_CURRENCY,
      fxRateId: input.fxRateId ?? null,
      fxVersion: typeof version === "number" && Number.isInteger(version) ? version : null,
      rate: rate.text,
    },
  };
}
