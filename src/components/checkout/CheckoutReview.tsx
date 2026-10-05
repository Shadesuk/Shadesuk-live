"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  cancelCheckoutPaymentAction,
  declineCheckoutPaymentAction,
  initiateCheckoutPaymentAction,
  loadPayPalCheckoutConfigAction,
  verifyCheckoutPaymentAction,
} from "@/app/(storefront)/checkout/payment-actions";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { InlineError } from "@/components/ui/InlineError";
import { PaymentMethods } from "@/components/payment/PaymentMethods";
import {
  BACK,
  EDIT,
  ESTIMATED_DELIVERY_LABEL,
  ESTIMATED_DELIVERY_WINDOW,
  PAYMENT_CANCELLED,
  PAYMENT_CONFIRM_ERROR,
  PAYMENT_DECLINED,
  PAYMENT_HEADING,
  PAYMENT_NETWORK,
  PAYMENT_NEXT_BODY,
  PAYMENT_START_ERROR,
  PAYMENT_UNAVAILABLE,
  PAYMENT_VERIFIED_NEXT,
  REVIEW_HEADING,
  SHIPPING_HEADING,
  CHECKOUT_QUOTE_STALE,
  SHIPPING_UNAVAILABLE,
  UK_STANDARD_DELIVERY,
  UNITED_KINGDOM,
} from "@/lib/checkout-copy";
import { formatGbp, formatGbpMinor } from "@/lib/money";
import { mountPayPalCheckout } from "@/lib/paypal/open-buttons";
import { displayLineTotal, type CheckoutQuoteLock } from "@/lib/checkout-quote-lock";
import type { CheckoutQuote } from "@/lib/checkout-quote";
import { orderConfirmationPath, routes } from "@/lib/navigation";
import type { PublicCheckoutDraft } from "@/types/checkout";
import type { PublicCart } from "@/types/cart";
import styles from "./CheckoutReview.module.css";

type CheckoutReviewProps = {
  cart: PublicCart;
  draft: PublicCheckoutDraft;
  quote: CheckoutQuote;
  lineLock?: CheckoutQuoteLock | null;
  chargeReady?: boolean;
  hideQuoteStale?: boolean;
  pending?: boolean;
  onBack: () => void;
};

type PaymentUiState = "idle" | "starting" | "checkout" | "verifying" | "verified" | "cancelled" | "error";

export function CheckoutReview({
  cart,
  draft,
  quote,
  lineLock = null,
  chargeReady = true,
  hideQuoteStale = false,
  pending = false,
  onBack,
}: CheckoutReviewProps) {
  const router = useRouter();
  const paypalSlotRef = useRef<HTMLDivElement>(null);
  const paymentIdRef = useRef<string>("");
  const [paymentUi, setPaymentUi] = useState<PaymentUiState>("idle");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string>("");
  const [paypalReady, setPaypalReady] = useState(false);
  const payable = chargeReady && draft.country === "GB" && quote.shippingStatus === "priced";
  const addressLines = [
    `${draft.firstName} ${draft.lastName}`.trim(),
    draft.line1,
    draft.line2,
    [draft.city, draft.county].filter(Boolean).join(", "),
    draft.postcode,
    draft.country === "GB" ? UNITED_KINGDOM : draft.country,
  ].filter(Boolean);

  useEffect(() => {
    const slot = paypalSlotRef.current;
    if (!slot || pending || !payable) {
      return;
    }
    let cancelled = false;
    let unmount: () => void = () => undefined;
    void (async () => {
      const config = await loadPayPalCheckoutConfigAction();
      if (cancelled) {
        return;
      }
      if (config.status !== "ok") {
        setPaymentError(PAYMENT_UNAVAILABLE);
        setPaymentUi("error");
        return;
      }
      unmount = await mountPayPalCheckout({
        container: slot,
        clientId: config.clientId,
        mode: config.mode,
        createOrder: async () => {
          setPaymentBusy(true);
          setPaymentError("");
          setPaymentUi("starting");
          const started = await initiateCheckoutPaymentAction();
          if (started.status !== "ok") {
            setPaymentError(
              started.status === "unavailable" ? PAYMENT_UNAVAILABLE : PAYMENT_START_ERROR,
            );
            setPaymentUi("error");
            setPaymentBusy(false);
            return null;
          }
          paymentIdRef.current = started.paymentId;
          setPaymentUi("checkout");
          return { orderId: started.providerOrderId };
        },
        onApprove: async (paypalOrderId) => {
          setPaymentBusy(true);
          setPaymentUi("verifying");
          const verified = await verifyCheckoutPaymentAction({
            paymentId: paymentIdRef.current,
            paypalOrderId,
          });
          if (
            (verified.status === "verified" || verified.status === "already_processed") &&
            verified.orderReference
          ) {
            setPaymentUi("verified");
            router.replace(orderConfirmationPath(verified.orderReference), { scroll: true });
            return;
          }
          setPaymentError(PAYMENT_CONFIRM_ERROR);
          setPaymentUi("error");
          setPaymentBusy(false);
        },
        onCancel: () => {
          const paymentId = paymentIdRef.current;
          if (paymentId) {
            void cancelCheckoutPaymentAction({ paymentId });
          }
          paymentIdRef.current = "";
          setPaymentUi("cancelled");
          setPaymentBusy(false);
        },
        onError: (kind) => {
          const paymentId = paymentIdRef.current;
          if (kind === "declined" && paymentId) {
            void declineCheckoutPaymentAction({ paymentId });
            paymentIdRef.current = "";
            setPaymentError(PAYMENT_DECLINED);
          } else if (kind === "network") {
            setPaymentError(PAYMENT_NETWORK);
          } else {
            setPaymentError(PAYMENT_START_ERROR);
          }
          setPaymentUi("error");
          setPaymentBusy(false);
        },
      });
      if (cancelled) {
        unmount();
        return;
      }
      setPaypalReady(true);
    })();
    return () => {
      cancelled = true;
      unmount();
    };
  }, [payable, pending, router]);

  return (
    <div className={styles.review} data-checkout-review>
      <section className={styles.block} aria-labelledby="checkout-review-heading">
        <h2 id="checkout-review-heading" className="text-h3">
          {REVIEW_HEADING}
        </h2>
        <ul className={styles.items}>
          {cart.items.map((item) => {
            const variant = [item.colourName, item.sizeName].filter(Boolean).join(" · ");
            const hasImage = Boolean(item.image?.src);
            return (
              <li key={item.id} className={hasImage ? styles.item : styles.itemPlain}>
                {hasImage && item.image?.src ? (
                  <div className={styles.media}>
                    <Image
                      src={item.image.src}
                      alt={item.image.alt}
                      width={item.image.width}
                      height={item.image.height}
                      className={styles.image}
                    />
                  </div>
                ) : null}
                <div className={styles.details}>
                  <div className={styles.headingRow}>
                    <p className="text-small">{item.name}</p>
                    <ButtonLink
                      href={routes.cart}
                      variant="tertiary"
                      className={styles.edit}
                    >
                      {EDIT}
                      <span className="visually-hidden">{` ${item.name} in your bag`}</span>
                    </ButtonLink>
                  </div>
                  {variant ? <p className="text-micro">{variant}</p> : null}
                  <p className="text-small">Qty {item.quantity}</p>
                  <p className="text-small">{formatGbp(displayLineTotal(lineLock, item))}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.block} aria-labelledby="checkout-review-delivery">
        <div className={styles.headingRow}>
          <h3 id="checkout-review-delivery" className="text-micro">
            {SHIPPING_HEADING}
          </h3>
          <Button
            type="button"
            variant="tertiary"
            className={styles.edit}
            onClick={onBack}
            disabled={pending}
            aria-label="Edit delivery address"
          >
            {EDIT}
          </Button>
        </div>
        <p className="text-small">{quote.shippingStatus === "priced" ? (quote.shippingLabel ?? UK_STANDARD_DELIVERY) : "Shipping"}</p>
        <p className="text-small">
          {quote.shippingStatus === "priced" ? formatGbpMinor(quote.shippingMinor) : SHIPPING_UNAVAILABLE}
        </p>
        <p className="text-micro">{ESTIMATED_DELIVERY_LABEL}</p>
        <p className="text-small">{quote.estimatedDelivery ?? ESTIMATED_DELIVERY_WINDOW}</p>
        <p className="text-small">{draft.email}</p>
        {addressLines.map((line) => (
          <p key={line} className="text-small">
            {line}
          </p>
        ))}
      </section>

      <section className={styles.payment} aria-labelledby="checkout-review-payment">
        <h3 id="checkout-review-payment" className="text-micro">
          {PAYMENT_HEADING}
        </h3>
        <PaymentMethods />
        {payable || hideQuoteStale ? null : (
          <p className="text-small" role="status">
            {quote.shippingStatus === "priced" ? CHECKOUT_QUOTE_STALE : SHIPPING_UNAVAILABLE}
          </p>
        )}
        {payable ? (
          <>
            <div
              ref={paypalSlotRef}
              className={styles.paypalSlot}
              data-paypal-button
              data-paypal-ready={paypalReady ? "true" : "false"}
              aria-busy={paymentBusy}
            />
            <p id="checkout-payment-next" className="text-small">
              {paymentUi === "verified" ? PAYMENT_VERIFIED_NEXT : PAYMENT_NEXT_BODY}
            </p>
            {paymentUi === "cancelled" ? (
              <p className="text-small" role="status">
                {PAYMENT_CANCELLED}
              </p>
            ) : null}
            {paymentUi === "error" && paymentError ? <InlineError>{paymentError}</InlineError> : null}
          </>
        ) : null}
      </section>

      <div className={styles.actions}>
        <Button type="button" variant="tertiary" onClick={onBack} disabled={pending || paymentBusy}>
          {BACK}
        </Button>
        <ButtonLink href={routes.cart} variant="tertiary">
          Return to bag
        </ButtonLink>
      </div>
    </div>
  );
}
