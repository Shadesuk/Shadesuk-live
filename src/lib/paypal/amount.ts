import { STORE_CURRENCY } from "@/contracts/money";

/**
 * PayPal Orders v2 Money `value` is a decimal string.
 * GBP is not a zero-digit currency — use exactly two fractional digits.
 * SHADESUK amounts are integer pence. Convert with integer math only;
 * never use floating-point currency arithmetic.
 */
const GBP_VALUE_PATTERN = /^(\d+)\.(\d{2})$/;

export function gbpMinorToPayPalValue(amountMinor: number): string | null {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    return null;
  }
  const major = Math.floor(amountMinor / 100);
  const frac = amountMinor % 100;
  return `${major}.${String(frac).padStart(2, "0")}`;
}

export function payPalValueToGbpMinor(
  value: unknown,
  currency: unknown,
): number | null {
  if (typeof currency !== "string" || currency.trim().toUpperCase() !== STORE_CURRENCY) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  const match = GBP_VALUE_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }
  const major = Number.parseInt(match[1], 10);
  const frac = Number.parseInt(match[2], 10);
  if (!Number.isInteger(major) || !Number.isInteger(frac) || frac < 0 || frac > 99) {
    return null;
  }
  return major * 100 + frac;
}
