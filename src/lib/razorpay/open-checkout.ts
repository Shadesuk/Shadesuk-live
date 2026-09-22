export const RAZORPAY_CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export type UntrustedRazorpayCheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type OpenRazorpayCheckoutInput = {
  publicKeyId: string;
  providerOrderId: string;
  customerName?: string;
  customerEmail?: string;
};

export type OpenRazorpayCheckoutResult =
  | { status: "callback"; response: UntrustedRazorpayCheckoutResponse }
  | { status: "dismissed" }
  | { status: "unavailable" };

type RazorpayCheckoutInstance = {
  open: () => void;
  on?: (event: string, handler: () => void) => void;
};

type RazorpayCheckoutCtor = new (options: Record<string, unknown>) => RazorpayCheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCheckoutCtor;
  }
}

export async function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.Razorpay) {
    return true;
  }
  const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SCRIPT_SRC}"]`);
  if (existing) {
    return waitForRazorpayCtor();
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("checkout_script"));
    document.head.appendChild(script);
  }).catch(() => undefined);
  return waitForRazorpayCtor();
}

export async function openRazorpayCheckout(
  input: OpenRazorpayCheckoutInput,
): Promise<OpenRazorpayCheckoutResult> {
  const loaded = await loadRazorpayCheckoutScript();
  const Ctor = window.Razorpay;
  if (!loaded || !Ctor) {
    return { status: "unavailable" };
  }
  const publicKeyId = input.publicKeyId.trim();
  const providerOrderId = input.providerOrderId.trim();
  if (!publicKeyId || !providerOrderId) {
    return { status: "unavailable" };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: OpenRazorpayCheckoutResult) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    const checkout = new Ctor({
      key: publicKeyId,
      order_id: providerOrderId,
      name: "SHADESUK",
      prefill: {
        name: input.customerName?.trim() || undefined,
        email: input.customerEmail?.trim() || undefined,
      },
      theme: { color: "#0b1c2d" },
      handler(response: UntrustedRazorpayCheckoutResponse) {
        finish({
          status: "callback",
          response: {
            razorpay_payment_id: String(response.razorpay_payment_id ?? ""),
            razorpay_order_id: String(response.razorpay_order_id ?? ""),
            razorpay_signature: String(response.razorpay_signature ?? ""),
          },
        });
      },
      modal: {
        ondismiss() {
          finish({ status: "dismissed" });
        },
      },
    });
    checkout.open();
  });
}

function waitForRazorpayCtor(): Promise<boolean> {
  if (window.Razorpay) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.Razorpay) {
        window.clearInterval(timer);
        resolve(true);
      } else if (Date.now() - started > 4000) {
        window.clearInterval(timer);
        resolve(false);
      }
    }, 50);
  });
}
