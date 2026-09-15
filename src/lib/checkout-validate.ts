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
  const postcode = input.postcode.trim();
  if (!postcode) {
    errors.postcode = POSTCODE_REQUIRED;
  } else if (!UK_POSTCODE_PATTERN.test(postcode)) {
    errors.postcode = POSTCODE_INVALID;
  }
  if (normalizeCountry(input.country) !== CHECKOUT_COUNTRY_GB) {
    errors.country = COUNTRY_UNSUPPORTED;
  }
  return errors;
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
