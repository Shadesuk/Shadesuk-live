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
