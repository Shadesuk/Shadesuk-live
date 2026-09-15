"use client";

import Link from "next/link";
import { ProductThumb } from "@/components/product/ProductThumb";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type { PublicCart } from "@/types/cart";
import { formatGbp } from "@/lib/money";
import {
  ORDER_SUMMARY_HEADING,
  RETURN_TO_BAG,
  SHIPPING_CALCULATED_LATER,
  SHIPPING_LABEL,
  SUBTOTAL_LABEL,
  TOTAL_LABEL,
} from "@/lib/checkout-copy";
import { routes } from "@/lib/navigation";
import styles from "./CheckoutSummary.module.css";

type CheckoutSummaryProps = {
  cart: PublicCart;
  collapsible?: boolean;
  showLines?: boolean;
};

export function CheckoutSummary({
  cart,
  collapsible = false,
  showLines = true,
}: CheckoutSummaryProps) {
  const content = (
    <>
      {showLines ? (
        <ul className={styles.lines}>
          {cart.items.map((item) => {
            const variant = [item.colourName, item.sizeName].filter(Boolean).join(" · ");
            return (
              <li key={item.id} className={styles.line}>
                <Link className={styles.mediaLink} href={item.href} aria-label={`View ${item.name}`}>
                  <ProductThumb image={item.image} compact sizes="88px" />
                </Link>
                <div className={styles.meta}>
                  <p className="text-small">
                    <Link className={styles.name} href={item.href}>
                      {item.name}
                    </Link>
                  </p>
                  {variant ? <p className="text-micro">{variant}</p> : null}
                  <p className="text-micro">Qty {item.quantity}</p>
                </div>
                <p className={`text-small ${styles.price}`}>{formatGbp(item.lineTotal)}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className={styles.totals}>
        <div className={styles.row}>
          <p className="text-small">{SUBTOTAL_LABEL}</p>
          <p className="text-small">{formatGbp(cart.subtotal)}</p>
        </div>
        <div className={styles.row}>
          <p className="text-small">{SHIPPING_LABEL}</p>
          <p className="text-small">{SHIPPING_CALCULATED_LATER}</p>
        </div>
        <div className={styles.total}>
          <p className="text-micro">{TOTAL_LABEL}</p>
          <p className="text-small">{formatGbp(cart.subtotal)}</p>
        </div>
      </div>
      <ButtonLink href={routes.cart} variant="tertiary">
        {RETURN_TO_BAG}
      </ButtonLink>
    </>
  );

  if (collapsible) {
    return (
      <details className={styles.details}>
        <summary className={`text-micro ${styles.summary}`}>
          {ORDER_SUMMARY_HEADING}
          <span className="text-small">{formatGbp(cart.subtotal)}</span>
        </summary>
        {content}
      </details>
    );
  }

  return (
    <aside className={styles.aside} aria-labelledby="checkout-summary-heading">
      <h2 id="checkout-summary-heading" className="text-micro">
        {ORDER_SUMMARY_HEADING}
      </h2>
      {content}
    </aside>
  );
}
