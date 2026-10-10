import { minorToMajorGbp } from "@/contracts/money";

export function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatGbpMinor(amountMinor: number): string {
  return formatGbp(minorToMajorGbp(amountMinor));
}

/**
 * Payment-currency minor units. GBP, EUR, USD, and INR keep their own symbols.
 * Any other code is shown with the code, never as pounds.
 */
export function formatChargeMinor(amountMinor: number, currency: string): string {
  if (!Number.isInteger(amountMinor)) {
    return `${amountMinor} ${currency}`;
  }
  if (currency === "GBP" || currency === "EUR" || currency === "USD" || currency === "INR") {
    const locale = currency === "INR" ? "en-IN" : currency === "USD" ? "en-US" : "en-GB";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  }
  return `${amountMinor} ${currency}`;
}

/** Frozen India charge. Paise in, rupees on screen. */
export function formatInrMinor(amountMinor: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}
