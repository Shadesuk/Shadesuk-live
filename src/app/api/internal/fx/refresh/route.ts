import { NextResponse } from "next/server";
import { handleFxRefreshRequest } from "@/lib/fx/refresh-request";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function methodNotAllowed() {
  return NextResponse.json({ ok: false }, { status: 405, headers: { ...NO_STORE, Allow: "POST" } });
}

/**
 * Daily FX cache refresh. Requires FX_UPDATE_SECRET.
 * Does not read rates from the request and does not return secrets.
 */
export async function POST(request: Request) {
  const result = await handleFxRefreshRequest({
    authorization: request.headers.get("authorization"),
  });
  return NextResponse.json(result.body, { status: result.status, headers: NO_STORE });
}

export function GET() {
  return methodNotAllowed();
}

export function PUT() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}
