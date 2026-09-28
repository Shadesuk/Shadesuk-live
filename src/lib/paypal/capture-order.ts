import "server-only";

import { STORE_CURRENCY, type StoreCurrency } from "@/contracts/money";
import { payPalValueToGbpMinor } from "./amount";
import { paypalFetchJson } from "./client";
import { parseFetchedOrder, type FetchedPayPalOrder } from "./fetch-order";

export type CapturedPayPalOrder = {
  providerOrderId: string;
  providerPaymentId: string;
  amountMinor: number;
  currency: StoreCurrency;
  providerStatus: string;
  captureStatus: string;
};

export type CapturePayPalOrderResult =
  | { ok: true; capture: CapturedPayPalOrder }
  | { ok: false; error: string; alreadyCaptured?: boolean; body?: unknown };

/**
 * POST /v2/checkout/orders/{id}/capture — provider money capture.
 * Does not write SHADESUK captured state; callers must reconcile then use
 * `captureVerifiedPayment`.
 */
export async function capturePayPalOrder(
  providerOrderId: string,
): Promise<CapturePayPalOrderResult> {
  const id = providerOrderId.trim();
  if (!id) {
    return { ok: false, error: "PayPal order id is missing." };
  }

  const result = await paypalFetchJson({
    method: "POST",
    path: `/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
    idempotencyKey: `capture-${id}`,
    body: {},
  });

  if (!result.ok) {
    const alreadyCaptured = isAlreadyCapturedError(result.body);
    return {
      ok: false,
      error: result.error,
      alreadyCaptured,
      body: result.body,
    };
  }

  return parseCaptureResponse(result.body, id);
}

export function parseCaptureResponse(
  value: unknown,
  expectedOrderId: string,
): CapturePayPalOrderResult {
  const parsed = parseFetchedOrder(value, expectedOrderId);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  return fromFetchedOrder(parsed.order);
}

export function fromFetchedOrder(order: FetchedPayPalOrder): CapturePayPalOrderResult {
  if (!order.providerPaymentId) {
    return { ok: false, error: "PayPal capture id is missing." };
  }
  if (order.captureStatus !== "COMPLETED" && order.providerStatus !== "COMPLETED") {
    return {
      ok: false,
      error: `PayPal capture is not completed (${order.captureStatus ?? order.providerStatus}).`,
    };
  }
  if (order.currency !== STORE_CURRENCY) {
    return { ok: false, error: "PayPal capture currency must be GBP." };
  }
  return {
    ok: true,
    capture: {
      providerOrderId: order.providerOrderId,
      providerPaymentId: order.providerPaymentId,
      amountMinor: order.amountMinor,
      currency: STORE_CURRENCY,
      providerStatus: order.providerStatus,
      captureStatus: order.captureStatus ?? "COMPLETED",
    },
  };
}

/**
 * True only when PayPal returns the documented Orders v2 issue
 * `ORDER_ALREADY_CAPTURED` in `details[].issue`.
 *
 * @see https://developer.paypal.com/api/errors/overview
 * @see https://developer.paypal.com/api/rest/troubleshooting/rest_unprocessable_entity
 *
 * Do **not** treat bare HTTP 422/409 or other `UNPROCESSABLE_ENTITY` issues
 * (e.g. `CARD_EXPIRED`, `ORDER_NOT_APPROVED`) as already-captured — those must
 * not take the GET-reconcile path.
 */
export function isAlreadyCapturedError(body: unknown): boolean {
  if (!body || typeof body !== "object") {
    return false;
  }
  const details = (body as Record<string, unknown>).details;
  if (!Array.isArray(details)) {
    return false;
  }
  for (const detail of details) {
    if (!detail || typeof detail !== "object") {
      continue;
    }
    const issue = (detail as Record<string, unknown>).issue;
    if (
      typeof issue === "string" &&
      issue.trim().toUpperCase() === "ORDER_ALREADY_CAPTURED"
    ) {
      return true;
    }
  }
  return false;
}
