/**
 * V1 market, shipping, and payment-mapping configuration.
 *
 * The database seed in
 * supabase/migrations/20261005160000_international_market_config.sql
 * must match this module. Checkout does not import it.
 *
 * Payment provider names are mapping data for a later phase.
 * This module does not load a payment SDK, create a charge, or call FX.
 * Catalogue prices stay GBP. The customer-facing charge currencies are the
 * market currencies below. Checkout still charges GBP until a later phase.
 * V1 tax and discount are zero, so the order total stays subtotal plus shipping.
 * International shipping zones have no price.
 * A later quote stores fx_rates.id. This module does not price from FX.
 */

export const CATALOGUE_BASE_CURRENCY = "GBP" as const;

export const V1_CURRENCIES = [
  { code: "GBP", name: "Pound sterling", minorUnitExponent: 2, isCatalogueBase: true },
  { code: "EUR", name: "Euro", minorUnitExponent: 2, isCatalogueBase: false },
  { code: "USD", name: "US dollar", minorUnitExponent: 2, isCatalogueBase: false },
  { code: "INR", name: "Indian rupee", minorUnitExponent: 2, isCatalogueBase: false },
] as const;

export type V1CurrencyCode = (typeof V1_CURRENCIES)[number]["code"];

export const MARKET_PAYMENT_PROVIDERS = ["paypal", "razorpay"] as const;
export type MarketPaymentProvider = (typeof MARKET_PAYMENT_PROVIDERS)[number];

export const V1_MARKETS = [
  { id: "uk", name: "United Kingdom", currency: "GBP", paymentProvider: "paypal" },
  { id: "europe", name: "Europe", currency: "EUR", paymentProvider: "paypal" },
  { id: "usa", name: "United States", currency: "USD", paymentProvider: "paypal" },
  { id: "gcc", name: "GCC", currency: "USD", paymentProvider: "paypal" },
  { id: "india", name: "India", currency: "INR", paymentProvider: "razorpay" },
] as const;

export type V1MarketId = (typeof V1_MARKETS)[number]["id"];

export const V1_COUNTRIES = [
  { code: "GB", name: "United Kingdom", marketId: "uk" },
  { code: "DE", name: "Germany", marketId: "europe" },
  { code: "FR", name: "France", marketId: "europe" },
  { code: "US", name: "United States", marketId: "usa" },
  { code: "AE", name: "United Arab Emirates", marketId: "gcc" },
  { code: "SA", name: "Saudi Arabia", marketId: "gcc" },
  { code: "IN", name: "India", marketId: "india" },
] as const;

export type V1CountryCode = (typeof V1_COUNTRIES)[number]["code"];

export const V1_SHIPPING_ZONES = [
  { id: "uk", marketId: "uk", name: "United Kingdom" },
  { id: "europe", marketId: "europe", name: "Europe" },
  { id: "usa", marketId: "usa", name: "United States" },
  { id: "gcc", marketId: "gcc", name: "GCC" },
  { id: "india", marketId: "india", name: "India" },
] as const;

export type V1ShippingZoneId = (typeof V1_SHIPPING_ZONES)[number]["id"];

/** Same wording as the current UK checkout copy. Not a new promise. */
export const UK_SHIPPING_METHOD_ID = "uk-standard" as const;
export const UK_SHIPPING_METHOD_CODE = "standard" as const;
export const UK_SHIPPING_METHOD_LABEL = "UK Standard Delivery" as const;
export const UK_SHIPPING_ESTIMATED_DELIVERY = "2+ weeks" as const;
/** Integer pence. Matches the existing UK checkout constant. */
export const UK_SHIPPING_RATE_MINOR = 465 as const;

export const V1_SHIPPING_METHODS = [
  {
    id: UK_SHIPPING_METHOD_ID,
    zoneId: "uk",
    code: UK_SHIPPING_METHOD_CODE,
    label: UK_SHIPPING_METHOD_LABEL,
    estimatedDelivery: UK_SHIPPING_ESTIMATED_DELIVERY,
    currency: "GBP",
    amountMinor: UK_SHIPPING_RATE_MINOR,
  },
] as const;

export const FX_RATE_STATUSES = ["active", "rejected"] as const;
export type FxRateStatus = (typeof FX_RATE_STATUSES)[number];

export type ConfiguredShippingRate = {
  methodId: typeof UK_SHIPPING_METHOD_ID;
  zoneId: "uk";
  label: typeof UK_SHIPPING_METHOD_LABEL;
  estimatedDelivery: typeof UK_SHIPPING_ESTIMATED_DELIVERY;
  currency: "GBP";
  amountMinor: typeof UK_SHIPPING_RATE_MINOR;
};

export function isV1MarketId(value: string): value is V1MarketId {
  return V1_MARKETS.some((market) => market.id === value);
}

export function marketById(marketId: string): (typeof V1_MARKETS)[number] | null {
  return V1_MARKETS.find((market) => market.id === marketId) ?? null;
}

export function marketIdForCountry(countryCode: string): V1MarketId | null {
  const code = countryCode.trim().toUpperCase();
  const country = V1_COUNTRIES.find((row) => row.code === code);
  return country?.marketId ?? null;
}

/**
 * Config lookup only. India + INR → razorpay. Other seeded markets → paypal.
 * Any other pair is unsupported and returns null.
 */
export function resolveConfiguredPaymentProvider(input: {
  marketId: string;
  currency: string;
}): MarketPaymentProvider | null {
  const market = marketById(input.marketId);
  if (!market) {
    return null;
  }
  if (market.currency !== input.currency.trim().toUpperCase()) {
    return null;
  }
  return market.paymentProvider;
}

/** Priced methods only. International zones return null until a rate exists. */
export function configuredShippingRate(zoneId: string): ConfiguredShippingRate | null {
  const method = V1_SHIPPING_METHODS.find((row) => row.zoneId === zoneId);
  if (!method || method.currency !== "GBP") {
    return null;
  }
  return {
    methodId: method.id,
    zoneId: "uk",
    label: method.label,
    estimatedDelivery: method.estimatedDelivery,
    currency: "GBP",
    amountMinor: method.amountMinor,
  };
}

export function unpricedShippingZoneIds(): V1ShippingZoneId[] {
  return V1_SHIPPING_ZONES.filter(
    (zone) => !V1_SHIPPING_METHODS.some((method) => method.zoneId === zone.id),
  ).map((zone) => zone.id);
}
