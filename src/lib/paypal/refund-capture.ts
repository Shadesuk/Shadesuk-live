import "server-only";

import { gbpMinorToPayPalValue } from "./amount";
import { paypalFetchJson } from "./client";
import { paypalFailureMessage } from "./errors";

export type PayPalRefundResult =
  | { ok: true; refundId: string | null }
  | { ok: false; error: string };

/**
 * Refund a captured PayPal payment. Idempotent via PayPal-Request-Id.
 * Does not mark the local order; the cancellation transaction does that first
 * so a concurrent dispatch cannot ship a cancelled order.
 */
export async function refundPayPalCapture(input: {
  captureId: string;
  amountMinor: number;
  currency: "GBP";
  idempotencyKey: string;
}): Promise<PayPalRefundResult> {
  const captureId = input.captureId.trim();
  const value = gbpMinorToPayPalValue(input.amountMinor);
  if (!captureId || !value || input.currency !== "GBP") {
    return { ok: false, error: "PayPal refund amount is invalid." };
  }

  const response = await paypalFetchJson({
    path: `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: {
      amount: {
        currency_code: "GBP",
        value,
      },
    },
  });

  if (!response.ok) {
    if (isAlreadyRefunded(response.body)) {
      return { ok: true, refundId: readRefundId(response.body) };
    }
    return { ok: false, error: response.error };
  }

  return { ok: true, refundId: readRefundId(response.body) };
}

function readRefundId(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const id = (body as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function isAlreadyRefunded(body: unknown): boolean {
  const message = `${paypalFailureMessage(body)} ${JSON.stringify(body ?? "")}`.toLowerCase();
  return (
    message.includes("capture_fully_refunded") ||
    message.includes("already been refunded") ||
    message.includes("already refunded")
  );
}
