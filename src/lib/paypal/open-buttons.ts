/**
 * PayPal JS SDK v6 Buttons — client-only.
 *
 * Auth: public Client ID from initiation Server Action (never CLIENT_SECRET).
 * createOrder returns the already-created provider order id — never a second
 * PayPal order and never client-supplied amounts.
 * onApprove only returns the order id to the caller; capture is server-side.
 *
 * Script hosts (documented):
 * - sandbox: https://www.sandbox.paypal.com/web-sdk/v6/core
 * - live:    https://www.paypal.com/web-sdk/v6/core
 */

export const PAYPAL_SDK_SCRIPT_SRC_SANDBOX = "https://www.sandbox.paypal.com/web-sdk/v6/core";
export const PAYPAL_SDK_SCRIPT_SRC_LIVE = "https://www.paypal.com/web-sdk/v6/core";

export type PayPalBrowserMode = "sandbox" | "live";

export type OpenPayPalButtonsInput = {
  clientId: string;
  providerOrderId: string;
  paymentId: string;
  /** Must match server PAYPAL_MODE from initiation — never hardcode live. */
  mode: PayPalBrowserMode;
};

export type OpenPayPalButtonsResult =
  | { status: "approved"; paypalOrderId: string }
  | { status: "dismissed" }
  | {
      status: "unavailable";
      reason: "missing_input" | "script_failed" | "not_eligible" | "sdk_error" | "order_mismatch";
    };

type PayPalEligibleMethods = {
  isEligible: (method: string) => boolean;
};

type PayPalOneTimePaymentSession = {
  start: (
    options: { presentationMode?: string },
    orderPromise: Promise<{ orderId: string }>,
  ) => Promise<void>;
};

type PayPalSdkInstance = {
  findEligibleMethods: (input: { currencyCode: string }) => Promise<PayPalEligibleMethods>;
  createPayPalOneTimePaymentSession: (options: {
    onApprove: (data: { orderId?: string }) => void | Promise<void>;
    onCancel?: (data?: unknown) => void;
    onError?: (error?: unknown) => void;
  }) => PayPalOneTimePaymentSession;
};

type PayPalNamespace = {
  createInstance: (options: {
    clientId: string;
    components: string[];
    pageType?: string;
  }) => Promise<PayPalSdkInstance>;
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

export function paypalSdkScriptSrc(mode: PayPalBrowserMode): string {
  return mode === "live" ? PAYPAL_SDK_SCRIPT_SRC_LIVE : PAYPAL_SDK_SCRIPT_SRC_SANDBOX;
}

/**
 * Loads SDK v6, checks GBP PayPal eligibility, starts a one-time payment
 * session with the server-created order id, and resolves on approve/cancel/error.
 * Never marks SHADESUK payments captured.
 */
export async function openPayPalButtons(
  input: OpenPayPalButtonsInput,
): Promise<OpenPayPalButtonsResult> {
  if (typeof window === "undefined") {
    return { status: "unavailable", reason: "sdk_error" };
  }

  const clientId = input.clientId.trim();
  const providerOrderId = input.providerOrderId.trim();
  const paymentId = input.paymentId.trim();
  const mode: PayPalBrowserMode = input.mode === "live" ? "live" : "sandbox";
  if (!clientId || !providerOrderId || !paymentId) {
    return { status: "unavailable", reason: "missing_input" };
  }

  const loaded = await loadPayPalSdkScript(mode);
  if (!loaded || !window.paypal?.createInstance) {
    return { status: "unavailable", reason: "script_failed" };
  }

  let sdk: PayPalSdkInstance;
  try {
    sdk = await window.paypal.createInstance({
      clientId,
      components: ["paypal-payments"],
      pageType: "checkout",
    });
  } catch {
    return { status: "unavailable", reason: "sdk_error" };
  }

  try {
    const methods = await sdk.findEligibleMethods({ currencyCode: "GBP" });
    if (!methods.isEligible("paypal")) {
      return { status: "unavailable", reason: "not_eligible" };
    }
  } catch {
    return { status: "unavailable", reason: "not_eligible" };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: OpenPayPalButtonsResult) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    const session = sdk.createPayPalOneTimePaymentSession({
      async onApprove(data) {
        const orderId = typeof data?.orderId === "string" ? data.orderId.trim() : "";
        if (!orderId) {
          finish({ status: "unavailable", reason: "sdk_error" });
          return;
        }
        if (orderId !== providerOrderId) {
          finish({ status: "unavailable", reason: "order_mismatch" });
          return;
        }
        finish({ status: "approved", paypalOrderId: orderId });
      },
      onCancel() {
        finish({ status: "dismissed" });
      },
      onError() {
        finish({ status: "unavailable", reason: "sdk_error" });
      },
    });

    // Already-created server order — never invent amounts or a second order here.
    void session
      .start({ presentationMode: "auto" }, Promise.resolve({ orderId: providerOrderId }))
      .catch(() => {
        finish({ status: "unavailable", reason: "sdk_error" });
      });
  });
}

async function loadPayPalSdkScript(mode: PayPalBrowserMode): Promise<boolean> {
  const src = paypalSdkScriptSrc(mode);
  if (window.paypal?.createInstance) {
    return true;
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[data-paypal-sdk="v6"]`);
  if (existing) {
    if (existing.getAttribute("src") !== src) {
      // Mode changed — replace script.
      existing.remove();
      delete window.paypal;
    } else {
      return waitForPayPalNamespace();
    }
  }

  const ok = await new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.paypalSdk = "v6";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  if (!ok) {
    return false;
  }
  return waitForPayPalNamespace();
}

function waitForPayPalNamespace(): Promise<boolean> {
  if (window.paypal?.createInstance) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.paypal?.createInstance) {
        window.clearInterval(timer);
        resolve(true);
      } else if (Date.now() - started > 8000) {
        window.clearInterval(timer);
        resolve(false);
      }
    }, 50);
  });
}
