"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  initiateCheckoutPaymentAction,
  verifyCheckoutPaymentAction,
} from "@/app/(storefront)/checkout/payment-actions";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { InlineError } from "@/components/ui/InlineError";
import { PaymentMethods } from "@/components/payment/PaymentMethods";
import {
  BACK,
  CONTINUE_TO_PAYMENT,
  EDIT,
  ESTIMATED_DELIVERY_LABEL,
  ESTIMATED_DELIVERY_WINDOW,
  PAYMENT_CANCELLED,
  PAYMENT_CONFIRM_ERROR,
  PAYMENT_HEADING,
  PAYMENT_NEXT_BODY,
  PAYMENT_START_ERROR,
  PAYMENT_UNAVAILABLE,
  PAYMENT_VERIFIED_NEXT,
  REVIEW_HEADING,
  SHIPPING_HEADING,
  UK_STANDARD_DELIVERY,
  UNITED_KINGDOM,
} from "@/lib/checkout-copy";
import { formatGbp, formatGbpMinor } from "@/lib/money";
import { openRazorpayCheckout } from "@/lib/razorpay/open-checkout";
import type { CheckoutQuote } from "@/lib/checkout-quote";
import { orderConfirmationPath, routes } from "@/lib/navigation";
import type { PublicCheckoutDraft } from "@/types/checkout";
import type { PublicCart } from "@/types/cart";
import styles from "./CheckoutReview.module.css";

type CheckoutReviewProps = {
  cart: PublicCart;
  draft: PublicCheckoutDraft;
  quote: CheckoutQuote;
  pending?: boolean;
  onBack: () => void;
};

type PaymentUiState = "idle" | "starting" | "checkout" | "verifying" | "verified" | "cancelled" | "error";

export function CheckoutReview({
  cart,
  draft,
  quote,
  pending = false,
  onBack,
}: CheckoutReviewProps) {
  const router = useRouter();
  const [paymentUi, setPaymentUi] = useState<PaymentUiState>("idle");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string>("");
  const addressLines = [
    `${draft.firstName} ${draft.lastName}`.trim(),
    draft.line1,
    draft.line2,
    [draft.city, draft.county].filter(Boolean).join(", "),
    draft.postcode,
    draft.country === "GB" ? UNITED_KINGDOM : draft.country,
  ].filter(Boolean);

  async function continueToPayment() {
    if (paymentBusy || pending || paymentUi === "verified") {
      return;
    }
    setPaymentBusy(true);
    setPaymentError("");
    setPaymentUi("starting");
    try {
      const started = await initiateCheckoutPaymentAction();
      if (started.status !== "ok") {
        setPaymentError(started.status === "unavailable" ? PAYMENT_UNAVAILABLE : PAYMENT_START_ERROR);
        setPaymentUi("error");
        return;
      }
      setPaymentUi("checkout");
      const opened = await openRazorpayCheckout({
        publicKeyId: started.publicKeyId,
        providerOrderId: started.providerOrderId,
        customerName: `${draft.firstName} ${draft.lastName}`.trim(),
        customerEmail: draft.email,
      });
      if (opened.status === "dismissed") {
        setPaymentUi("cancelled");
        return;
      }
      if (opened.status !== "callback") {
        setPaymentError(PAYMENT_START_ERROR);
        setPaymentUi("error");
        return;
      }
      setPaymentUi("verifying");
      const verified = await verifyCheckoutPaymentAction({
        paymentId: started.paymentId,
        razorpayPaymentId: opened.response.razorpay_payment_id,
        razorpayOrderId: opened.response.razorpay_order_id,
        razorpaySignature: opened.response.razorpay_signature,
      });
      if (
        (verified.status === "verified" || verified.status === "already_processed") &&
        verified.orderReference
      ) {
        setPaymentUi("verified");
        router.replace(orderConfirmationPath(verified.orderReference));
        return;
      }
      setPaymentError(PAYMENT_CONFIRM_ERROR);
      setPaymentUi("error");
    } catch {
      setPaymentError(PAYMENT_CONFIRM_ERROR);
      setPaymentUi("error");
    } finally {
      setPaymentBusy(false);
    }
  }

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
                  <p className="text-small">{formatGbp(item.lineTotal)}</p>
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
        <p className="text-small">{UK_STANDARD_DELIVERY}</p>
        <p className="text-small">{formatGbpMinor(quote.shippingMinor)}</p>
        <p className="text-micro">{ESTIMATED_DELIVERY_LABEL}</p>
        <p className="text-small">{ESTIMATED_DELIVERY_WINDOW}</p>
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
        <p id="checkout-payment-next" className="text-small">
          {paymentUi === "verified" ? PAYMENT_VERIFIED_NEXT : PAYMENT_NEXT_BODY}
        </p>
        {paymentUi === "cancelled" ? (
          <p className="text-small" role="status">
            {PAYMENT_CANCELLED}
          </p>
        ) : null}
        {paymentUi === "error" && paymentError ? <InlineError>{paymentError}</InlineError> : null}
      </section>

      <div className={styles.actions}>
        <Button
          type="button"
          onClick={() => void continueToPayment()}
          disabled={pending || paymentBusy || paymentUi === "verified"}
          loading={paymentBusy}
          aria-describedby="checkout-payment-next"
        >
          {CONTINUE_TO_PAYMENT}
        </Button>
        <Button type="button" variant="tertiary" onClick={onBack} disabled={pending}>
          {BACK}
        </Button>
        <ButtonLink href={routes.cart} variant="tertiary">
          Return to bag
        </ButtonLink>
      </div>
    </div>
  );
}
