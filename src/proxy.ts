import type { NextRequest } from "next/server";
import { refreshAccountSession } from "@/lib/supabase/refresh-session";

/**
 * Session refresh for account, admin, and auth routes (Next.js 16 Proxy).
 * Guest checkout is outside the matcher and keeps working without a session.
 * This refreshes cookies only — pages still call getUser() to authorize.
 */
export async function proxy(request: NextRequest) {
  return refreshAccountSession(request);
}

export const config = {
  matcher: ["/account/:path*", "/admin", "/admin/:path*", "/auth/:path*"],
};
