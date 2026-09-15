import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";
import { supabaseAuthCookieOptions } from "./cookie-options";

let browserClient: SupabaseClient | undefined;

/**
 * Browser client for Client Components. Uses the publishable key only, and
 * reuses one instance so a single auth/realtime connection is shared.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { url, publishableKey } = getSupabasePublicConfig();
    browserClient = createBrowserClient(url, publishableKey, {
      cookieOptions: supabaseAuthCookieOptions(),
    });
  }
  return browserClient;
}
