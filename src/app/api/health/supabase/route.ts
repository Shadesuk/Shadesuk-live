import { NextResponse } from "next/server";
import { checkSupabaseConnection } from "@/lib/supabase/health";

export const dynamic = "force-dynamic";

/**
 * Server-side Supabase connection check. The response carries statuses and
 * variable names only, never keys, connection strings, or upstream bodies.
 *
 * The endpoint is unauthenticated, so in production it answers with the verdict
 * alone: which variables are missing is operational detail, and it belongs in
 * the server log rather than in a public response.
 */
export async function GET() {
  const report = await checkSupabaseConnection();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && !report.ok) {
    console.error("Supabase connection check failed", {
      configured: report.configured,
      issues: report.issues,
      warnings: report.warnings,
      probes: report.probes,
    });
  }

  return NextResponse.json(
    isProduction ? { ok: report.ok, checkedAt: report.checkedAt } : report,
    {
      status: report.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
