import { guestCartCookieSecure } from "@/lib/guest-cart-cookie-secure";

/** Auth cookies: httpOnly via @supabase/ssr; Secure in production HTTPS. */
export function supabaseAuthCookieOptions(): {
  path: "/";
  sameSite: "lax";
  secure: boolean;
} {
  return {
    path: "/",
    sameSite: "lax",
    secure: guestCartCookieSecure(),
  };
}

export function isSupabaseAuthCookieName(name: string): boolean {
  // PKCE verifier cookies are named `<storageKey>-code-verifier` and
  // `<storageKey>-flow-<id>-code-verifier`. The storage key itself contains
  // `-auth-token`, so a substring check would treat the handshake cookie as a
  // session and call getUser()/getClaims() before the code is exchanged.
  if (name.includes("code-verifier")) {
    return false;
  }
  return name.includes("-auth-token");
}
