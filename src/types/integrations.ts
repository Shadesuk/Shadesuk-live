/**
 * Integration seams for later phases. Providers must stay replaceable.
 */

export type AddressSuggestion = {
  id: string;
  label: string;
};

export type PostalAddress = {
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
};

export type AddressLookupProvider = {
  search: (query: string) => Promise<AddressSuggestion[]>;
  retrieve: (id: string) => Promise<PostalAddress>;
};

export type PaymentProvider = {
  /**
   * Placeholder only. Not a vendor lock.
   * Opaque payment fields live in `src/contracts/payment/stub.ts`.
   */
  id: "stripe" | string;
};

export type AuthProvider = {
  /** Optional Google authentication. Never required to purchase. */
  id: "google" | string;
};
