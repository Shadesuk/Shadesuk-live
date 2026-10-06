import { SUPPORTED_COUNTRIES, supportedCountry } from "@/contracts/countries";
import {
  ADDRESS_LINE_1_REQUIRED,
  CITY_REQUIRED,
  COUNTRY_UNSUPPORTED,
  EMAIL_INVALID,
  EMAIL_REQUIRED,
  FIRST_NAME_REQUIRED,
  LAST_NAME_REQUIRED,
  POSTCODE_INVALID,
  POSTCODE_REQUIRED,
} from "@/lib/checkout-copy";
import { CHECKOUT_COUNTRY_GB, type CheckoutFieldErrors } from "@/types/checkout";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** UK postcode, optional inward space. Not a delivery guarantee. */
const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;

export function normalizeEmailInput(value: string): string {
  return value.trim().toLowerCase();
}

export function validateCheckoutEmail(email: string): CheckoutFieldErrors {
  const trimmed = email.trim();
  if (!trimmed) {
    return { email: EMAIL_REQUIRED };
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { email: EMAIL_INVALID };
  }
  return {};
}

/**
 * Account address book and lookup. Seeded markets may be stored.
 * Checkout orders and payment use validateDeliverableCheckoutAddress.
 */
export function validateCheckoutAddress(input: {
  firstName: string;
  lastName: string;
  line1: string;
  city: string;
  postcode: string;
  country: string;
}): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  if (!input.firstName.trim()) {
    errors.firstName = FIRST_NAME_REQUIRED;
  }
  if (!input.lastName.trim()) {
    errors.lastName = LAST_NAME_REQUIRED;
  }
  if (!input.line1.trim()) {
    errors.line1 = ADDRESS_LINE_1_REQUIRED;
  }
  if (!input.city.trim()) {
    errors.city = CITY_REQUIRED;
  }
  const country = normalizeCountry(input.country);
  const postcode = input.postcode.trim();
  if (!postcode) {
    errors.postcode = POSTCODE_REQUIRED;
  } else if (!isPlausiblePostalCode(postcode, country)) {
    errors.postcode = POSTCODE_INVALID;
  }
  if (!isSupportedDeliveryCountry(country)) {
    errors.country = COUNTRY_UNSUPPORTED;
  }
  return errors;
}

/** Supported destinations can be charged. Unknown countries cannot. */
export function validateDeliverableCheckoutAddress(input: {
  firstName: string;
  lastName: string;
  line1: string;
  city: string;
  postcode: string;
  country: string;
}): CheckoutFieldErrors {
  return validateCheckoutAddress(input);
}

export function isSupportedDeliveryCountry(country: string): boolean {
  return supportedCountry(normalizeCountry(country)) != null;
}

/**
 * Street autocomplete for every supported country except the UK.
 * France uses the same Geoapify path as the US and Australia.
 * The UK stays on the postcode find button.
 */
export function lookupUsesAutocomplete(country: string): boolean {
  const code = normalizeCountry(country);
  return code !== CHECKOUT_COUNTRY_GB && isSupportedDeliveryCountry(code);
}

export function checkoutCountryOptions(): ReadonlyArray<{ code: string; name: string }> {
  return SUPPORTED_COUNTRIES.map((country) => ({ code: country.code, name: country.name }));
}

export function postalFieldCopy(country: string): { postal: string; region: string } {
  const code = normalizeCountry(country);
  if (code === CHECKOUT_COUNTRY_GB) {
    return { postal: "Postcode", region: "County" };
  }
  if (code === "US") {
    return { postal: "ZIP code", region: "State" };
  }
  if (code === "IN") {
    return { postal: "PIN code", region: "State" };
  }
  return { postal: "Postal code", region: "Region" };
}

function isPlausiblePostalCode(postcode: string, country: string): boolean {
  if (country === CHECKOUT_COUNTRY_GB) {
    return UK_POSTCODE_PATTERN.test(postcode);
  }
  return /^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/.test(postcode);
}

export function hasCheckoutFieldErrors(errors: CheckoutFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function normalizeCountry(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (trimmed === "GB" || trimmed === "UK" || trimmed === "GBR") {
    return CHECKOUT_COUNTRY_GB;
  }
  if (trimmed === "UNITED KINGDOM" || trimmed === "GREAT BRITAIN") {
    return CHECKOUT_COUNTRY_GB;
  }
  return trimmed;
}

export function formatUkPostcode(value: string): string {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (compact.length < 5) {
    return compact;
  }
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

/** Partial or complete UK postcode. Rejects street text before lookup. */
export function isUkPostcodeLookupQuery(value: string): boolean {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (compact.length < 2 || compact.length > 7) {
    return false;
  }
  return /^[A-Z]{1,2}[0-9][0-9A-Z]{0,3}[A-Z]{0,2}$/.test(compact);
}
