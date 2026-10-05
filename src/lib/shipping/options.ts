import { STORE_CURRENCY } from "@/contracts/money";
import {
  V1_COUNTRIES,
  V1_SHIPPING_METHODS,
  V1_SHIPPING_ZONES,
} from "@/contracts/markets";
import { normalizeCountry } from "@/lib/checkout-validate";

/**
 * Country, then zone, then active methods, then a seeded rate.
 * The catalogue matches the Phase 1 tables. Missing rates stay unavailable.
 * Checkout reads this typed seed, not a live query. Admin edits to those
 * tables must be read from the database before they can change a quote.
 * This does not invent an international price and does not call a carrier.
 */

export type ShippingCatalogue = {
  countries: readonly { code: string; marketId: string; isActive: boolean }[];
  zoneCountries: readonly { countryCode: string; zoneId: string; marketId: string }[];
  methods: readonly {
    id: string;
    zoneId: string;
    code: string;
    label: string;
    estimatedDelivery: string;
    currency: string;
    amountMinor: number;
    isActive: boolean;
  }[];
};

export type ShippingMethodOption = {
  methodId: string;
  zoneId: string;
  code: string;
  label: string;
  estimatedDelivery: string;
  currency: typeof STORE_CURRENCY;
  amountMinor: number;
};

export type ShippingOptionsResult =
  | { status: "priced"; countryCode: string; zoneId: string; options: ShippingMethodOption[] }
  | { status: "unavailable"; countryCode: string; zoneId: string }
  | { status: "unsupported" };

export const V1_SHIPPING_CATALOGUE: ShippingCatalogue = {
  countries: V1_COUNTRIES.map((country) => ({
    code: country.code,
    marketId: country.marketId,
    isActive: true,
  })),
  zoneCountries: V1_COUNTRIES.map((country) => ({
    countryCode: country.code,
    zoneId: V1_SHIPPING_ZONES.find((zone) => zone.marketId === country.marketId)?.id ?? "",
    marketId: country.marketId,
  })),
  methods: V1_SHIPPING_METHODS.map((method) => ({
    id: method.id,
    zoneId: method.zoneId,
    code: method.code,
    label: method.label,
    estimatedDelivery: method.estimatedDelivery,
    currency: method.currency,
    amountMinor: method.amountMinor,
    isActive: true,
  })),
};

export function resolveShippingOptions(
  country: string,
  catalogue: ShippingCatalogue = V1_SHIPPING_CATALOGUE,
): ShippingOptionsResult {
  const countryCode = normalizeCountry(country);
  const countryRow = catalogue.countries.find((row) => row.code === countryCode && row.isActive);
  if (!countryRow) {
    return { status: "unsupported" };
  }
  const membership = catalogue.zoneCountries.find(
    (row) => row.countryCode === countryCode && row.marketId === countryRow.marketId && row.zoneId,
  );
  if (!membership) {
    return { status: "unsupported" };
  }
  const options = catalogue.methods
    .filter(
      (method) =>
        method.isActive &&
        method.zoneId === membership.zoneId &&
        method.currency === STORE_CURRENCY &&
        Number.isInteger(method.amountMinor) &&
        method.amountMinor >= 0,
    )
    .map((method) => ({
      methodId: method.id,
      zoneId: membership.zoneId,
      code: method.code,
      label: method.label,
      estimatedDelivery: method.estimatedDelivery,
      currency: STORE_CURRENCY,
      amountMinor: method.amountMinor,
    }));
  if (options.length === 0) {
    return { status: "unavailable", countryCode, zoneId: membership.zoneId };
  }
  return { status: "priced", countryCode, zoneId: membership.zoneId, options };
}
