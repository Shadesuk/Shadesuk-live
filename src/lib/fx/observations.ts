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

export type FxQuoteCurrency = (typeof FX_QUOTE_CURRENCIES)[number];

export type FxObservation = {
  baseCurrency: typeof CATALOGUE_BASE_CURRENCY;
  quoteCurrency: FxQuoteCurrency;
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

function isQuoteCurrency(value: string): value is FxQuoteCurrency {
  return (FX_QUOTE_CURRENCIES as readonly string[]).includes(value);
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

/**
 * Parse the v2 latest-rates array. Requires every V1 quote currency once,
 * base GBP, and one shared calendar date. Extra currencies are ignored.
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

  const found = new Map<FxQuoteCurrency, FxObservation>();
  let effectiveOn: string | null = null;

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
    if (!isQuoteCurrency(quote)) {
      continue;
    }
    if (!isCalendarDate(date, now)) {
      return { ok: false, reason: "invalid_date" };
    }
    if (!parsePositiveDecimalRate(rate)) {
      return { ok: false, reason: "invalid_rate" };
    }
    if (effectiveOn && effectiveOn !== date) {
      return { ok: false, reason: "invalid_date" };
    }
    effectiveOn = date;
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

  if (found.size !== FX_QUOTE_CURRENCIES.length) {
    return { ok: false, reason: "incomplete" };
  }
  const observations = FX_QUOTE_CURRENCIES.map((quote) => found.get(quote)).filter(
    (row): row is FxObservation => row != null,
  );
  return { ok: true, observations };
}
