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
import { IndiaCardPaymentNotice } from "@/components/checkout/IndiaCardPaymentNotice";
import {
  CHECKOUT_QUOTE_STALE,
  CHECKOUT_TOTAL_UPDATED,
  CONTINUE_TO_PAYMENT,
  INDIA_CARD_PAYMENT_UNAVAILABLE,
  PAYMENT_CANCELLED,
  PAYMENT_CONFIRM_ERROR,
  PAYMENT_NEXT_BODY,
  PAYMENT_START_ERROR,
  UPDATE_TOTAL,
} from "@/lib/checkout-copy";
import { orderConfirmationPath } from "@/lib/navigation";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

type IndiaPaymentProps = {
  amountMinor: number;
  disabled?: boolean;
  onUpdateTotal?: () => void;
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
export function IndiaPayment({ amountMinor, disabled = false, onUpdateTotal }: IndiaPaymentProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [offerUpdate, setOfferUpdate] = useState(false);
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
    setOfferUpdate(false);
    setStatus("");
    const started = await initiateIndiaCheckoutAction();
    if (started.status !== "ok") {
      const quoteMoved = started.status === "expired" || started.status === "stale";
      setOfferUpdate(quoteMoved);
      setStatus(statusForStart(started.status));
      setFailed(started.status === "error");
      setBusy(false);
      return;
    }
    if (started.amountMinor !== amountMinor || started.currency !== "INR") {
      setOfferUpdate(true);
      setStatus(CHECKOUT_TOTAL_UPDATED);
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
    return <IndiaCardPaymentNotice returnToBag />;
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
      {offerUpdate && onUpdateTotal ? (
        <Button type="button" variant="primary" onClick={onUpdateTotal} disabled={disabled || busy}>
          {UPDATE_TOTAL}
        </Button>
      ) : null}
    </div>
  );
}

function statusForStart(status: string): string {
  if (status === "expired" || status === "stale") {
    return CHECKOUT_TOTAL_UPDATED;
  }
  if (status === "unavailable") {
    return INDIA_CARD_PAYMENT_UNAVAILABLE;
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
