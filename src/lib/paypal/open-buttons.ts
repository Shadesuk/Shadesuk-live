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
  hasReturned?: () => boolean;
  resume?: () => Promise<void>;
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

export type MountPayPalCheckoutInput = {
  container: HTMLElement;
  clientId: string;
  mode: PayPalBrowserMode;
  createOrder: () => Promise<{ orderId: string } | null>;
  onApprove: (paypalOrderId: string) => Promise<void>;
  onCancel: () => void;
  onError: (kind: "declined" | "network" | "sdk") => void;
};

/**
 * Official PayPal JS SDK v6 `paypal-button`. `createOrder` must return the
 * server-created order id. Approval is reported to the caller; this function
 * never captures.
 *
 * If the buyer is returning from a redirect (`hasReturned`), the session is
 * resumed so `onApprove` still runs on this page.
 */
export async function mountPayPalCheckout(input: MountPayPalCheckoutInput): Promise<() => void> {
  const noop = () => undefined;
  if (typeof window === "undefined") {
    input.onError("sdk");
    return noop;
  }
  const clientId = input.clientId.trim();
  const mode: PayPalBrowserMode = input.mode === "live" ? "live" : "sandbox";
  if (!clientId) {
    input.onError("sdk");
    return noop;
  }
  const loaded = await loadPayPalSdkScript(mode);
  if (!loaded || !window.paypal?.createInstance) {
    input.onError("sdk");
    return noop;
  }

  let sdk: PayPalSdkInstance;
  try {
    sdk = await window.paypal.createInstance({
      clientId,
      components: ["paypal-payments"],
      pageType: "checkout",
    });
  } catch {
    input.onError("sdk");
    return noop;
  }

  try {
    const methods = await sdk.findEligibleMethods({ currencyCode: "GBP" });
    if (!methods.isEligible("paypal")) {
      input.onError("sdk");
      return noop;
    }
  } catch {
    input.onError("sdk");
    return noop;
  }

  let settled = false;
  const session = sdk.createPayPalOneTimePaymentSession({
    async onApprove(data) {
      const orderId = typeof data?.orderId === "string" ? data.orderId.trim() : "";
      if (!orderId) {
        input.onError("sdk");
        return;
      }
      await input.onApprove(orderId);
    },
    onCancel() {
      if (settled) {
        return;
      }
      input.onCancel();
    },
    onError(error) {
      if (settled) {
        return;
      }
      input.onError(paypalErrorKind(error));
    },
  });

  if (typeof session.hasReturned === "function" && session.hasReturned()) {
    try {
      await session.resume?.();
    } catch {
      input.onError("sdk");
    }
    return noop;
  }

  const button = document.createElement("paypal-button");
  button.setAttribute("type", "pay");
  button.className = "paypal-gold";
  const onClick = () => {
    if (settled) {
      return;
    }
    // Pass the order promise into start immediately so the PayPal window
    // stays tied to this click. The server creates the order inside the promise.
    const orderPromise = input.createOrder().then((created) => {
      if (!created?.orderId) {
        throw new Error("paypal_order_not_created");
      }
      return { orderId: created.orderId };
    });
    void session.start({ presentationMode: "auto" }, orderPromise).catch((error: unknown) => {
      if (error instanceof Error && error.message === "paypal_order_not_created") {
        return;
      }
      input.onError("sdk");
    });
  };
  button.addEventListener("click", onClick);
  input.container.replaceChildren(button);

  return () => {
    settled = true;
    button.removeEventListener("click", onClick);
    if (button.parentElement === input.container) {
      button.remove();
    }
  };
}

function paypalErrorKind(error: unknown): "declined" | "network" | "sdk" {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "";
  if (code === "INSTRUMENT_DECLINED") {
    return "declined";
  }
  if (code === "NETWORK_ERROR") {
    return "network";
  }
  return "sdk";
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
