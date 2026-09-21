import "server-only";

import { Resend } from "resend";
import { resolveResendWebhookSecret } from "./config";

export type ResendWebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

export type VerifyResendWebhookResult =
  | { ok: true; event: ReturnType<Resend["webhooks"]["verify"]> }
  | { ok: false; error: "missing_secret" | "invalid_signature" | "missing_headers" };

/**
 * Official Resend/Svix verification. Uses the raw body; never re-serialised JSON.
 */
export function verifyResendWebhook(input: {
  payload: string;
  headers: Partial<ResendWebhookHeaders>;
  webhookSecret?: string;
}): VerifyResendWebhookResult {
  const secret = input.webhookSecret ?? resolveResendWebhookSecret();
  if (!secret) {
    return { ok: false, error: "missing_secret" };
  }
  const id = input.headers.id?.trim() ?? "";
  const timestamp = input.headers.timestamp?.trim() ?? "";
  const signature = input.headers.signature?.trim() ?? "";
  if (!id || !timestamp || !signature) {
    return { ok: false, error: "missing_headers" };
  }

  try {
    const event = new Resend().webhooks.verify({
      payload: input.payload,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    });
    return { ok: true, event };
  } catch {
    return { ok: false, error: "invalid_signature" };
  }
}

export function resendWebhookHeadersFromRequest(headers: Headers): Partial<ResendWebhookHeaders> {
  return {
    id: headers.get("svix-id") ?? "",
    timestamp: headers.get("svix-timestamp") ?? "",
    signature: headers.get("svix-signature") ?? "",
  };
}
