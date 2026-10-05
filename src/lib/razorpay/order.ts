import "server-only";

import type { CheckoutQuoteLock } from "@/lib/checkout-quote-lock";
import { indiaLockIsChargeable } from "@/lib/payment/resolve-provider";
import { resolveRazorpayServerConfig, type RazorpayServerConfig } from "./config";

export const RAZORPAY_API_ORIGIN = "https://api.razorpay.com";

export type RazorpayOrderCreated = {
  providerOrderId: string;
  amountMinor: number;
  currency: "INR";
  fxRateId: string;
};

export type CreateRazorpayOrderResult =
  | { ok: true; order: RazorpayOrderCreated }
  | { ok: false; error: string };

/**
 * Creates a Razorpay order from the quote lock only.
 * Amount and currency arguments from the client are not accepted.
 * `payment_capture` stays manual so a browser return cannot capture by itself.
 */
export function razorpayOrderPayload(lock: CheckoutQuoteLock, receipt: string): {
  amount: number;
  currency: "INR";
  receipt: string;
  payment_capture: 0;
  notes: { fx_rate_id: string };
} | null {
  if (!indiaLockIsChargeable(lock) || !lock.fxRateId) {
    return null;
  }
  const trimmed = receipt.trim();
  if (!trimmed || trimmed.length > 40) {
    return null;
  }
  return {
    amount: lock.chargeTotalMinor,
    currency: "INR",
    receipt: trimmed,
    payment_capture: 0,
    notes: { fx_rate_id: lock.fxRateId },
  };
}

export async function createRazorpayOrder(input: {
  lock: CheckoutQuoteLock;
  receipt: string;
  config?: RazorpayServerConfig;
  fetchImpl?: typeof fetch;
}): Promise<CreateRazorpayOrderResult> {
  const payload = razorpayOrderPayload(input.lock, input.receipt);
  if (!payload || !input.lock.fxRateId) {
    return { ok: false, error: "Razorpay order requires a locked INR total and FX rate." };
  }
  const config = input.config ?? resolvedConfig();
  if (!config) {
    return { ok: false, error: "Razorpay is not configured." };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${RAZORPAY_API_ORIGIN}/v1/orders`, {
      method: "POST",
      headers: {
        Authorization: basicAuth(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: "Razorpay order request failed." };
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok || !json || typeof json !== "object") {
    return { ok: false, error: "Razorpay order was rejected." };
  }
  const record = json as Record<string, unknown>;
  const providerOrderId = typeof record.id === "string" ? record.id : "";
  const amount = typeof record.amount === "number" ? record.amount : Number(record.amount);
  const currency = typeof record.currency === "string" ? record.currency : "";
  if (!providerOrderId.startsWith("order_") || amount !== payload.amount || currency !== "INR") {
    return { ok: false, error: "Razorpay order amount did not match the locked quote." };
  }
  return {
    ok: true,
    order: {
      providerOrderId,
      amountMinor: payload.amount,
      currency: "INR",
      fxRateId: input.lock.fxRateId,
    },
  };
}

export type RazorpayRemotePayment = {
  id: string;
  orderId: string;
  amountMinor: number;
  currency: "INR";
  status: string;
};

export async function fetchRazorpayPayment(input: {
  paymentId: string;
  config?: RazorpayServerConfig;
  fetchImpl?: typeof fetch;
}): Promise<RazorpayRemotePayment | null> {
  const config = input.config ?? resolvedConfig();
  if (!config || !input.paymentId.startsWith("pay_")) {
    return null;
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${RAZORPAY_API_ORIGIN}/v1/payments/${input.paymentId}`, {
      headers: { Authorization: basicAuth(config) },
    });
  } catch {
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok || !json || typeof json !== "object") {
    return null;
  }
  const record = json as Record<string, unknown>;
  const amount = typeof record.amount === "number" ? record.amount : Number(record.amount);
  const currency = typeof record.currency === "string" ? record.currency : "";
  const orderId = typeof record.order_id === "string" ? record.order_id : "";
  const status = typeof record.status === "string" ? record.status : "";
  if (!Number.isInteger(amount) || currency !== "INR" || !orderId.startsWith("order_") || !status) {
    return null;
  }
  return { id: input.paymentId, orderId, amountMinor: amount, currency: "INR", status };
}

export async function captureRazorpayPayment(input: {
  paymentId: string;
  amountMinor: number;
  currency: "INR";
  config?: RazorpayServerConfig;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const config = input.config ?? resolvedConfig();
  if (!config || !Number.isInteger(input.amountMinor) || input.amountMinor < 1) {
    return false;
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${RAZORPAY_API_ORIGIN}/v1/payments/${input.paymentId}/capture`, {
      method: "POST",
      headers: {
        Authorization: basicAuth(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: input.amountMinor, currency: "INR" }),
    });
  } catch {
    return false;
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok || !json || typeof json !== "object") {
    return false;
  }
  const record = json as Record<string, unknown>;
  const amount = typeof record.amount === "number" ? record.amount : Number(record.amount);
  return amount === input.amountMinor && record.currency === "INR";
}

function resolvedConfig(): RazorpayServerConfig | null {
  const resolved = resolveRazorpayServerConfig();
  return resolved.ok ? resolved.config : null;
}

function basicAuth(config: RazorpayServerConfig): string {
  return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;
}
