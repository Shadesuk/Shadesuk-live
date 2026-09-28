import "server-only";

import { resolvePayPalServerConfig, resolvePayPalWebhookId } from "./config";
import { getPayPalAccessToken } from "./client";
import { paypalFailureMessage } from "./errors";

export type VerifyPayPalWebhookSignatureInput = {
  /** Exact raw HTTP body bytes as received — do not re-serialize. */
  rawBody: string;
  transmissionId: string;
  transmissionTime: string;
  transmissionSig: string;
  certUrl: string;
  authAlgo: string;
  webhookId?: string;
};

export type VerifyPayPalWebhookSignatureResult =
  | { ok: true; verificationStatus: string }
  | { ok: false; error: string };

/**
 * Postback webhook signature verifier:
 * `POST /v1/notifications/verify-webhook-signature`.
 *
 * Primary path for Phase 4 — uses PAYPAL_WEBHOOK_ID. Does **not** download
 * `paypal-cert-url` (SSRF risk) as the verification method.
 *
 * Note: PayPal mock webhook simulator events do not support postback
 * verification — use sandbox app events for end-to-end tests.
 */
export async function verifyPayPalWebhookSignature(
  input: VerifyPayPalWebhookSignatureInput,
): Promise<VerifyPayPalWebhookSignatureResult> {
  const rawBody = input.rawBody;
  const transmissionId = input.transmissionId.trim();
  const transmissionTime = input.transmissionTime.trim();
  const transmissionSig = input.transmissionSig.trim();
  const certUrl = input.certUrl.trim();
  const authAlgo = input.authAlgo.trim();
  if (!rawBody || !transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return { ok: false, error: "PayPal webhook verification headers or body are incomplete." };
  }

  const webhookResolved =
    typeof input.webhookId === "string" && input.webhookId.trim()
      ? { ok: true as const, webhookId: input.webhookId.trim() }
      : resolvePayPalWebhookId();
  if (!webhookResolved.ok) {
    return { ok: false, error: "PAYPAL_WEBHOOK_ID is not set." };
  }

  let webhookEvent: unknown;
  try {
    webhookEvent = JSON.parse(rawBody) as unknown;
  } catch {
    return { ok: false, error: "PayPal webhook body is not valid JSON." };
  }

  const config = resolvePayPalServerConfig();
  if (!config.ok) {
    return { ok: false, error: "PayPal is not configured." };
  }

  const auth = await getPayPalAccessToken(config.config);
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  try {
    const response = await fetch(
      `${config.config.apiBaseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          transmission_id: transmissionId,
          transmission_time: transmissionTime,
          cert_url: certUrl,
          auth_algo: authAlgo,
          transmission_sig: transmissionSig,
          webhook_id: webhookResolved.webhookId,
          webhook_event: webhookEvent,
        }),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !body) {
      return {
        ok: false,
        error: paypalFailureMessage(body ?? `PayPal webhook verify HTTP ${response.status}`),
      };
    }
    const status =
      typeof body.verification_status === "string" ? body.verification_status.trim() : "";
    if (status.toUpperCase() !== "SUCCESS") {
      return { ok: false, error: `PayPal webhook verification status is ${status || "unknown"}.` };
    }
    return { ok: true, verificationStatus: status };
  } catch (error) {
    return { ok: false, error: paypalFailureMessage(error) };
  }
}
