import { minorToMajorGbp, STORE_CURRENCY } from "@/contracts/money";
import { marketById, marketIdForCountry, resolveConfiguredPaymentProvider } from "@/contracts/markets";
import { getLocalizedPrice } from "@/contracts/pricing";
import { normalizeCountry } from "@/lib/checkout-validate";
import type { CheckoutQuote } from "@/lib/checkout-quote";
import { resolveShippingOptions, type ShippingCatalogue } from "@/lib/shipping/options";

/**
 * Server quote snapshot. Catalogue and FX changes after this is written
 * cannot change the charged GBP total. Tax and discount stay zero, so
 * total is subtotal plus shipping. Subtotal and shipping are localized
 * separately, then added. The current PayPal charge uses the GBP base
 * total. chargeCurrency amounts are stored for a later charge phase.
 * A razorpay mapping is recorded and is not chargeable here.
 */

export type CheckoutQuoteLockLine = {
  variantId: string;
  quantity: number;
  unitPriceMinor: number;
};

export type CheckoutQuoteLock = {
  countryCode: string;
  chargeCurrency: string;
  baseSubtotalMinor: number;
  baseShippingMinor: number;
  chargeSubtotalMinor: number;
  chargeShippingMinor: number;
  chargeTotalMinor: number;
  taxMinor: 0;
  discountMinor: 0;
  fxRateId: string | null;
  fxVersion: number | null;
  fxRate: string | null;
  shippingMethodId: string;
  shippingLabel: string;
  estimatedDelivery: string;
  paymentProvider: "paypal" | "razorpay";
  lines: CheckoutQuoteLockLine[];
};

export type QuoteLockFx = {
  id: string;
  version: number;
  rate: string;
};

export function createCheckoutQuoteLock(input: {
  countryCode: string;
  lines: readonly { variantId: string; quantity: number; unitPriceMinor: number }[];
  fx?: QuoteLockFx | null;
  catalogue?: ShippingCatalogue;
}): CheckoutQuoteLock | null {
  const countryCode = normalizeCountry(input.countryCode);
  const lines = mergeLines(input.lines);
  if (!lines) {
    return null;
  }
  const baseSubtotalMinor = lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const resolved = resolveShippingOptions(countryCode, input.catalogue);
  const option = resolved.status === "priced" ? resolved.options[0] : null;
  if (!option) {
    return null;
  }
  const marketId = marketIdForCountry(countryCode);
  const market = marketId ? marketById(marketId) : null;
  if (!market) {
    return null;
  }
  const paymentProvider = resolveConfiguredPaymentProvider({
    marketId: market.id,
    currency: market.currency,
  });
  if (paymentProvider !== "paypal" && paymentProvider !== "razorpay") {
    return null;
  }
  const localized = localizeParts({
    baseSubtotalMinor,
    baseShippingMinor: option.amountMinor,
    targetCurrency: market.currency,
    fx: input.fx ?? null,
  });
  if (!localized) {
    return null;
  }
  return {
    countryCode,
    chargeCurrency: market.currency,
    baseSubtotalMinor,
    baseShippingMinor: option.amountMinor,
    chargeSubtotalMinor: localized.chargeSubtotalMinor,
    chargeShippingMinor: localized.chargeShippingMinor,
    chargeTotalMinor: localized.chargeTotalMinor,
    taxMinor: 0,
    discountMinor: 0,
    fxRateId: localized.fxRateId,
    fxVersion: localized.fxVersion,
    fxRate: localized.fxRate,
    shippingMethodId: option.methodId,
    shippingLabel: option.label,
    estimatedDelivery: option.estimatedDelivery,
    paymentProvider,
    lines,
  };
}

export function encodeCheckoutQuoteLock(lock: CheckoutQuoteLock): CheckoutQuoteLock {
  return {
    countryCode: lock.countryCode,
    chargeCurrency: lock.chargeCurrency,
    baseSubtotalMinor: lock.baseSubtotalMinor,
    baseShippingMinor: lock.baseShippingMinor,
    chargeSubtotalMinor: lock.chargeSubtotalMinor,
    chargeShippingMinor: lock.chargeShippingMinor,
    chargeTotalMinor: lock.chargeTotalMinor,
    taxMinor: 0,
    discountMinor: 0,
    fxRateId: lock.fxRateId,
    fxVersion: lock.fxVersion,
    fxRate: lock.fxRate,
    shippingMethodId: lock.shippingMethodId,
    shippingLabel: lock.shippingLabel,
    estimatedDelivery: lock.estimatedDelivery,
    paymentProvider: lock.paymentProvider,
    lines: lock.lines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
    })),
  };
}

export function parseCheckoutQuoteLock(raw: unknown): CheckoutQuoteLock | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (record.taxMinor !== 0 || record.discountMinor !== 0) {
    return null;
  }
  if (record.paymentProvider !== "paypal" && record.paymentProvider !== "razorpay") {
    return null;
  }
  if (typeof record.countryCode !== "string" || typeof record.chargeCurrency !== "string") {
    return null;
  }
  if (typeof record.shippingMethodId !== "string" || typeof record.shippingLabel !== "string") {
    return null;
  }
  if (typeof record.estimatedDelivery !== "string" || !record.shippingMethodId) {
    return null;
  }
  const baseSubtotalMinor = asMinor(record.baseSubtotalMinor);
  const baseShippingMinor = asMinor(record.baseShippingMinor);
  const chargeSubtotalMinor = asMinor(record.chargeSubtotalMinor);
  const chargeShippingMinor = asMinor(record.chargeShippingMinor);
  const chargeTotalMinor = asMinor(record.chargeTotalMinor);
  if (
    baseSubtotalMinor == null ||
    baseShippingMinor == null ||
    chargeSubtotalMinor == null ||
    chargeShippingMinor == null ||
    chargeTotalMinor == null
  ) {
    return null;
  }
  const lines = parseLines(record.lines);
  if (!lines) {
    return null;
  }
  const lineSubtotal = lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  if (lineSubtotal !== baseSubtotalMinor) {
    return null;
  }
  const fxRateId = record.fxRateId == null ? null : record.fxRateId;
  const fxRate = record.fxRate == null ? null : record.fxRate;
  const fxVersion = record.fxVersion == null ? null : record.fxVersion;
  if (fxRateId !== null && typeof fxRateId !== "string") {
    return null;
  }
  if (fxRate !== null && typeof fxRate !== "string") {
    return null;
  }
  if (fxVersion !== null && (typeof fxVersion !== "number" || !Number.isInteger(fxVersion))) {
    return null;
  }
  const lock: CheckoutQuoteLock = {
    countryCode: normalizeCountry(record.countryCode),
    chargeCurrency: record.chargeCurrency.trim().toUpperCase(),
    baseSubtotalMinor,
    baseShippingMinor,
    chargeSubtotalMinor,
    chargeShippingMinor,
    chargeTotalMinor,
    taxMinor: 0,
    discountMinor: 0,
    fxRateId,
    fxVersion,
    fxRate,
    shippingMethodId: record.shippingMethodId,
    shippingLabel: record.shippingLabel,
    estimatedDelivery: record.estimatedDelivery,
    paymentProvider: record.paymentProvider,
    lines,
  };
  return chargesMatch(lock) ? lock : null;
}

export function quoteLockForCountry(
  lock: CheckoutQuoteLock | null,
  countryCode: string,
): CheckoutQuoteLock | null {
  if (!lock || lock.countryCode !== normalizeCountry(countryCode)) {
    return null;
  }
  return lock;
}

export function lockCoversLines(
  lock: CheckoutQuoteLock,
  lines: readonly { variantId: string; quantity: number }[],
): boolean {
  return lineKey(lock.lines) === lineKey(lines);
}

export function checkoutQuoteFromLock(lock: CheckoutQuoteLock): CheckoutQuote {
  const totalMinor = lock.baseSubtotalMinor + lock.baseShippingMinor;
  return {
    currency: STORE_CURRENCY,
    subtotalMinor: lock.baseSubtotalMinor,
    shippingMinor: lock.baseShippingMinor,
    totalMinor,
    subtotal: minorToMajorGbp(lock.baseSubtotalMinor),
    shipping: minorToMajorGbp(lock.baseShippingMinor),
    total: minorToMajorGbp(totalMinor),
    shippingStatus: "priced",
    shippingLabel: lock.shippingLabel,
    estimatedDelivery: lock.estimatedDelivery,
  };
}

export function quoteMatchesLock(lock: CheckoutQuoteLock, quote: CheckoutQuote): boolean {
  return (
    quote.currency === STORE_CURRENCY &&
    quote.shippingStatus === "priced" &&
    quote.subtotalMinor === lock.baseSubtotalMinor &&
    quote.shippingMinor === lock.baseShippingMinor &&
    quote.totalMinor === lock.baseSubtotalMinor + lock.baseShippingMinor
  );
}

export function displayLineTotal(
  lock: CheckoutQuoteLock | null,
  item: { variantId?: string; quantity: number; lineTotal: number },
): number {
  if (!lock || !item.variantId) {
    return item.lineTotal;
  }
  const line = lock.lines.find((entry) => entry.variantId === item.variantId);
  if (!line || line.quantity !== item.quantity) {
    return item.lineTotal;
  }
  return minorToMajorGbp(line.unitPriceMinor * item.quantity);
}

function localizeParts(input: {
  baseSubtotalMinor: number;
  baseShippingMinor: number;
  targetCurrency: string;
  fx: QuoteLockFx | null;
}): {
  chargeSubtotalMinor: number;
  chargeShippingMinor: number;
  chargeTotalMinor: number;
  fxRateId: string | null;
  fxVersion: number | null;
  fxRate: string | null;
} | null {
  const gbp = input.targetCurrency === STORE_CURRENCY;
  if (!gbp && (!input.fx?.id || !input.fx.rate || !Number.isInteger(input.fx.version))) {
    return null;
  }
  const shared = gbp
    ? {}
    : {
        fxRate: input.fx?.rate,
        fxRateId: input.fx?.id,
        fxVersion: input.fx?.version,
      };
  const subtotal = getLocalizedPrice({
    baseAmountMinor: input.baseSubtotalMinor,
    baseCurrency: STORE_CURRENCY,
    targetCurrency: input.targetCurrency,
    ...shared,
  });
  const shipping = getLocalizedPrice({
    baseAmountMinor: input.baseShippingMinor,
    baseCurrency: STORE_CURRENCY,
    targetCurrency: input.targetCurrency,
    ...shared,
  });
  if (!subtotal.ok || !shipping.ok) {
    return null;
  }
  if (
    subtotal.price.fxRateId !== shipping.price.fxRateId ||
    subtotal.price.fxVersion !== shipping.price.fxVersion ||
    subtotal.price.rate !== shipping.price.rate
  ) {
    return null;
  }
  const chargeTotalMinor = subtotal.price.amountMinor + shipping.price.amountMinor;
  if (!Number.isSafeInteger(chargeTotalMinor)) {
    return null;
  }
  if (gbp && (subtotal.price.fxRateId || subtotal.price.rate || subtotal.price.fxVersion)) {
    return null;
  }
  return {
    chargeSubtotalMinor: subtotal.price.amountMinor,
    chargeShippingMinor: shipping.price.amountMinor,
    chargeTotalMinor,
    fxRateId: subtotal.price.fxRateId,
    fxVersion: subtotal.price.fxVersion,
    fxRate: subtotal.price.rate,
  };
}

function chargesMatch(lock: CheckoutQuoteLock): boolean {
  const marketId = marketIdForCountry(lock.countryCode);
  const market = marketId ? marketById(marketId) : null;
  if (!market || market.currency !== lock.chargeCurrency) {
    return false;
  }
  if (resolveConfiguredPaymentProvider({ marketId: market.id, currency: market.currency }) !== lock.paymentProvider) {
    return false;
  }
  const localized = localizeParts({
    baseSubtotalMinor: lock.baseSubtotalMinor,
    baseShippingMinor: lock.baseShippingMinor,
    targetCurrency: lock.chargeCurrency,
    fx:
      lock.fxRateId && lock.fxRate && lock.fxVersion
        ? { id: lock.fxRateId, rate: lock.fxRate, version: lock.fxVersion }
        : null,
  });
  if (!localized) {
    return false;
  }
  return (
    localized.chargeSubtotalMinor === lock.chargeSubtotalMinor &&
    localized.chargeShippingMinor === lock.chargeShippingMinor &&
    localized.chargeTotalMinor === lock.chargeTotalMinor &&
    localized.fxRateId === lock.fxRateId &&
    localized.fxVersion === lock.fxVersion &&
    localized.fxRate === lock.fxRate &&
    lock.chargeTotalMinor === lock.chargeSubtotalMinor + lock.chargeShippingMinor &&
    lock.taxMinor === 0 &&
    lock.discountMinor === 0
  );
}

function mergeLines(
  lines: readonly { variantId: string; quantity: number; unitPriceMinor: number }[],
): CheckoutQuoteLockLine[] | null {
  if (lines.length === 0) {
    return null;
  }
  const merged = new Map<string, CheckoutQuoteLockLine>();
  for (const line of lines) {
    if (!line.variantId || !Number.isInteger(line.quantity) || line.quantity < 1) {
      return null;
    }
    if (!Number.isInteger(line.unitPriceMinor) || line.unitPriceMinor < 0) {
      return null;
    }
    const existing = merged.get(line.variantId);
    if (existing && existing.unitPriceMinor !== line.unitPriceMinor) {
      return null;
    }
    const quantity = (existing?.quantity ?? 0) + line.quantity;
    if (!Number.isSafeInteger(line.unitPriceMinor * quantity)) {
      return null;
    }
    merged.set(line.variantId, {
      variantId: line.variantId,
      quantity,
      unitPriceMinor: line.unitPriceMinor,
    });
  }
  return [...merged.values()];
}

function parseLines(raw: unknown): CheckoutQuoteLockLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const lines: { variantId: string; quantity: number; unitPriceMinor: number }[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return null;
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.variantId !== "string") {
      return null;
    }
    const quantity = record.quantity;
    const unitPriceMinor = record.unitPriceMinor;
    if (typeof quantity !== "number" || typeof unitPriceMinor !== "number") {
      return null;
    }
    lines.push({ variantId: record.variantId, quantity, unitPriceMinor });
  }
  return mergeLines(lines);
}

function asMinor(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || !Number.isSafeInteger(value)) {
    return null;
  }
  return value;
}

function lineKey(lines: readonly { variantId: string; quantity: number }[]): string {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.variantId || !Number.isInteger(line.quantity) || line.quantity < 1) {
      return "";
    }
    totals.set(line.variantId, (totals.get(line.variantId) ?? 0) + line.quantity);
  }
  return [...totals.entries()]
    .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
    .map(([variantId, quantity]) => `${variantId}:${quantity}`)
    .join("|");
}
