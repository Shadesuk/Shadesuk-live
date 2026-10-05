import { structuredAddressToPostal, type StructuredAddress } from "@/lib/address/structured";
import { formatUkPostcode } from "@/lib/checkout-validate";
import { CHECKOUT_COUNTRY_GB } from "@/types/checkout";
import type { AddressLookupProvider, AddressSuggestion, PostalAddress } from "@/types/integrations";

/**
 * Postcodes.io adapter. Server-side only. No key. Not household autocomplete.
 * Swap via AddressLookupProvider — do not call this from Client Components.
 */

export const POSTCODES_IO_BASE_URL = "https://api.postcodes.io";
export const POSTCODES_IO_TIMEOUT_MS = 3000;
export const POSTCODES_IO_SEARCH_LIMIT = 8;

const COMPLETE_UK_POSTCODE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
/** Partial or complete outward/inward UK postcode. Rejects street text. */
const PLAUSIBLE_POSTCODE_QUERY = /^[A-Z]{1,2}[0-9][0-9A-Z]{0,3}[A-Z]{0,2}$/;

export class PostcodesIoLookupError extends Error {
  constructor(message = "Postcodes.io lookup failed.") {
    super(message);
    this.name = "PostcodesIoLookupError";
  }
}

export function compactUkPostcodeQuery(value: string): string | null {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (compact.length < 2 || compact.length > 7) {
    return null;
  }
  if (!PLAUSIBLE_POSTCODE_QUERY.test(compact)) {
    return null;
  }
  return compact;
}

export function isCompleteUkPostcode(value: string): boolean {
  return COMPLETE_UK_POSTCODE.test(value.trim());
}

type PostcodesIoFetcher = (
  url: string,
  init: { signal: AbortSignal; headers: { Accept: string } },
) => Promise<Response>;

export function createPostcodesIoProvider(options?: {
  fetch?: PostcodesIoFetcher;
  baseUrl?: string;
  timeoutMs?: number;
}): AddressLookupProvider {
  const fetchFn = options?.fetch ?? fetch;
  const baseUrl = (options?.baseUrl ?? POSTCODES_IO_BASE_URL).replace(/\/$/, "");
  const timeoutMs = options?.timeoutMs ?? POSTCODES_IO_TIMEOUT_MS;

  return {
    async search(query: string): Promise<AddressSuggestion[]> {
      const compact = compactUkPostcodeQuery(query);
      if (!compact) {
        return [];
      }
      const url = `${baseUrl}/postcodes?q=${encodeURIComponent(compact)}&limit=${POSTCODES_IO_SEARCH_LIMIT}`;
      const payload = await requestJson(fetchFn, url, timeoutMs);
      const rows = asResultArray(payload);
      const suggestions: AddressSuggestion[] = [];
      const seen = new Set<string>();
      for (const row of rows) {
        const suggestion = toSuggestion(row);
        if (!suggestion || seen.has(suggestion.id)) {
          continue;
        }
        seen.add(suggestion.id);
        suggestions.push(suggestion);
      }
      return suggestions;
    },

    async retrieve(id: string): Promise<PostalAddress> {
      if (!isCompleteUkPostcode(id)) {
        throw new PostcodesIoLookupError("Postcode is not complete.");
      }
      const compact = compactUkPostcodeQuery(id);
      if (!compact) {
        throw new PostcodesIoLookupError("Postcode is not valid.");
      }
      const url = `${baseUrl}/postcodes/${encodeURIComponent(compact)}`;
      const payload = await requestJson(fetchFn, url, timeoutMs);
      const row = asResultRecord(payload);
      const address = toPostalAddress(row);
      if (!address) {
        throw new PostcodesIoLookupError("Postcode result was malformed.");
      }
      return address;
    },
  };
}

export const postcodesIoAddressLookupProvider = createPostcodesIoProvider();

async function requestJson(
  fetchFn: PostcodesIoFetcher,
  url: string,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchFn(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new PostcodesIoLookupError("Postcodes.io lookup timed out.");
    }
    throw new PostcodesIoLookupError("Postcodes.io lookup network failure.");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    throw new PostcodesIoLookupError("Postcode was not found.");
  }
  if (response.status === 400 || response.status < 200 || response.status >= 300) {
    throw new PostcodesIoLookupError("Postcodes.io rejected the request.");
  }

  try {
    return await response.json();
  } catch {
    throw new PostcodesIoLookupError("Postcodes.io returned a malformed body.");
  }
}

function toSuggestion(row: Record<string, unknown>): AddressSuggestion | null {
  const postcode = asString(row.postcode);
  if (!postcode || !isCompleteUkPostcode(postcode)) {
    return null;
  }
  const formatted = formatUkPostcode(postcode);
  return { id: formatted, label: formatted };
}

function toPostalAddress(row: Record<string, unknown> | null): PostalAddress | null {
  const structured = toStructuredAddress(row);
  if (!structured) {
    return null;
  }
  return structuredAddressToPostal(structured);
}

function toStructuredAddress(row: Record<string, unknown> | null): StructuredAddress | null {
  if (!row) {
    return null;
  }
  const postcode = asString(row.postcode);
  if (!postcode || !isCompleteUkPostcode(postcode)) {
    return null;
  }
  const city = asString(row.admin_district) ?? "";
  const region = asString(row.admin_county) ?? (asString(row.region) !== city ? asString(row.region) : undefined);
  return {
    line1: "",
    line2: "",
    city,
    region: region ?? "",
    postalCode: formatUkPostcode(postcode),
    countryCode: CHECKOUT_COUNTRY_GB,
  };
}

function asResultArray(payload: unknown): Record<string, unknown>[] {
  const result = resultField(payload);
  if (result == null) {
    return [];
  }
  if (!Array.isArray(result)) {
    throw new PostcodesIoLookupError("Postcodes.io search result was malformed.");
  }
  const rows: Record<string, unknown>[] = [];
  for (const item of result) {
    if (isRecord(item)) {
      rows.push(item);
    }
  }
  return rows;
}

function asResultRecord(payload: unknown): Record<string, unknown> | null {
  const result = resultField(payload);
  if (result == null) {
    return null;
  }
  if (!isRecord(result)) {
    throw new PostcodesIoLookupError("Postcodes.io lookup result was malformed.");
  }
  return result;
}

function resultField(payload: unknown): unknown {
  if (!isRecord(payload)) {
    throw new PostcodesIoLookupError("Postcodes.io response was malformed.");
  }
  return payload.result;
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
