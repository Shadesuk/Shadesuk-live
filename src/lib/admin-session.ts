import "server-only";

import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import {
  adminRoleLabel,
  toAdminV1Role,
  type AdminV1Role,
} from "@/contracts/admin/roles";
import { isSupabaseAuthCookieName } from "@/lib/supabase/cookie-options";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminActor = {
  id: string;
  email: string;
  role: AdminV1Role;
  roleLabel: "Admin" | "Superadmin";
};

export type AdminGate =
  | { status: "unauthenticated" }
  | { status: "forbidden"; email?: string }
  | { status: "ok"; actor: AdminActor };

type AdminUserRow = {
  role: string;
  is_active: boolean;
};

export async function getAdminGate(): Promise<AdminGate> {
  const user = await getOptionalAuthUser();
  if (!user) {
    return { status: "unauthenticated" };
  }
  const actor = await loadAdminActor(user);
  if (!actor) {
    return { status: "forbidden", email: user.email?.trim() || undefined };
  }
  return { status: "ok", actor };
}

export async function getOptionalAdminActor(): Promise<AdminActor | null> {
  const gate = await getAdminGate();
  return gate.status === "ok" ? gate.actor : null;
}

async function getOptionalAuthUser(): Promise<User | null> {
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
    return data.user;
  } catch {
    return null;
  }
}

async function loadAdminActor(user: User): Promise<AdminActor | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("admin_users")
      .select("role, is_active")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data) {
      return null;
    }
    const row = data as AdminUserRow;
    if (!row.is_active) {
      return null;
    }
    const role = toAdminV1Role(row.role);
    if (!role) {
      return null;
    }
    return {
      id: user.id,
      email: user.email?.trim() ?? "",
      role,
      roleLabel: adminRoleLabel(role),
    };
  } catch {
    return null;
  }
}
