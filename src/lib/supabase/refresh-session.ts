import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { resolveSupabasePublicConfig } from "@/lib/supabase/config";
import { supabaseAuthCookieOptions } from "@/lib/supabase/cookie-options";

/**
 * Next.js 16 Proxy equivalent of session middleware.
 * Refreshes the Supabase auth cookies on matching routes. Does not authorize
 * pages by itself — account routes still call getUser() on the server.
 */
export async function refreshAccountSession(request: NextRequest): Promise<NextResponse> {
  // The OAuth callback must exchange the code before any session refresh.
  // getClaims() on a verifier-only cookie can clear the PKCE cookie and make
  // a successful Google round trip look like a failure.
  if (isOAuthCallbackExchange(request)) {
    return NextResponse.next({ request });
  }

  const resolved = resolveSupabasePublicConfig();
  if (!resolved.ok) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(resolved.config.url, resolved.config.publishableKey, {
    cookieOptions: supabaseAuthCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            ...supabaseAuthCookieOptions(),
            secure: options.secure ?? supabaseAuthCookieOptions().secure,
          });
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  // Validates/refreshes the JWT. Do not trust an unverified session object here.
  await supabase.auth.getClaims();
  return response;
}

function isOAuthCallbackExchange(request: NextRequest): boolean {
  if (request.nextUrl.pathname !== "/auth/callback") {
    return false;
  }
  const params = request.nextUrl.searchParams;
  return params.has("code") || params.has("error") || params.has("error_description");
}
