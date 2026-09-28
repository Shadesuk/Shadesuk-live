/**
 * Phase 2 stub — PayPal JS SDK v6 Buttons load helpers.
 *
 * Phase 3 wires CheckoutReview to `createInstance` + one-time payment session.
 * Until then this module documents script hosts and fails closed so the
 * storefront compiles without capturing or loading secrets.
 *
 * Script hosts (documented):
 * - sandbox: https://www.sandbox.paypal.com/web-sdk/v6/core
 * - live:    https://www.paypal.com/web-sdk/v6/core
 *
 * Auth: public Client ID only (Option A). Never pass CLIENT_SECRET here.
 */

export const PAYPAL_SDK_SCRIPT_SRC_SANDBOX = "https://www.sandbox.paypal.com/web-sdk/v6/core";
export const PAYPAL_SDK_SCRIPT_SRC_LIVE = "https://www.paypal.com/web-sdk/v6/core";

export type OpenPayPalButtonsInput = {
  clientId: string;
  providerOrderId: string;
  paymentId: string;
  mode?: "sandbox" | "live";
};

export type OpenPayPalButtonsResult =
  | { status: "approved"; paypalOrderId: string }
  | { status: "dismissed" }
  | { status: "unavailable"; reason: "phase3_pending" | "missing_input" };

/**
 * Fail-closed placeholder until Phase 3 Buttons UI.
 * Does not load the SDK and never marks a payment captured.
 */
export async function openPayPalButtons(
  input: OpenPayPalButtonsInput,
): Promise<OpenPayPalButtonsResult> {
  const clientId = input.clientId.trim();
  const providerOrderId = input.providerOrderId.trim();
  const paymentId = input.paymentId.trim();
  if (!clientId || !providerOrderId || !paymentId) {
    return { status: "unavailable", reason: "missing_input" };
  }
  return { status: "unavailable", reason: "phase3_pending" };
}

export function paypalSdkScriptSrc(mode: "sandbox" | "live" = "sandbox"): string {
  return mode === "live" ? PAYPAL_SDK_SCRIPT_SRC_LIVE : PAYPAL_SDK_SCRIPT_SRC_SANDBOX;
}
