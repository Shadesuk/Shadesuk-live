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
    const alreadyCaptured = isAlreadyCapturedError(result.status, result.body);
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

function isAlreadyCapturedError(status: number | undefined, body: unknown): boolean {
  if (status === 422 || status === 409) {
    return true;
  }
  if (!body || typeof body !== "object") {
    return false;
  }
  const row = body as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.toUpperCase() : "";
  if (
    name.includes("ORDER_ALREADY_CAPTURED") ||
    name.includes("CAPTURED") ||
    name === "UNPROCESSABLE_ENTITY"
  ) {
    const details = row.details;
    if (Array.isArray(details)) {
      for (const detail of details) {
        if (!detail || typeof detail !== "object") {
          continue;
        }
        const issue = (detail as Record<string, unknown>).issue;
        if (typeof issue === "string" && issue.toUpperCase().includes("CAPTURED")) {
          return true;
        }
      }
    }
    if (name.includes("ORDER_ALREADY_CAPTURED")) {
      return true;
    }
  }
  return false;
}
