import "server-only";

import { structuredAddressToPostal, type StructuredAddress } from "@/lib/address/structured";
import { AddressLookupUnavailableError } from "@/lib/address-lookup-errors";
import type { AddressLookupProvider, AddressSuggestion, PostalAddress } from "@/types/integrations";

/**
 * Geoapify autocomplete for supported countries other than the United Kingdom.
 * The API key stays on the server. UK lookup does not use this adapter.
 * Checkout Server Actions already rate-limit lookup calls. This adapter does
 * not add a second limiter and does not run in the browser.
 */

export const GEOAPIFY_BASE_URL = "https://api.geoapify.com";
export const GEOAPIFY_TIMEOUT_MS = 4000;
export const GEOAPIFY_SEARCH_LIMIT = 5;
export const GEOAPIFY_MAX_BODY_CHARS = 100_000;

const PLACE_ID = /^[A-Za-z0-9._:-]{6,200}$/;

export class GeoapifyLookupError extends Error {
  constructor(message = "Geoapify lookup failed.") {
    super(message);
    this.name = "GeoapifyLookupError";
  }
}

type GeoapifyFetcher = (
  url: string,
  init: { signal: AbortSignal; headers: { Accept: string } },
) => Promise<Response>;

export function createGeoapifyProvider(options: {
  apiKey?: string;
  countryCode: string;
  fetch?: GeoapifyFetcher;
  baseUrl?: string;
  timeoutMs?: number;
}): AddressLookupProvider {
  const apiKey = options.apiKey?.trim() ?? "";
  const countryCode = options.countryCode.trim().toLowerCase();
  const fetchFn = options.fetch ?? fetch;
  const baseUrl = (options.baseUrl ?? GEOAPIFY_BASE_URL).replace(/\/$/, "");
  const timeoutMs = options.timeoutMs ?? GEOAPIFY_TIMEOUT_MS;

  return {
    async search(query: string): Promise<AddressSuggestion[]> {
      assertConfigured(apiKey, baseUrl);
      const text = query.trim().slice(0, 200);
      if (text.length < 3) {
        return [];
      }
      const url = new URL(`${baseUrl}/v1/geocode/autocomplete`);
      url.searchParams.set("text", text);
      url.searchParams.set("filter", `countrycode:${countryCode}`);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", String(GEOAPIFY_SEARCH_LIMIT));
      url.searchParams.set("apiKey", apiKey);
      const payload = await requestJson(fetchFn, url, baseUrl, timeoutMs);
      const suggestions: AddressSuggestion[] = [];
      const seen = new Set<string>();
      for (const feature of featureList(payload)) {
        const structured = featureToStructured(feature, countryCode);
        if (!structured) {
          continue;
        }
        const id = placeIdOf(feature);
        if (!id || seen.has(id)) {
          continue;
        }
        seen.add(id);
        suggestions.push({ id, label: labelOf(feature, structured) });
      }
      return suggestions;
    },

    async retrieve(id: string): Promise<PostalAddress> {
      assertConfigured(apiKey, baseUrl);
      const placeId = id.trim();
      if (!PLACE_ID.test(placeId)) {
        throw new GeoapifyLookupError("Place id was rejected.");
      }
      const url = new URL(`${baseUrl}/v2/place-details`);
      url.searchParams.set("id", placeId);
      url.searchParams.set("apiKey", apiKey);
      const payload = await requestJson(fetchFn, url, baseUrl, timeoutMs);
      const feature = featureList(payload)[0];
      const structured = feature ? featureToStructured(feature, countryCode) : null;
      if (!structured) {
        throw new GeoapifyLookupError("Place result was malformed.");
      }
      return structuredAddressToPostal(structured);
    },
  };
}

export function featureToStructured(
  feature: Record<string, unknown>,
  countryCode: string,
): StructuredAddress | null {
  const properties = isRecord(feature.properties) ? feature.properties : feature;
  const returned = asString(properties.country_code)?.toLowerCase();
  if (!returned || returned !== countryCode) {
    return null;
  }
  const city =
    asString(properties.city) ?? asString(properties.town) ?? asString(properties.village) ?? "";
  const postalCode = asString(properties.postcode) ?? "";
  const formatted = asString(properties.formatted);
  const namedLine = asString(properties.address_line1);
  const street = joinStreet(properties);
  const line1 = street || namedLine || "";
  if (!line1 || !city || !postalCode) {
    return null;
  }
  const building = firstDistinct([asString(properties.name), namedLine], line1);
  const extra = asString(properties.address_line2);
  const line2Candidate = building || (extra && extra !== line1 ? extra : "");
  const line2 =
    line2Candidate && !looksLikeFormattedAddress(line2Candidate, { formatted, city, postalCode })
      ? line2Candidate
      : "";
  return {
    line1,
    line2,
    city,
    region: asString(properties.state) ?? asString(properties.county) ?? "",
    postalCode,
    countryCode: countryCode.toUpperCase(),
  };
}

function firstDistinct(candidates: Array<string | undefined>, line1: string): string {
  for (const candidate of candidates) {
    if (candidate && candidate !== line1) {
      return candidate;
    }
  }
  return "";
}

/** A formatted dump repeats the city and postcode. It is not a street line. */
function looksLikeFormattedAddress(
  value: string,
  context: { formatted?: string; city: string; postalCode: string },
): boolean {
  if (context.formatted && value === context.formatted) {
    return true;
  }
  const lower = value.toLowerCase();
  return (
    lower.includes(context.postalCode.toLowerCase()) && lower.includes(context.city.toLowerCase())
  );
}

function assertConfigured(apiKey: string, baseUrl: string): void {
  if (!apiKey) {
    throw new AddressLookupUnavailableError();
  }
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    throw new GeoapifyLookupError("Geoapify host was rejected.");
  }
  if (origin !== GEOAPIFY_BASE_URL) {
    throw new GeoapifyLookupError("Geoapify host was rejected.");
  }
}

async function requestJson(
  fetchFn: GeoapifyFetcher,
  url: URL,
  baseUrl: string,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchFn(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new GeoapifyLookupError("Geoapify lookup timed out.");
    }
    throw new GeoapifyLookupError("Geoapify lookup network failure.");
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 401 || response.status === 403) {
    throw new AddressLookupUnavailableError();
  }
  if (!response.ok) {
    throw new GeoapifyLookupError("Geoapify rejected the request.");
  }
  if (response.url) {
    try {
      if (new URL(response.url).origin !== new URL(baseUrl).origin) {
        throw new GeoapifyLookupError("Geoapify host was rejected.");
      }
    } catch (error) {
      if (error instanceof GeoapifyLookupError) {
        throw error;
      }
      throw new GeoapifyLookupError("Geoapify host was rejected.");
    }
  }
  let body: string;
  try {
    body = await response.text();
  } catch {
    throw new GeoapifyLookupError("Geoapify returned a malformed body.");
  }
  if (body.length > GEOAPIFY_MAX_BODY_CHARS) {
    throw new GeoapifyLookupError("Geoapify returned a malformed body.");
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new GeoapifyLookupError("Geoapify returned a malformed body.");
  }
}

function featureList(payload: unknown): Record<string, unknown>[] {
  if (!isRecord(payload)) {
    throw new GeoapifyLookupError("Geoapify response was malformed.");
  }
  const features = payload.features ?? payload.results;
  if (features == null) {
    return [];
  }
  if (!Array.isArray(features)) {
    throw new GeoapifyLookupError("Geoapify response was malformed.");
  }
  return features.filter(isRecord);
}

function placeIdOf(feature: Record<string, unknown>): string | null {
  const properties = isRecord(feature.properties) ? feature.properties : feature;
  const id = asString(properties.place_id);
  if (!id || !PLACE_ID.test(id)) {
    return null;
  }
  return id;
}

function labelOf(feature: Record<string, unknown>, structured: StructuredAddress): string {
  const properties = isRecord(feature.properties) ? feature.properties : feature;
  return asString(properties.formatted) ?? [structured.line1, structured.postalCode, structured.city].filter(Boolean).join(", ");
}

function joinStreet(properties: Record<string, unknown>): string {
  return [asString(properties.housenumber), asString(properties.street)].filter(Boolean).join(" ");
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      (error.name === "AbortError" || error.name === "TimeoutError"),
  );
}
