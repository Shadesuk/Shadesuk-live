"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  initiateIndiaCheckoutAction,
  loadIndiaCheckoutConfigAction,
  verifyIndiaCheckoutAction,
} from "@/app/(storefront)/checkout/payment-actions";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";
import {
  CHECKOUT_LOCK_EXPIRED,
  CHECKOUT_PRICE_CONFIRM,
  CHECKOUT_QUOTE_STALE,
  CONTINUE_TO_PAYMENT,
  PAYMENT_CANCELLED,
  PAYMENT_CONFIRM_ERROR,
  PAYMENT_NEXT_BODY,
  PAYMENT_START_ERROR,
} from "@/lib/checkout-copy";
import { orderConfirmationPath } from "@/lib/navigation";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

type IndiaPaymentProps = {
  amountMinor: number;
  disabled?: boolean;
};

type CheckoutResponse = {
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
};

type CheckoutInstance = {
  open: () => void;
};

type CheckoutConstructor = new (options: Record<string, unknown>) => CheckoutInstance;

declare global {
  interface Window {
    Razorpay?: CheckoutConstructor;
  }
}

/**
 * India review payment. The server creates the order. This file only opens
 * checkout.js and sends the signature home. A dismiss does not capture.
 */
export function IndiaPayment({ amountMinor, disabled = false }: IndiaPaymentProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [configured, setConfigured] = useState<"loading" | "ok" | "unavailable">("loading");

  useEffect(() => {
    let cancelled = false;
    void loadIndiaCheckoutConfigAction().then((config) => {
      if (!cancelled) {
        setConfigured(config.status === "ok" ? "ok" : "unavailable");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function pay() {
    if (busy || disabled) {
      return;
    }
    setBusy(true);
    setFailed(false);
    setStatus("");
    const started = await initiateIndiaCheckoutAction();
    if (started.status !== "ok") {
      setStatus(statusForStart(started.status));
      setFailed(started.status === "error");
      setBusy(false);
      return;
    }
    if (started.amountMinor !== amountMinor || started.currency !== "INR") {
      setStatus(CHECKOUT_QUOTE_STALE);
      setBusy(false);
      return;
    }
    try {
      await loadCheckoutScript();
    } catch {
      setStatus(CHECKOUT_QUOTE_STALE);
      setBusy(false);
      return;
    }
    const Checkout = window.Razorpay;
    if (!Checkout) {
      setStatus(CHECKOUT_QUOTE_STALE);
      setBusy(false);
      return;
    }
    const checkout = new Checkout({
      key: started.keyId,
      order_id: started.providerOrderId,
      amount: started.amountMinor,
      currency: started.currency,
      timeout: started.timeoutSeconds,
      handler: (response: CheckoutResponse) => {
        void confirm(response);
      },
      modal: {
        ondismiss: () => {
          setStatus(PAYMENT_CANCELLED);
          setBusy(false);
        },
      },
    });
    checkout.open();
  }

  async function confirm(response: CheckoutResponse) {
    const providerOrderId = response.razorpay_order_id;
    const providerPaymentId = response.razorpay_payment_id;
    const signature = response.razorpay_signature;
    if (!providerOrderId || !providerPaymentId || !signature) {
      setStatus(PAYMENT_CONFIRM_ERROR);
      setFailed(true);
      setBusy(false);
      return;
    }
    const verified = await verifyIndiaCheckoutAction({
      providerOrderId,
      providerPaymentId,
      signature,
    });
    if (
      (verified.status === "verified" || verified.status === "already_processed") &&
      verified.orderReference
    ) {
      router.replace(orderConfirmationPath(verified.orderReference), { scroll: true });
      return;
    }
    setStatus(PAYMENT_CONFIRM_ERROR);
    setFailed(true);
    setBusy(false);
  }

  if (configured === "loading") {
    return null;
  }
  if (configured === "unavailable") {
    return (
      <p className="text-small" role="status">
        {CHECKOUT_QUOTE_STALE}
      </p>
    );
  }

  return (
    <div>
      <p className="text-small">{PAYMENT_NEXT_BODY}</p>
      <Button type="button" variant="primary" onClick={() => void pay()} disabled={disabled || busy}>
        {CONTINUE_TO_PAYMENT}
      </Button>
      {status ? (
        failed ? (
          <InlineError>{status}</InlineError>
        ) : (
          <p className="text-small" role="status">
            {status}
          </p>
        )
      ) : null}
    </div>
  );
}

function statusForStart(status: string): string {
  if (status === "expired") {
    return CHECKOUT_LOCK_EXPIRED;
  }
  if (status === "stale") {
    return CHECKOUT_PRICE_CONFIRM;
  }
  if (status === "error") {
    return PAYMENT_START_ERROR;
  }
  return CHECKOUT_QUOTE_STALE;
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("checkout script")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("checkout script"));
    document.body.appendChild(script);
  });
}
