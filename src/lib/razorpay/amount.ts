import { STORE_CURRENCY } from "@/contracts/money";

/**
 * Razorpay amounts are integer currency subunits.
 * SHADESUK `*_minor` values are GBP pence. For GBP these are the same integer;
 * do not convert through major units or floats.
 */
export function razorpaySubunitToGbpMinor(
  amount: unknown,
  currency: unknown,
): number | null {
  if (typeof currency !== "string" || currency.trim().toUpperCase() !== STORE_CURRENCY) {
    return null;
  }
  if (typeof amount === "number" && Number.isInteger(amount) && amount >= 0) {
    return amount;
  }
  if (typeof amount === "string" && /^\d+$/.test(amount.trim())) {
    return Number.parseInt(amount.trim(), 10);
  }
  return null;
}
