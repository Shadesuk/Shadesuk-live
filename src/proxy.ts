import { NextResponse, type NextRequest } from "next/server";
import { oauthCallbackRecoveryPath } from "@/lib/auth-recovery";
import { refreshAccountSession } from "@/lib/supabase/refresh-session";

/**
 * Session refresh for account, admin, and auth routes (Next.js 16 Proxy).
 * Guest checkout is outside the matcher and keeps working without a session.
 * The homepage is matched only so an OAuth `code` that Supabase dropped on
 * the Site URL can be forwarded to `/auth/callback`. Other homepage requests
 * are not session-refreshed.
 */
export async function proxy(request: NextRequest) {
  const recovery = oauthCallbackRecoveryPath(request.nextUrl);
  if (recovery) {
    return NextResponse.redirect(new URL(recovery, request.url));
  }
  if (request.nextUrl.pathname === "/") {
    return NextResponse.next();
  }
  return refreshAccountSession(request);
}

export const config = {
  matcher: ["/", "/account/:path*", "/admin", "/admin/:path*", "/auth/:path*"],
};
