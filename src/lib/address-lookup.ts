import "server-only";

import { createGeoapifyProvider } from "@/lib/address-providers/geoapify";
import { postcodesIoAddressLookupProvider } from "@/lib/address-providers/postcodes-io";
import { AddressLookupUnavailableError } from "@/lib/address-lookup-errors";
import { isSupportedDeliveryCountry, normalizeCountry } from "@/lib/checkout-validate";
import { CHECKOUT_COUNTRY_GB } from "@/types/checkout";
import type { AddressLookupProvider, AddressSuggestion, PostalAddress } from "@/types/integrations";
import type { AddressLookupView, AddressRetrieveView } from "@/types/checkout";

export { AddressLookupUnavailableError };

/**
 * Address lookup stays server-side. GB uses Postcodes.io. Other supported
 * countries use Geoapify. The browser never receives the Geoapify key.
 */
export const ADDRESS_LOOKUP_PROVIDER_UNSET = "unset" as const;

export const unsetAddressLookupProvider: AddressLookupProvider = {
  async search(): Promise<AddressSuggestion[]> {
    return [];
  },
  async retrieve(): Promise<PostalAddress> {
    throw new AddressLookupUnavailableError();
  },
};

/**
 * GB → Postcodes.io. Other V1 countries → Geoapify. Anything else → null.
 * A missing Geoapify key still returns a provider; calls fail closed to manual entry.
 */
export function getAddressProvider(
  country: string,
  env: NodeJS.ProcessEnv = process.env,
): AddressLookupProvider | null {
  const code = normalizeCountry(country);
  if (code === CHECKOUT_COUNTRY_GB) {
    return postcodesIoAddressLookupProvider;
  }
  if (!isSupportedDeliveryCountry(code)) {
    return null;
  }
  return createGeoapifyProvider({
    apiKey: env.GEOAPIFY_API_KEY,
    countryCode: code,
  });
}

/** Default UK provider. Prefer getAddressProvider(country) at the checkout boundary. */
export function getAddressLookupProvider(): AddressLookupProvider | null {
  return getAddressProvider(CHECKOUT_COUNTRY_GB);
}

export function isAddressLookupConfigured(
  provider: AddressLookupProvider | null = getAddressLookupProvider(),
): boolean {
  return provider !== null;
}

export async function lookupAddresses(
  query: string,
  provider: AddressLookupProvider | null = getAddressLookupProvider(),
): Promise<AddressLookupView> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return { status: "ok", suggestions: [] };
  }
  if (!provider) {
    return { status: "unavailable" };
  }
  try {
    const suggestions = await provider.search(trimmed);
    return { status: "ok", suggestions };
  } catch (error) {
    if (error instanceof AddressLookupUnavailableError) {
      return { status: "unavailable" };
    }
    return { status: "error" };
  }
}

export async function retrieveAddress(
  id: string,
  provider: AddressLookupProvider | null = getAddressLookupProvider(),
): Promise<AddressRetrieveView> {
  const trimmed = id.trim();
  if (!trimmed) {
    return { status: "error" };
  }
  if (!provider) {
    return { status: "unavailable" };
  }
  try {
    const address = await provider.retrieve(trimmed);
    return { status: "ok", address };
  } catch (error) {
    if (error instanceof AddressLookupUnavailableError) {
      return { status: "unavailable" };
    }
    return { status: "error" };
  }
}
