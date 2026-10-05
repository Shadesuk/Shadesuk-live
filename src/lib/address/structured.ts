import type { PostalAddress } from "@/types/integrations";

/**
 * Provider-neutral address. Postcodes.io and Geoapify both map into this
 * before checkout sees a postal address. Empty street lines stay empty so a
 * postcode lookup cannot invent a house.
 */
export type StructuredAddress = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
};

export function structuredAddressToPostal(address: StructuredAddress): PostalAddress {
  const postal: PostalAddress = {
    line1: address.line1.trim(),
    city: address.city.trim(),
    postcode: address.postalCode.trim(),
    country: address.countryCode.trim().toUpperCase(),
  };
  const line2 = address.line2.trim();
  const region = address.region.trim();
  if (line2) {
    postal.line2 = line2;
  }
  if (region) {
    postal.county = region;
  }
  return postal;
}
