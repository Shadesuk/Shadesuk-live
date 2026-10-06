import { isEuMember, supportedCountry } from "@/contracts/countries";
import { STORE_CURRENCY } from "@/contracts/money";
import {
  UK_SHIPPING_ESTIMATED_DELIVERY,
  UK_SHIPPING_METHOD_CODE,
  UK_SHIPPING_METHOD_ID,
  UK_SHIPPING_METHOD_LABEL,
  UK_SHIPPING_RATE_MINOR,
  V1_COUNTRIES,
  V1_SHIPPING_METHODS,
  V1_SHIPPING_ZONES,
} from "@/contracts/markets";
import { normalizeCountry } from "@/lib/checkout-validate";

/**
 * Country, then zone, then an active method.
 * The UK catalogue row stays £4.65 / 2+ weeks. Every other supported
 * country uses that same commercial rule. Checkout reads this typed seed.
 * An unknown country stays unsupported and is not given a price.
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
  if (!supportedCountry(countryCode)) {
    return { status: "unsupported" };
  }
  const countryRow = catalogue.countries.find((row) => row.code === countryCode && row.isActive);
  const membership = countryRow
    ? catalogue.zoneCountries.find(
        (row) => row.countryCode === countryCode && row.marketId === countryRow.marketId && row.zoneId,
      )
    : undefined;
  if (countryRow && membership) {
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
    if (options.length > 0) {
      return { status: "priced", countryCode, zoneId: membership.zoneId, options };
    }
  }
  return standardDelivery(countryCode, membership?.zoneId);
}

/**
 * Seeded method ids from the shipping migrations. £4.65 / 2+ weeks.
 * uk-standard, europe-standard, usa-standard, gcc-standard, india-standard,
 * international-standard.
 */
const SEEDED_SHIPPING_METHOD_BY_ZONE = {
  uk: UK_SHIPPING_METHOD_ID,
  europe: "europe-standard",
  usa: "usa-standard",
  gcc: "gcc-standard",
  india: "india-standard",
  international: "international-standard",
} as const;

type SeededShippingZone = keyof typeof SEEDED_SHIPPING_METHOD_BY_ZONE;

function seededZone(countryCode: string): SeededShippingZone {
  if (countryCode === "GB") {
    return "uk";
  }
  if (isEuMember(countryCode)) {
    return "europe";
  }
  if (countryCode === "US") {
    return "usa";
  }
  if (countryCode === "AE" || countryCode === "SA") {
    return "gcc";
  }
  if (countryCode === "IN") {
    return "india";
  }
  return "international";
}

function isSeededZone(zoneId: string): zoneId is SeededShippingZone {
  return Object.prototype.hasOwnProperty.call(SEEDED_SHIPPING_METHOD_BY_ZONE, zoneId);
}

/** £4.65 and 2+ weeks, stored against the seeded method for that zone. */
function standardDelivery(countryCode: string, zoneId?: string): ShippingOptionsResult {
  const zone = zoneId && isSeededZone(zoneId) ? zoneId : seededZone(countryCode);
  return {
    status: "priced",
    countryCode,
    zoneId: zone,
    options: [
      {
        methodId: SEEDED_SHIPPING_METHOD_BY_ZONE[zone],
        zoneId: zone,
        code: UK_SHIPPING_METHOD_CODE,
        label: countryCode === "GB" ? UK_SHIPPING_METHOD_LABEL : "Standard Delivery",
        estimatedDelivery: UK_SHIPPING_ESTIMATED_DELIVERY,
        currency: STORE_CURRENCY,
        amountMinor: UK_SHIPPING_RATE_MINOR,
      },
    ],
  };
}
