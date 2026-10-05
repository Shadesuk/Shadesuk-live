import "server-only";

import { STORE_CURRENCY } from "@/contracts/money";
import { marketById, marketIdForCountry } from "@/contracts/markets";
import { loadLatestFxRates } from "@/lib/fx/store";
import {
  createCheckoutQuoteLock,
  type CheckoutQuoteLock,
  type QuoteLockFx,
} from "@/lib/checkout-quote-lock";
import { normalizeCountry } from "@/lib/checkout-validate";

/**
 * Reads the active FX row when the market currency is not GBP.
 * A missing or unreadable rate does not invent a price.
 */
export async function freezeCheckoutQuoteLock(input: {
  countryCode: string;
  lines: readonly { variantId: string; quantity: number; unitPriceMinor: number }[];
}): Promise<CheckoutQuoteLock | null> {
  const countryCode = normalizeCountry(input.countryCode);
  const marketId = marketIdForCountry(countryCode);
  const market = marketId ? marketById(marketId) : null;
  if (!market) {
    return null;
  }
  let fx: QuoteLockFx | null = null;
  if (market.currency !== STORE_CURRENCY) {
    try {
      const rates = await loadLatestFxRates();
      const row = rates.find((rate) => rate.quoteCurrency === market.currency);
      if (!row) {
        return null;
      }
      fx = { id: row.id, version: row.version, rate: row.rate };
    } catch {
      return null;
    }
  }
  return createCheckoutQuoteLock({ countryCode, lines: input.lines, fx });
}
