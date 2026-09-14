import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

/**
 * Service-role access. This module must never be imported from a Client
 * Component: `server-only` turns any such import into a build error, and the
 * secret is read from a non-`NEXT_PUBLIC_` variable so it can never be inlined
 * into a browser bundle.
 */

/** Secret keys are the current name; service-role keys stay supported. */
function resolveSecretKey(): string {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

export function hasSupabaseSecretKey(): boolean {
  return resolveSecretKey().length > 0;
}

export function getSupabaseSecretKey(): string {
  const key = resolveSecretKey();
  if (!key) {
    throw new Error(
      "Supabase service-role access is not configured: SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set.",
    );
  }
  return key;
}

/**
 * Bypasses row level security. Use only for trusted server work, never to serve
 * data straight to an unauthenticated request.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const { url } = getSupabasePublicConfig();

  return createClient(url, getSupabaseSecretKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
