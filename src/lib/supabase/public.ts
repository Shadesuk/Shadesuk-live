import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

/**
 * Cookie-less publishable-key client for public catalogue reads.
 * Row level security still applies. Do not use for user-owned rows.
 */
export function createSupabasePublicClient(): SupabaseClient {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
