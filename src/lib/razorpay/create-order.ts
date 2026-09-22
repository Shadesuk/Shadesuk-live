import "server-only";

import { STORE_CURRENCY, type StoreCurrency } from "@/contracts/money";
import { getRazorpayClient } from "./client";
import { razorpayFailureMessage } from "./errors";

export type CreateRazorpayOrderInput = {
  amountMinor: number;
  currency: StoreCurrency;
  receipt: string;
};

export type RazorpayOrderCreated = {
  providerOrderId: string;
  amountMinor: number;
  currency: StoreCurrency;
  receipt: string | null;
  providerStatus: string;
};

export type CreateRazorpayOrderResult =
  | { ok: true; order: RazorpayOrderCreated }
  | { ok: false; error: string };

/**
 * Creates a Razorpay order from an already-authoritative server amount.
 * Callers must pass `authoritativeCheckoutQuote` totals — never client money.
 */
export async function createRazorpayOrder(
  input: CreateRazorpayOrderInput,
): Promise<CreateRazorpayOrderResult> {
  if (input.currency !== STORE_CURRENCY) {
    return { ok: false, error: "Razorpay orders must use GBP." };
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 0) {
    return { ok: false, error: "Razorpay amount must be a non-negative integer in pence." };
  }
  const receipt = input.receipt.trim();
  if (!receipt || receipt.length > 40) {
    return { ok: false, error: "Razorpay receipt is invalid." };
  }

  const clientResult = getRazorpayClient();
  if (!clientResult.ok) {
    return { ok: false, error: "Razorpay is not configured." };
  }

  try {
    const created = await clientResult.client.orders.create({
      amount: input.amountMinor,
      currency: STORE_CURRENCY,
      receipt,
    });
    const parsed = parseCreatedOrder(created, input);
    if (!parsed.ok) {
      return parsed;
    }
    return parsed;
  } catch (error) {
    return { ok: false, error: razorpayFailureMessage(error) };
  }
}

function parseCreatedOrder(
  value: unknown,
  expected: CreateRazorpayOrderInput,
): CreateRazorpayOrderResult {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Razorpay did not return an order." };
  }
  const row = value as Record<string, unknown>;
  const providerOrderId = typeof row.id === "string" ? row.id.trim() : "";
  const amountMinor = asInteger(row.amount);
  const currency = typeof row.currency === "string" ? row.currency.trim().toUpperCase() : "";
  if (!providerOrderId) {
    return { ok: false, error: "Razorpay did not return an order id." };
  }
  if (amountMinor !== expected.amountMinor || currency !== STORE_CURRENCY) {
    return { ok: false, error: "Razorpay order amount or currency did not match the server quote." };
  }
  return {
    ok: true,
    order: {
      providerOrderId,
      amountMinor,
      currency: STORE_CURRENCY,
      receipt: typeof row.receipt === "string" ? row.receipt : null,
      providerStatus: typeof row.status === "string" ? row.status : "created",
    },
  };
}

function asInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return null;
}
