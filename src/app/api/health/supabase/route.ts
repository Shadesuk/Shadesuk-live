import { NextResponse } from "next/server";
import { checkSupabaseConnection } from "@/lib/supabase/health";

export const dynamic = "force-dynamic";

/**
 * Server-side Supabase connection check. The response carries statuses and
 * variable names only, never keys, connection strings, or upstream bodies.
 */
export async function GET() {
  const report = await checkSupabaseConnection();

  return NextResponse.json(report, {
    status: report.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
