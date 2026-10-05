import "server-only";

import {
  FRANKFURTER_DEFAULT_BASE_URL,
  FX_QUOTE_CURRENCIES,
  parseFrankfurterLatestRates,
  type FxObservation,
  type FxObservationFailure,
} from "./observations";

export const FRANKFURTER_TIMEOUT_MS = 8000;
export const FRANKFURTER_MAX_BODY_CHARS = 65_536;

export type FrankfurterFetchResult =
  | { ok: true; observations: FxObservation[] }
  | { ok: false; reason: FxObservationFailure | "network" | "http" | "oversized" };

type Fetcher = (url: string, init: { signal: AbortSignal; headers: { Accept: string } }) => Promise<Response>;

export function frankfurterLatestUrl(baseUrl = FRANKFURTER_DEFAULT_BASE_URL): string {
  const root = baseUrl.replace(/\/$/, "");
  const quotes = FX_QUOTE_CURRENCIES.join(",");
  return `${root}/v2/rates?base=GBP&quotes=${quotes}`;
}

/**
 * Server-side Frankfurter adapter. The browser must not call this.
 * A failed response yields no observations, so the last stored rates stay.
 */
export async function fetchFrankfurterLatestRates(options?: {
  fetch?: Fetcher;
  baseUrl?: string;
  timeoutMs?: number;
  now?: Date;
}): Promise<FrankfurterFetchResult> {
  const fetchFn = options?.fetch ?? fetch;
  const configured = options?.baseUrl ?? process.env.FRANKFURTER_BASE_URL?.trim();
  const baseUrl = configured && configured.length > 0 ? configured : FRANKFURTER_DEFAULT_BASE_URL;
  const timeoutMs = options?.timeoutMs ?? FRANKFURTER_TIMEOUT_MS;
  const url = frankfurterLatestUrl(baseUrl);
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(baseUrl).origin;
  } catch {
    return { ok: false, reason: "network" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchFn(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return { ok: false, reason: "http" };
  }
  try {
    if (new URL(response.url).origin !== expectedOrigin) {
      return { ok: false, reason: "network" };
    }
  } catch {
    return { ok: false, reason: "network" };
  }

  let body: string;
  try {
    body = await response.text();
  } catch {
    return { ok: false, reason: "network" };
  }
  if (body.length > FRANKFURTER_MAX_BODY_CHARS) {
    return { ok: false, reason: "oversized" };
  }
  const parsed = parseFrankfurterLatestRates(body, options?.now);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, observations: parsed.observations };
}
