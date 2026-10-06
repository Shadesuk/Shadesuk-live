import "server-only";

import type { PayPalChargeCurrency } from "@/lib/payment/payment-route";
import { payPalValueToChargeMinor } from "./amount";
import { paypalFetchJson } from "./client";

export type FetchedPayPalOrder = {
  providerOrderId: string;
  providerStatus: string;
  amountMinor: number;
  currency: PayPalChargeCurrency;
  customId: string | null;
  invoiceId: string | null;
  /** Capture id when a COMPLETED capture is present; otherwise null. */
  providerPaymentId: string | null;
  captureStatus: string | null;
};

export type FetchPayPalOrderResult =
  | { ok: true; order: FetchedPayPalOrder }
  | { ok: false; error: string };

/**
 * GET /v2/checkout/orders/{id} — reconcile after client return or Capture races.
 */
export async function fetchPayPalOrder(
  providerOrderId: string,
): Promise<FetchPayPalOrderResult> {
  const id = providerOrderId.trim();
  if (!id) {
    return { ok: false, error: "PayPal order id is missing." };
  }

  const result = await paypalFetchJson({
    method: "GET",
    path: `/v2/checkout/orders/${encodeURIComponent(id)}`,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return parseFetchedOrder(result.body, id);
}

export function parseFetchedOrder(
  value: unknown,
  expectedId: string,
): FetchPayPalOrderResult {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "PayPal did not return an order." };
  }
  const row = value as Record<string, unknown>;
  const providerOrderId = typeof row.id === "string" ? row.id.trim() : "";
  if (!providerOrderId || providerOrderId !== expectedId) {
    return { ok: false, error: "PayPal order id did not match." };
  }

  const unit = firstPurchaseUnit(row);
  if (!unit) {
    return { ok: false, error: "PayPal order is missing purchase_units." };
  }
  const amount = unit.amount;
  if (!amount || typeof amount !== "object") {
    return { ok: false, error: "PayPal order is missing amount." };
  }
  const amountRow = amount as Record<string, unknown>;
  const parsedAmount = payPalValueToChargeMinor(amountRow.value, amountRow.currency_code);
  if (!parsedAmount) {
    return { ok: false, error: "PayPal order is not a GBP, EUR, or USD amount with two decimal places." };
  }

  const capture = firstCompletedCapture(unit);
  return {
    ok: true,
    order: {
      providerOrderId,
      providerStatus: typeof row.status === "string" ? row.status : "",
      amountMinor: parsedAmount.amountMinor,
      currency: parsedAmount.currency,
      customId: typeof unit.custom_id === "string" ? unit.custom_id.trim() : null,
      invoiceId: typeof unit.invoice_id === "string" ? unit.invoice_id.trim() : null,
      providerPaymentId: capture?.id ?? null,
      captureStatus: capture?.status ?? null,
    },
  };
}

function firstPurchaseUnit(row: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(row.purchase_units) || row.purchase_units.length === 0) {
    return null;
  }
  const unit = row.purchase_units[0];
  if (!unit || typeof unit !== "object") {
    return null;
  }
  return unit as Record<string, unknown>;
}

function firstCompletedCapture(
  unit: Record<string, unknown>,
): { id: string; status: string } | null {
  const payments = unit.payments;
  if (!payments || typeof payments !== "object") {
    return null;
  }
  const captures = (payments as Record<string, unknown>).captures;
  if (!Array.isArray(captures)) {
    return null;
  }
  for (const entry of captures) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const cap = entry as Record<string, unknown>;
    const id = typeof cap.id === "string" ? cap.id.trim() : "";
    const status = typeof cap.status === "string" ? cap.status.trim() : "";
    if (id && status === "COMPLETED") {
      return { id, status };
    }
  }
  // Prefer any capture id if present (reconcile may still reject non-COMPLETED).
  for (const entry of captures) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const cap = entry as Record<string, unknown>;
    const id = typeof cap.id === "string" ? cap.id.trim() : "";
    const status = typeof cap.status === "string" ? cap.status.trim() : "";
    if (id) {
      return { id, status };
    }
  }
  return null;
}
