import { NextResponse } from "next/server";
import {
  AUTH_RETURN_COOKIE,
  readAuthReturnCookieHeader,
  resolveAuthReturnPath,
} from "@/lib/auth-return";
import { guestCartCookieSecure } from "@/lib/guest-cart-cookie-secure";
import { toAccountUser } from "@/lib/account-session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAccountProfile } from "@/services/account";
import { mergeGuestCartOnSignIn } from "@/services/cart";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = resolveAuthReturnPath({
    queryNext: requestUrl.searchParams.get("next"),
    cookieNext: readAuthReturnCookieHeader(request.headers.get("cookie"), AUTH_RETURN_COOKIE),
  });
  const errorParam = requestUrl.searchParams.get("error");

  if (errorParam) {
    return redirectWithReturnCleared(
      request,
      next,
      errorParam === "access_denied" ? "google_cancelled" : "oauth",
    );
  }

  if (!code || !isSupabaseConfigured()) {
    return redirectWithReturnCleared(request, next, "oauth");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectWithReturnCleared(request, next, "oauth");
    }
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await loadAccountProfile(toAccountUser(data.user));
      await mergeGuestCartOnSignIn(data.user.id);
    }
    return redirectWithReturnCleared(request, next);
  } catch {
    return redirectWithReturnCleared(request, next, "oauth");
  }
}

function redirectWithReturnCleared(request: Request, next: string, error?: string) {
  const dest = new URL(next, new URL(request.url).origin);
  if (error) {
    dest.searchParams.set("error", error);
  }
  const response = NextResponse.redirect(dest);
  response.cookies.set({
    name: AUTH_RETURN_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: guestCartCookieSecure(),
    maxAge: 0,
  });
  return response;
}
