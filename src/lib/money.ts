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

/** Frozen India charge. Paise in, rupees on screen. */
export function formatInrMinor(amountMinor: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}
