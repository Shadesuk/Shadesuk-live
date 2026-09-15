"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCOUNT_CREATE_FAILED,
  ACCOUNT_EXISTS,
  ACCOUNT_UNAVAILABLE,
  ADDRESS_REMOVED,
  ADDRESS_SAVED,
  CREDENTIALS_INVALID,
  DETAILS_SAVED,
  GOOGLE_FAILED,
  GOOGLE_UNAVAILABLE,
  NETWORK_ERROR,
} from "@/lib/account-copy";
import { getOptionalAccountUser, toAccountUser } from "@/lib/account-session";
import {
  hasAccountFieldErrors,
  normalizeAccountEmail,
  resolveSafeNextPath,
  validateNewPassword,
  validatePersonalDetails,
  validateRegisterInput,
  validateSignInInput,
  validateAccountEmail,
} from "@/lib/account-validate";
import { authAttemptAllowed, authRateLimitKey } from "@/lib/auth-rate-limit";
import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import {
  formatUkPostcode,
  hasCheckoutFieldErrors,
  validateCheckoutAddress,
} from "@/lib/checkout-validate";
import { routes } from "@/lib/navigation";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import { site } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAccountAddress,
  loadAccountProfile,
  removeAccountAddress,
  saveAccountAddress,
  saveAccountProfile,
} from "@/services/account";
import { mergeGuestCartOnSignIn } from "@/services/cart";
import type { AccountMutationResult, AuthActionResult } from "@/types/account";
import { CHECKOUT_COUNTRY_GB } from "@/types/checkout";

export async function signInAction(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<AuthActionResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error", message: NETWORK_ERROR };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error", message: ACCOUNT_UNAVAILABLE };
  }
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    return { status: "error", message: NETWORK_ERROR };
  }
  const errors = validateSignInInput(input);
  if (hasAccountFieldErrors(errors)) {
    return { status: "invalid", errors };
  }
  const email = normalizeAccountEmail(input.email);
  if (!(await allowAuthAttempt("sign-in", email))) {
    return { status: "error", message: CREDENTIALS_INVALID };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (error || !data.user) {
      return { status: "error", message: CREDENTIALS_INVALID };
    }
    await loadAccountProfile(toAccountUser(data.user));
    await mergeGuestCartOnSignIn(data.user.id);
    return { status: "ok", redirectTo: resolveSafeNextPath(input.next) };
  } catch {
    return { status: "error", message: NETWORK_ERROR };
  }
}

export async function registerAction(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  next?: string;
}): Promise<AuthActionResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error", message: NETWORK_ERROR };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error", message: ACCOUNT_UNAVAILABLE };
  }
  if (
    typeof input.firstName !== "string" ||
    typeof input.lastName !== "string" ||
    typeof input.email !== "string" ||
    typeof input.password !== "string"
  ) {
    return { status: "error", message: NETWORK_ERROR };
  }
  const errors = validateRegisterInput(input);
  if (hasAccountFieldErrors(errors)) {
    return { status: "invalid", errors };
  }
  const email = normalizeAccountEmail(input.email);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!(await allowAuthAttempt("register", email))) {
    return { status: "error", message: ACCOUNT_CREATE_FAILED };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        data: { first_name: firstName, last_name: lastName },
        emailRedirectTo: callbackUrl(resolveSafeNextPath(input.next)),
      },
    });
    if (error) {
      if (isExistingAccountError(error.message)) {
        return { status: "error", message: ACCOUNT_EXISTS };
      }
      return { status: "error", message: ACCOUNT_CREATE_FAILED };
    }
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      return { status: "error", message: ACCOUNT_EXISTS };
    }
    if (!data.session || !data.user) {
      return { status: "confirm_email" };
    }
    await loadAccountProfile(toAccountUser(data.user));
    await mergeGuestCartOnSignIn(data.user.id);
    return { status: "ok", redirectTo: resolveSafeNextPath(input.next) };
  } catch {
    return { status: "error", message: NETWORK_ERROR };
  }
}

export async function requestPasswordResetAction(input: {
  email: string;
}): Promise<AuthActionResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error", message: NETWORK_ERROR };
  }
  if (typeof input.email !== "string") {
    return { status: "error", message: NETWORK_ERROR };
  }
  const errors = validateAccountEmail(input.email);
  if (hasAccountFieldErrors(errors)) {
    return { status: "invalid", errors };
  }
  const email = normalizeAccountEmail(input.email);
  if (!(await allowAuthAttempt("reset", email))) {
    return { status: "reset_sent" };
  }
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl(routes.accountResetPassword),
      });
    } catch {
      // Same response whether the mailbox exists or the provider failed.
    }
  }
  return { status: "reset_sent" };
}

export async function updatePasswordAction(input: {
  password: string;
}): Promise<AuthActionResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error", message: NETWORK_ERROR };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error", message: ACCOUNT_UNAVAILABLE };
  }
  if (typeof input.password !== "string") {
    return { status: "error", message: NETWORK_ERROR };
  }
  const errors = validateNewPassword(input.password);
  if (hasAccountFieldErrors(errors)) {
    return { status: "invalid", errors };
  }
  const user = await getOptionalAccountUser();
  if (!user) {
    return { status: "error", message: NETWORK_ERROR };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) {
      return { status: "error", message: NETWORK_ERROR };
    }
    return { status: "ok" };
  } catch {
    return { status: "error", message: NETWORK_ERROR };
  }
}

export async function signInWithGoogleAction(input?: {
  next?: string;
}): Promise<AuthActionResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input ?? {})) {
    return { status: "error", message: NETWORK_ERROR };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error", message: GOOGLE_UNAVAILABLE };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl(resolveSafeNextPath(input?.next)),
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) {
      return { status: "error", message: GOOGLE_UNAVAILABLE };
    }
    return { status: "oauth", url: data.url };
  } catch {
    return { status: "error", message: GOOGLE_FAILED };
  }
}

export async function signOutAction(): Promise<void> {
  if (!(await cartActionOriginAllowed())) {
    redirect(routes.home);
  }
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Continue to a signed-out storefront even if the provider call fails.
    }
  }
  redirect(routes.home);
}

export async function savePersonalDetailsAction(input: {
  firstName: string;
  lastName: string;
}): Promise<AccountMutationResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error", message: NETWORK_ERROR };
  }
  const user = await getOptionalAccountUser();
  if (!user) {
    return { status: "unauthenticated" };
  }
  if (typeof input.firstName !== "string" || typeof input.lastName !== "string") {
    return { status: "error", message: NETWORK_ERROR };
  }
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const errors = validatePersonalDetails({ firstName, lastName });
  if (hasAccountFieldErrors(errors)) {
    return { status: "invalid", errors };
  }
  const saved = await saveAccountProfile({ user, firstName, lastName });
  if (!saved) {
    return { status: "error", message: NETWORK_ERROR };
  }
  return { status: "ok", message: DETAILS_SAVED };
}

export async function saveAddressAction(input: {
  addressId?: string;
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
}): Promise<AccountMutationResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error", message: NETWORK_ERROR };
  }
  const user = await getOptionalAccountUser();
  if (!user) {
    return { status: "unauthenticated" };
  }
  if (
    typeof input.label !== "string" ||
    typeof input.firstName !== "string" ||
    typeof input.lastName !== "string" ||
    typeof input.line1 !== "string" ||
    typeof input.city !== "string" ||
    typeof input.postcode !== "string" ||
    typeof input.country !== "string"
  ) {
    return { status: "error", message: NETWORK_ERROR };
  }
  const fieldErrors = validateCheckoutAddress({
    firstName: input.firstName,
    lastName: input.lastName,
    line1: input.line1,
    city: input.city,
    postcode: input.postcode,
    country: input.country,
  });
  if (hasCheckoutFieldErrors(fieldErrors)) {
    return {
      status: "invalid",
      errors: {
        firstName: fieldErrors.firstName,
        lastName: fieldErrors.lastName,
        line1: fieldErrors.line1,
        city: fieldErrors.city,
        postcode: fieldErrors.postcode,
        country: fieldErrors.country,
      },
    };
  }
  const saved = await saveAccountAddress({
    userId: user.id,
    addressId: typeof input.addressId === "string" ? input.addressId : undefined,
    label: input.label,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    line1: input.line1.trim(),
    line2: typeof input.line2 === "string" ? input.line2 : "",
    city: input.city.trim(),
    county: typeof input.county === "string" ? input.county : "",
    postcode: formatUkPostcode(input.postcode),
    country: input.country.trim() || CHECKOUT_COUNTRY_GB,
  });
  if (!saved) {
    return { status: "error", message: NETWORK_ERROR };
  }
  return { status: "ok", message: ADDRESS_SAVED };
}

export async function removeAddressAction(input: {
  addressId: string;
}): Promise<AccountMutationResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error", message: NETWORK_ERROR };
  }
  const user = await getOptionalAccountUser();
  if (!user) {
    return { status: "unauthenticated" };
  }
  if (typeof input.addressId !== "string" || !input.addressId.trim()) {
    return { status: "error", message: NETWORK_ERROR };
  }
  const owned = await getAccountAddress(user.id, input.addressId);
  if (!owned) {
    return { status: "error", message: NETWORK_ERROR };
  }
  const removed = await removeAccountAddress(user.id, input.addressId);
  if (!removed) {
    return { status: "error", message: NETWORK_ERROR };
  }
  return { status: "ok", message: ADDRESS_REMOVED };
}

async function allowAuthAttempt(kind: "sign-in" | "reset" | "register", email: string) {
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip");
  return authAttemptAllowed(kind, authRateLimitKey(ip, email));
}

function callbackUrl(next: string): string {
  const url = new URL(routes.authCallback, site.url);
  url.searchParams.set("next", next);
  return url.toString();
}

function isExistingAccountError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("already") || lower.includes("registered") || lower.includes("exists");
}
