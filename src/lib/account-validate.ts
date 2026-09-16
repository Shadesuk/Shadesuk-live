import {
  EMAIL_INVALID,
  EMAIL_REQUIRED,
  FIRST_NAME_REQUIRED,
  LAST_NAME_REQUIRED,
  PASSWORD_REQUIRED,
  PASSWORD_TOO_SHORT,
} from "@/lib/account-copy";
import { normalizeEmailInput } from "@/lib/checkout-validate";
import type { AccountFieldErrors } from "@/types/account";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function validateAccountEmail(email: string): AccountFieldErrors {
  const trimmed = email.trim();
  if (!trimmed) {
    return { email: EMAIL_REQUIRED };
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { email: EMAIL_INVALID };
  }
  return {};
}

export function validateSignInInput(input: {
  email: string;
  password: string;
}): AccountFieldErrors {
  const errors = validateAccountEmail(input.email);
  if (!input.password) {
    errors.password = PASSWORD_REQUIRED;
  }
  return errors;
}

export function validatePersonalDetails(input: {
  firstName: string;
  lastName: string;
}): AccountFieldErrors {
  const errors: AccountFieldErrors = {};
  if (!input.firstName.trim()) {
    errors.firstName = FIRST_NAME_REQUIRED;
  }
  if (!input.lastName.trim()) {
    errors.lastName = LAST_NAME_REQUIRED;
  }
  return errors;
}

export function validateRegisterInput(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): AccountFieldErrors {
  const errors = {
    ...validateAccountEmail(input.email),
    ...validatePersonalDetails(input),
  };
  if (!input.password) {
    errors.password = PASSWORD_REQUIRED;
  } else if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = PASSWORD_TOO_SHORT;
  }
  return errors;
}

export function validateNewPassword(password: string): AccountFieldErrors {
  if (!password) {
    return { password: PASSWORD_REQUIRED };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { password: PASSWORD_TOO_SHORT };
  }
  return {};
}

export function hasAccountFieldErrors(errors: AccountFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function normalizeAccountEmail(email: string): string {
  return normalizeEmailInput(email);
}

export function isSafeNextPath(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") {
    return false;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return false;
  }
  try {
    const parsed = new URL(value, "https://shadesuk.invalid");
    return parsed.origin === "https://shadesuk.invalid" && parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
}

export function isAdminAppPath(value: string): boolean {
  return value === "/admin" || value.startsWith("/admin/");
}

export function resolveSafeNextPath(
  value: string | null | undefined,
  fallback = "/account",
): string {
  if (!isSafeNextPath(value) || isAdminAppPath(value)) {
    return fallback;
  }
  return value;
}

export function resolveSafeAdminNextPath(
  value: string | null | undefined,
  fallback = "/admin",
): string {
  if (!isSafeNextPath(value) || !isAdminAppPath(value)) {
    return fallback;
  }
  return value;
}
