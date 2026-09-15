import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "./config";
import { supabaseAuthCookieOptions } from "./cookie-options";

/**
 * Request-scoped client for Server Components, Server Actions, and Route
 * Handlers. Runs with the publishable key and the caller's cookies, so row
 * level security applies to every query.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, publishableKey } = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const authCookies = supabaseAuthCookieOptions();

  return createServerClient(url, publishableKey, {
    cookieOptions: authCookies,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, {
              ...options,
              ...authCookies,
              secure: options.secure ?? authCookies.secure,
            });
          }
          void headers;
        } catch {
          // Server Components cannot write cookies. Session refresh has to
          // happen in a Route Handler, Server Action, or proxy.
        }
      },
    },
  });
}
