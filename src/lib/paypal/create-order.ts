import "server-only";

import { STORE_CURRENCY, type StoreCurrency } from "@/contracts/money";
import { isUuid } from "@/lib/ids";
import { gbpMinorToPayPalValue, payPalValueToGbpMinor } from "./amount";
import { paypalFetchJson } from "./client";
import { paypalFailureMessage } from "./errors";

/** Documented purchase_unit.invoice_id max length. Fail closed — never truncate. */
export const PAYPAL_INVOICE_ID_MAX_LENGTH = 127;

export type CreatePayPalOrderInput = {
  amountMinor: number;
  currency: StoreCurrency;
  /** payments.id — mapped to purchase_units[].custom_id */
  customId: string;
  /** orders.order_reference — mapped to purchase_units[].invoice_id when ≤ 127 */
  invoiceId: string;
};

export type PayPalOrderCreated = {
  providerOrderId: string;
  amountMinor: number;
  currency: StoreCurrency;
  providerStatus: string;
  customId: string;
  invoiceId: string;
};

export type CreatePayPalOrderResult =
  | { ok: true; order: PayPalOrderCreated }
  | { ok: false; error: string };

/**
 * Creates a PayPal Orders v2 order (`intent: CAPTURE`) from a server-authoritative quote.
 * Never accepts client money fields.
 */
export async function createPayPalOrder(
  input: CreatePayPalOrderInput,
): Promise<CreatePayPalOrderResult> {
  if (input.currency !== STORE_CURRENCY) {
    return { ok: false, error: "PayPal orders must use GBP." };
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 1) {
    return { ok: false, error: "PayPal amount must be a positive integer in pence." };
  }
  const customId = input.customId.trim();
  if (!isUuid(customId)) {
    return { ok: false, error: "PayPal custom_id must be the payments.id UUID." };
  }
  const invoiceId = input.invoiceId.trim();
  if (!invoiceId) {
    return { ok: false, error: "PayPal invoice_id (order_reference) is required." };
  }
  if (invoiceId.length > PAYPAL_INVOICE_ID_MAX_LENGTH) {
    return {
      ok: false,
      error: `PayPal invoice_id exceeds ${PAYPAL_INVOICE_ID_MAX_LENGTH} characters; refusing to truncate.`,
    };
  }

  const value = gbpMinorToPayPalValue(input.amountMinor);
  if (!value) {
    return { ok: false, error: "PayPal amount could not be formatted." };
  }

  const result = await paypalFetchJson({
    method: "POST",
    path: "/v2/checkout/orders",
    idempotencyKey: `create-${customId}`,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: STORE_CURRENCY,
            value,
          },
          custom_id: customId,
          invoice_id: invoiceId,
        },
      ],
    },
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  try {
    return parseCreatedOrder(result.body, input);
  } catch (error) {
    return { ok: false, error: paypalFailureMessage(error) };
  }
}

export function parseCreatedOrder(
  value: unknown,
  expected: CreatePayPalOrderInput,
): CreatePayPalOrderResult {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "PayPal did not return an order." };
  }
  const row = value as Record<string, unknown>;
  const providerOrderId = typeof row.id === "string" ? row.id.trim() : "";
  if (!providerOrderId) {
    return { ok: false, error: "PayPal did not return an order id." };
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
  const amountMinor = payPalValueToGbpMinor(amountRow.value, amountRow.currency_code);
  if (amountMinor == null || amountMinor !== expected.amountMinor) {
    return { ok: false, error: "PayPal order amount or currency did not match the server quote." };
  }

  const customId =
    typeof unit.custom_id === "string" ? unit.custom_id.trim() : expected.customId.trim();
  const invoiceId =
    typeof unit.invoice_id === "string" ? unit.invoice_id.trim() : expected.invoiceId.trim();

  return {
    ok: true,
    order: {
      providerOrderId,
      amountMinor,
      currency: STORE_CURRENCY,
      providerStatus: typeof row.status === "string" ? row.status : "CREATED",
      customId,
      invoiceId,
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
