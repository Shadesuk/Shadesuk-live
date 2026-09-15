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
  return name.includes("-auth-token");
}
