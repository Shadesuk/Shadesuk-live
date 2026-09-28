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
   * Locked production provider. Charge/order writes live in
   * `src/lib/paypal` and `src/services/pending-payment.ts`.
   */
  id: "paypal";
};

export type AuthProvider = {
  /** Optional Google authentication. Never required to purchase. */
  id: "google" | string;
};
