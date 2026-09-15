import type { NextRequest } from "next/server";
import { refreshAccountSession } from "@/lib/supabase/refresh-session";

/**
 * Session refresh for account and auth routes (Next.js 16 Proxy = middleware).
 * Guest checkout is outside the matcher and keeps working without a session.
 */
export async function proxy(request: NextRequest) {
  return refreshAccountSession(request);
}

export const config = {
  matcher: ["/account/:path*", "/auth/:path*"],
};
