"use client";

import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PaymentMethods } from "@/components/payment/PaymentMethods";
import {
  BACK,
  CONTINUE_TO_PAYMENT,
  PAYMENT_HEADING,
  PAYMENT_NEXT_BODY,
  PAYMENT_NOT_READY,
  REVIEW_HEADING,
  SHIPPING_BODY,
  SHIPPING_HEADING,
  SHIPPING_MINIMUM,
  UNITED_KINGDOM,
} from "@/lib/checkout-copy";
import { routes } from "@/lib/navigation";
import type { PublicCheckoutDraft } from "@/types/checkout";
import type { PublicCart } from "@/types/cart";
import { formatGbp } from "@/lib/money";
import styles from "./CheckoutReview.module.css";

type CheckoutReviewProps = {
  cart: PublicCart;
  draft: PublicCheckoutDraft;
  pending?: boolean;
  onBack: () => void;
};

export function CheckoutReview({ cart, draft, pending = false, onBack }: CheckoutReviewProps) {
  const addressLines = [
    `${draft.firstName} ${draft.lastName}`.trim(),
    draft.line1,
    draft.line2,
    [draft.city, draft.county].filter(Boolean).join(", "),
    draft.postcode,
    draft.country === "GB" ? UNITED_KINGDOM : draft.country,
  ].filter(Boolean);

  return (
    <div className={styles.review} data-checkout-review>
      <section className={styles.block} aria-labelledby="checkout-review-heading">
        <h2 id="checkout-review-heading" className="text-h3">
          {REVIEW_HEADING}
        </h2>
        <ul className={styles.items}>
          {cart.items.map((item) => {
            const variant = [item.colourName, item.sizeName].filter(Boolean).join(" · ");
            return (
              <li key={item.id}>
                <p className="text-small">{item.name}</p>
                {variant ? <p className="text-micro">{variant}</p> : null}
                <p className="text-small">Qty {item.quantity}</p>
                <p className="text-small">{formatGbp(item.lineTotal)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.block} aria-labelledby="checkout-review-delivery">
        <h3 id="checkout-review-delivery" className="text-micro">
          {SHIPPING_HEADING}
        </h3>
        <p className="text-small">{SHIPPING_MINIMUM}</p>
        <p className="text-small">{SHIPPING_BODY}</p>
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
        <p className="text-small">{PAYMENT_NEXT_BODY}</p>
        <p id="checkout-payment-not-ready" className="text-small">
          {PAYMENT_NOT_READY}
        </p>
      </section>

      <div className={styles.actions}>
        <Button type="button" disabled held aria-describedby="checkout-payment-not-ready">
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
