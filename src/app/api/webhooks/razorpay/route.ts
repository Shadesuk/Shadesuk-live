import { NextResponse } from "next/server";
import { handleRazorpayWebhook } from "@/lib/razorpay/webhook";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function methodNotAllowed() {
  return NextResponse.json({ ok: false }, { status: 405, headers: { ...NO_STORE, Allow: "POST" } });
}

/**
 * Razorpay recovery. The signature is checked against the raw body.
 * Does not expose GET. Does not mark an order captured from a redirect.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleRazorpayWebhook({
    rawBody,
    signature: request.headers.get("x-razorpay-signature") ?? "",
  });
  return NextResponse.json(result.body, { status: result.status, headers: NO_STORE });
}

export async function GET() {
  return methodNotAllowed();
}
