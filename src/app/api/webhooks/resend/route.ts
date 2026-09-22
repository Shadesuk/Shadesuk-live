import { NextResponse } from "next/server";
import { processVerifiedResendWebhook, webhookEmailIdFromEvent } from "@/lib/email/webhook";
import {
  resendWebhookHeadersFromRequest,
  verifyResendWebhook,
} from "@/lib/email/webhook-verify";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function methodNotAllowed() {
  return NextResponse.json({ ok: false }, { status: 405, headers: { ...NO_STORE, Allow: "POST" } });
}

/**
 * Resend delivery webhooks. Signature-verified. Updates email_events
 * delivery_status only — never orders, payments, or shipments.
 */
export async function POST(request: Request) {
  const payload = await request.text();
  const headers = resendWebhookHeadersFromRequest(request.headers);
  const verified = verifyResendWebhook({ payload, headers });

  if (!verified.ok) {
    if (verified.error === "missing_secret") {
      console.error("Resend webhook rejected", { reason: "missing_secret" });
      return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
    }
    console.error("Resend webhook rejected", { reason: verified.error });
    return NextResponse.json({ ok: false }, { status: 400, headers: NO_STORE });
  }

  const event = verified.event;
  const emailId = webhookEmailIdFromEvent(event);
  const result = await processVerifiedResendWebhook({
    type: event.type,
    createdAt: event.created_at,
    emailId,
    providerEventId: headers.id?.trim() || "",
  });

  if (result.outcome === "unmatched") {
    console.error("Resend webhook unmatched", { type: event.type, emailId });
  } else if (result.httpStatus >= 500) {
    console.error("Resend webhook processing failed", { type: event.type, emailId });
  }

  return NextResponse.json(
    { ok: result.httpStatus < 400, outcome: result.outcome },
    { status: result.httpStatus, headers: NO_STORE },
  );
}

export async function GET() {
  return methodNotAllowed();
}
