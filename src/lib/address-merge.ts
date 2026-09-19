import type { AddressFormValue } from "@/components/address/AddressForm";
import type { PostalAddress } from "@/types/integrations";

/** Apply provider fields without inventing or wiping street/name values. */
export function mergeLookupPostalAddress(
  current: AddressFormValue,
  selected: PostalAddress,
): AddressFormValue {
  const line1 = selected.line1.trim();
  const line2 = selected.line2?.trim() ?? "";
  return {
    ...current,
    postcode: selected.postcode || current.postcode,
    city: selected.city.trim() ? selected.city : current.city,
    county: selected.county?.trim() ? selected.county : current.county,
    country: selected.country || current.country,
    line1: line1 ? line1 : current.line1,
    line2: line2 ? line2 : current.line2,
  };
}
