import { NextResponse } from "next/server";
import { handleRazorpayWebhook } from "@/lib/payment/handle-webhook";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Razorpay payment recovery. Signature is verified against the raw body.
 * Does not expose GET. Capture still goes through captureVerifiedRazorpayPayment.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const eventIdHeader = request.headers.get("x-razorpay-event-id") ?? "";

  const result = await handleRazorpayWebhook({
    rawBody,
    signature,
    eventIdHeader,
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: NO_STORE,
  });
}
