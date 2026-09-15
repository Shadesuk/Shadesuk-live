import { NextResponse } from "next/server";
import { resolveSafeNextPath } from "@/lib/account-validate";
import { routes } from "@/lib/navigation";
import { toAccountUser } from "@/lib/account-session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAccountProfile } from "@/services/account";
import { mergeGuestCartOnSignIn } from "@/services/cart";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = resolveSafeNextPath(requestUrl.searchParams.get("next"));
  const errorParam = requestUrl.searchParams.get("error");
  const origin = requestUrl.origin;

  if (errorParam) {
    const dest = new URL(routes.account, origin);
    dest.searchParams.set("error", errorParam === "access_denied" ? "google_cancelled" : "oauth");
    return NextResponse.redirect(dest);
  }

  if (!code || !isSupabaseConfigured()) {
    const dest = new URL(routes.account, origin);
    dest.searchParams.set("error", "oauth");
    return NextResponse.redirect(dest);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const dest = new URL(routes.account, origin);
      dest.searchParams.set("error", "oauth");
      return NextResponse.redirect(dest);
    }
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await loadAccountProfile(toAccountUser(data.user));
      await mergeGuestCartOnSignIn(data.user.id);
    }
    return NextResponse.redirect(new URL(next, origin));
  } catch {
    const dest = new URL(routes.account, origin);
    dest.searchParams.set("error", "oauth");
    return NextResponse.redirect(dest);
  }
}
