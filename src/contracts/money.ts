/**
 * Monetary contract for PR #10 / live catalogue.
 *
 * Database stores integer minor units (`*_minor`, GBP pence).
 * Approved storefront `Product.price` and `formatGbp()` use major units.
 * Never send floating-point values to Postgres. Never trust client totals.
 */

export const STORE_CURRENCY = "GBP" as const;
export type StoreCurrency = typeof STORE_CURRENCY;

export type MoneyMinor = {
  amountMinor: number;
  currency: StoreCurrency;
};

export type MoneyMajor = {
  amount: number;
  currency: StoreCurrency;
};

export function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function assertMinorUnits(amountMinor: number, label = "amount"): void {
  if (!isNonNegativeInteger(amountMinor)) {
    throw new Error(`${label} must be a non-negative integer minor-unit amount.`);
  }
}

/** 4900 → 49; 4999 → 49.99. Does not round or invent. */
export function minorToMajorGbp(amountMinor: number): number {
  assertMinorUnits(amountMinor);
  return amountMinor / 100;
}

/** 49 → 4900; 49.99 → 4999. Rejects values that are not exact pence. */
export function majorToMinorGbp(amountMajor: number): number {
  if (!Number.isFinite(amountMajor) || amountMajor < 0) {
    throw new Error("Major-unit amount must be a finite non-negative number.");
  }
  const minor = Math.round(amountMajor * 100);
  if (Math.abs(amountMajor * 100 - minor) > 1e-8) {
    throw new Error("Major-unit amount must be exact to one penny.");
  }
  return minor;
}

export function moneyMinor(amountMinor: number): MoneyMinor {
  assertMinorUnits(amountMinor);
  return { amountMinor, currency: STORE_CURRENCY };
}

export function moneyMinorToMajor(value: MoneyMinor): MoneyMajor {
  return {
    amount: minorToMajorGbp(value.amountMinor),
    currency: value.currency,
  };
}

export function lineTotalMinor(unitPriceMinor: number, quantity: number): number {
  assertMinorUnits(unitPriceMinor, "unit price");
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("quantity must be a positive integer.");
  }
  return unitPriceMinor * quantity;
}
