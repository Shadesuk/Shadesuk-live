/**
 * Validate a Frankfurter latest-rates body before anything is written.
 * Rates stay decimal strings. A partial or malformed body writes nothing.
 */

import { CATALOGUE_BASE_CURRENCY, V1_CURRENCIES, type V1CurrencyCode } from "@/contracts/markets";
import { parsePositiveDecimalRate } from "@/contracts/pricing";

export const FRANKFURTER_SOURCE = "frankfurter" as const;
export const FRANKFURTER_DEFAULT_BASE_URL = "https://api.frankfurter.dev";

export const FX_QUOTE_CURRENCIES = V1_CURRENCIES.map((currency) => currency.code).filter(
  (code): code is Exclude<V1CurrencyCode, typeof CATALOGUE_BASE_CURRENCY> =>
    code !== CATALOGUE_BASE_CURRENCY,
);

/** Frankfurter symbols used for display. Missing rows do not fail the required set. */
export const FX_OPTIONAL_QUOTE_CURRENCIES = [
  "AUD",
  "BRL",
  "CAD",
  "CHF",
  "CNY",
  "HKD",
  "IDR",
  "ILS",
  "JPY",
  "KRW",
  "MXN",
  "MYR",
  "NOK",
  "NZD",
  "PHP",
  "SGD",
  "THB",
  "TRY",
  "ZAR",
] as const;

export type FxQuoteCurrency = (typeof FX_QUOTE_CURRENCIES)[number];
export type FxOptionalQuoteCurrency = (typeof FX_OPTIONAL_QUOTE_CURRENCIES)[number];
export type FxStoredQuoteCurrency = FxQuoteCurrency | FxOptionalQuoteCurrency;

export const FX_STORED_QUOTE_CURRENCIES: readonly FxStoredQuoteCurrency[] = [
  ...FX_QUOTE_CURRENCIES,
  ...FX_OPTIONAL_QUOTE_CURRENCIES,
];

export type FxObservation = {
  baseCurrency: typeof CATALOGUE_BASE_CURRENCY;
  quoteCurrency: FxStoredQuoteCurrency;
  rate: string;
  effectiveOn: string;
  source: typeof FRANKFURTER_SOURCE;
};

export type FxObservationFailure =
  | "malformed"
  | "incomplete"
  | "invalid_rate"
  | "invalid_date";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FUTURE_SLACK_MS = 2 * 24 * 60 * 60 * 1000;

function quoteRateLiterals(body: string): string {
  return body.replace(
    /"rate"\s*:\s*(-?(?:0|[1-9]\d*)(?:\.\d+)?)/g,
    (_match, literal: string) => `"rate":"${literal}"`,
  );
}

function isStoredQuoteCurrency(value: string): value is FxStoredQuoteCurrency {
  return (FX_STORED_QUOTE_CURRENCIES as readonly string[]).includes(value);
}

export function isCalendarDate(value: string, now = new Date()): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return false;
  }
  return utc.getTime() <= now.getTime() + FUTURE_SLACK_MS;
}

export function effectiveAtFromDate(effectiveOn: string): string {
  return `${effectiveOn}T00:00:00.000Z`;
}

function isRequiredQuote(value: string): value is FxQuoteCurrency {
  return (FX_QUOTE_CURRENCIES as readonly string[]).includes(value);
}

/**
 * Parse the v2 latest-rates array. Requires every V1 quote currency once,
 * each with base GBP, a valid calendar date, and a positive rate.
 * Frankfurter publishes those dates independently, so EUR, USD, and INR
 * may not share a day. Known display currencies are kept when their own
 * date and rate are valid. A bad optional row is skipped. Anything else
 * is ignored. A bad required row fails the batch.
 */
export function parseFrankfurterLatestRates(
  body: string,
  now = new Date(),
): { ok: true; observations: FxObservation[] } | { ok: false; reason: FxObservationFailure } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(quoteRateLiterals(body));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, reason: "malformed" };
  }

  const found = new Map<FxStoredQuoteCurrency, FxObservation>();

  for (const item of parsed) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, reason: "malformed" };
    }
    const row = item as Record<string, unknown>;
    const base = typeof row.base === "string" ? row.base.trim().toUpperCase() : "";
    const quote = typeof row.quote === "string" ? row.quote.trim().toUpperCase() : "";
    const date = typeof row.date === "string" ? row.date.trim() : "";
    const rate = typeof row.rate === "string" ? row.rate.trim() : "";
    if (!base || !quote || !date || !rate) {
      return { ok: false, reason: "malformed" };
    }
    if (base !== CATALOGUE_BASE_CURRENCY) {
      return { ok: false, reason: "malformed" };
    }
    if (!isStoredQuoteCurrency(quote)) {
      continue;
    }
    const required = isRequiredQuote(quote);
    if (!isCalendarDate(date, now)) {
      if (required) {
        return { ok: false, reason: "invalid_date" };
      }
      continue;
    }
    if (!parsePositiveDecimalRate(rate)) {
      if (required) {
        return { ok: false, reason: "invalid_rate" };
      }
      continue;
    }
    if (found.has(quote)) {
      return { ok: false, reason: "malformed" };
    }
    found.set(quote, {
      baseCurrency: CATALOGUE_BASE_CURRENCY,
      quoteCurrency: quote,
      rate,
      effectiveOn: date,
      source: FRANKFURTER_SOURCE,
    });
  }

  if (!FX_QUOTE_CURRENCIES.every((quote) => found.has(quote))) {
    return { ok: false, reason: "incomplete" };
  }
  const observations = FX_STORED_QUOTE_CURRENCIES.map((quote) => found.get(quote)).filter(
    (row): row is FxObservation => row != null,
  );
  return { ok: true, observations };
}
