"use client";

import Image from "next/image";
import Link from "next/link";
import type { PublicCart } from "@/types/cart";
import type { CheckoutQuote } from "@/lib/checkout-quote";
import { formatGbp, formatGbpMinor } from "@/lib/money";
import {
  ORDER_SUMMARY_HEADING,
  SUBTOTAL_LABEL,
  TOTAL_LABEL,
  SHIPPING_UNAVAILABLE,
  UK_STANDARD_DELIVERY,
} from "@/lib/checkout-copy";
import styles from "./CheckoutSummary.module.css";

type CheckoutSummaryProps = {
  cart: PublicCart;
  quote: CheckoutQuote;
  collapsible?: boolean;
};

export function CheckoutSummary({ cart, quote, collapsible = false }: CheckoutSummaryProps) {
  const content = (
    <>
      <ul className={styles.lines}>
        {cart.items.map((item) => {
          const variant = [item.colourName, item.sizeName].filter(Boolean).join(" · ");
          return (
            <li key={item.id} className={styles.line}>
              <div className={styles.media}>
                {item.image?.src ? (
                  <Image
                    src={item.image.src}
                    alt={item.image.alt}
                    width={item.image.width}
                    height={item.image.height}
                    className={styles.image}
                  />
                ) : (
                  <span className={`${styles.fallback} text-micro`}>Product image</span>
                )}
              </div>
              <div className={styles.meta}>
                <p className="text-small">
                  <Link className={styles.name} href={item.href}>
                    {item.name}
                  </Link>
                </p>
                {variant ? <p className="text-micro">{variant}</p> : null}
                <p className="text-small">Qty {item.quantity}</p>
              </div>
              <p className={`text-small ${styles.price}`}>{formatGbp(item.lineTotal)}</p>
            </li>
          );
        })}
      </ul>
      <div className={styles.totals}>
        <div className={styles.row}>
          <p className="text-small">{SUBTOTAL_LABEL}</p>
          <p className="text-small">{formatGbpMinor(quote.subtotalMinor)}</p>
        </div>
        <div className={styles.row}>
          <p className="text-small">{quote.shippingStatus === "priced" ? (quote.shippingLabel ?? UK_STANDARD_DELIVERY) : "Shipping"}</p>
          <p className="text-small">
            {quote.shippingStatus === "priced" ? formatGbpMinor(quote.shippingMinor) : SHIPPING_UNAVAILABLE}
          </p>
        </div>
        <div className={styles.total}>
          <p className={`text-micro ${styles.totalLabel}`}>{TOTAL_LABEL}</p>
          <p className={`text-h3 ${styles.totalValue}`}>{formatGbpMinor(quote.totalMinor)}</p>
        </div>
      </div>
    </>
  );

  if (collapsible) {
    return (
      <details className={styles.details}>
        <summary className={`text-micro ${styles.summary}`}>
          {ORDER_SUMMARY_HEADING}
          <span className={`text-micro ${styles.summaryTotal}`}>
            {TOTAL_LABEL} {formatGbpMinor(quote.totalMinor)}
          </span>
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
