import { postcodesIoAddressLookupProvider } from "@/lib/address-providers/postcodes-io";
import type { AddressLookupProvider, AddressSuggestion, PostalAddress } from "@/types/integrations";
import type { AddressLookupView, AddressRetrieveView } from "@/types/checkout";

/**
 * Address lookup is abstracted. Postcodes.io is the default server-side adapter.
 * Swap getAddressLookupProvider() to replace the vendor. Do not call vendors from the browser.
 */
export const ADDRESS_LOOKUP_PROVIDER_UNSET = "unset" as const;

export class AddressLookupUnavailableError extends Error {
  constructor(message = "Address lookup provider is not configured.") {
    super(message);
    this.name = "AddressLookupUnavailableError";
  }
}

export const unsetAddressLookupProvider: AddressLookupProvider = {
  async search(): Promise<AddressSuggestion[]> {
    return [];
  },
  async retrieve(): Promise<PostalAddress> {
    throw new AddressLookupUnavailableError();
  },
};

/** Default: Postcodes.io. Pass another provider into lookupAddresses/retrieveAddress to swap. */
export function getAddressLookupProvider(): AddressLookupProvider | null {
  return postcodesIoAddressLookupProvider;
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
  } catch {
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
