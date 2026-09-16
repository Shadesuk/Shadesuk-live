"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { toAdminV1Role } from "@/contracts/admin/roles";
import { NETWORK_ERROR } from "@/lib/account-copy";
import {
  hasAccountFieldErrors,
  normalizeAccountEmail,
  resolveSafeAdminNextPath,
  validateSignInInput,
} from "@/lib/account-validate";
import {
  ADMIN_CREDENTIALS_INVALID,
  ADMIN_FORBIDDEN,
  ADMIN_UNAVAILABLE,
} from "@/lib/admin-copy";
import { authAttemptAllowed, authRateLimitKey } from "@/lib/auth-rate-limit";
import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { routes } from "@/lib/navigation";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionResult } from "@/types/account";

export async function adminSignInAction(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<AuthActionResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error", message: NETWORK_ERROR };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error", message: ADMIN_UNAVAILABLE };
  }
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    return { status: "error", message: NETWORK_ERROR };
  }
  const errors = validateSignInInput(input);
  if (hasAccountFieldErrors(errors)) {
    return { status: "invalid", errors };
  }
  const email = normalizeAccountEmail(input.email);
  if (!(await allowAdminAuthAttempt(email))) {
    return { status: "error", message: ADMIN_CREDENTIALS_INVALID };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (error || !data.user) {
      return { status: "error", message: ADMIN_CREDENTIALS_INVALID };
    }

    const staff = await supabase
      .from("admin_users")
      .select("role, is_active")
      .eq("user_id", data.user.id)
      .maybeSingle();

    const role = toAdminV1Role(
      staff.data && typeof staff.data.role === "string" ? staff.data.role : null,
    );
    const active = Boolean(staff.data && staff.data.is_active);
    if (staff.error || !role || !active) {
      await supabase.auth.signOut();
      return { status: "error", message: ADMIN_FORBIDDEN };
    }

    return { status: "ok", redirectTo: resolveSafeAdminNextPath(input.next) };
  } catch {
    return { status: "error", message: NETWORK_ERROR };
  }
}

export async function adminSignOutAction(): Promise<void> {
  if (!(await cartActionOriginAllowed())) {
    redirect(routes.admin);
  }
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Stay on the admin entrypoint even if the provider call fails.
    }
  }
  redirect(routes.admin);
}

async function allowAdminAuthAttempt(email: string): Promise<boolean> {
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip");
  return authAttemptAllowed("sign-in", authRateLimitKey(ip, email));
}
