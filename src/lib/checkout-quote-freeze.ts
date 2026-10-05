import "server-only";

import { STORE_CURRENCY } from "@/contracts/money";
import { loadLatestFxRates } from "@/lib/fx/store";
import {
  createCheckoutQuoteLock,
  type CheckoutQuoteLock,
  type QuoteLockFx,
} from "@/lib/checkout-quote-lock";
import { normalizeCountry } from "@/lib/checkout-validate";
import { resolvePaymentRoute } from "@/lib/payment/payment-route";

/**
 * Reads the active FX row when the charge currency is not GBP.
 * A missing or unreadable rate does not invent a price.
 */
export async function freezeCheckoutQuoteLock(input: {
  countryCode: string;
  lines: readonly { variantId: string; quantity: number; unitPriceMinor: number }[];
}): Promise<CheckoutQuoteLock | null> {
  const countryCode = normalizeCountry(input.countryCode);
  const route = resolvePaymentRoute(countryCode);
  if (!route) {
    return null;
  }
  let fx: QuoteLockFx | null = null;
  if (route.paymentCurrency !== STORE_CURRENCY) {
    try {
      const rates = await loadLatestFxRates();
      const row = rates.find((rate) => rate.quoteCurrency === route.paymentCurrency);
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
