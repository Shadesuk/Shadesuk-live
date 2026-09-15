import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { routes } from "@/lib/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isSupabaseAuthCookieName } from "@/lib/supabase/cookie-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountUser } from "@/types/account";

export async function getOptionalAccountUser(): Promise<AccountUser | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  try {
    const store = await cookies();
    if (!store.getAll().some((cookie) => isSupabaseAuthCookieName(cookie.name))) {
      return null;
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    return toAccountUser(data.user);
  } catch {
    return null;
  }
}

export async function requireAccountUser(): Promise<AccountUser> {
  const user = await getOptionalAccountUser();
  if (!user) {
    redirect(routes.account);
  }
  return user;
}

export function toAccountUser(user: User): AccountUser {
  const metadata = isRecord(user.user_metadata) ? user.user_metadata : {};
  const fullName = asString(metadata.full_name) ?? asString(metadata.name);
  const [givenFromFull, ...familyFromFull] = (fullName ?? "").split(/\s+/).filter(Boolean);
  return {
    id: user.id,
    email: user.email?.trim() ?? asString(metadata.email) ?? "",
    firstName:
      asString(metadata.first_name) ??
      asString(metadata.given_name) ??
      givenFromFull ??
      "",
    lastName:
      asString(metadata.last_name) ??
      asString(metadata.family_name) ??
      (familyFromFull.length ? familyFromFull.join(" ") : ""),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
