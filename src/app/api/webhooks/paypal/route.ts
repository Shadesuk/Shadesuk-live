import { NextResponse } from "next/server";
import { handlePayPalWebhook } from "@/lib/payment/handle-webhook";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function methodNotAllowed() {
  return NextResponse.json(
    { ok: false },
    { status: 405, headers: { ...NO_STORE, Allow: "POST" } },
  );
}

/**
 * PayPal payment recovery. Signature verified via postback
 * `POST /v1/notifications/verify-webhook-signature` (requires PAYPAL_WEBHOOK_ID).
 * Raw body is read before JSON parse. Capture goes through `captureVerifiedPayment`.
 * Does not expose GET.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers = request.headers;

  const result = await handlePayPalWebhook({
    rawBody,
    transmissionId: headers.get("paypal-transmission-id") ?? "",
    transmissionTime: headers.get("paypal-transmission-time") ?? "",
    transmissionSig: headers.get("paypal-transmission-sig") ?? "",
    certUrl: headers.get("paypal-cert-url") ?? "",
    authAlgo: headers.get("paypal-auth-algo") ?? "",
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: NO_STORE,
  });
}

export async function GET() {
  return methodNotAllowed();
}
