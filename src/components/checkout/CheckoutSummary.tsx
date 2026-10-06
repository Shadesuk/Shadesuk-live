"use client";

import Image from "next/image";
import Link from "next/link";
import type { PublicCart } from "@/types/cart";
import { displayLineTotal, displayLockedChargeMinor, type CheckoutQuoteLock } from "@/lib/checkout-quote-lock";
import type { CheckoutQuote } from "@/lib/checkout-quote";
import { useMarket } from "@/components/market/MarketProvider";
import { presentCheckoutAmount, presentCheckoutPartsTotal } from "@/lib/market/prices";
import { resolvePaymentRoute } from "@/lib/payment/payment-route";
import { supportedCountry } from "@/contracts/countries";
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
  lineLock?: CheckoutQuoteLock | null;
  frozenCharge?: { subtotalMinor: number; shippingMinor: number; totalMinor: number } | null;
  collapsible?: boolean;
  country?: string;
  onChangeDelivery?: () => void;
};

export function CheckoutSummary({
  cart,
  quote,
  lineLock = null,
  frozenCharge = null,
  collapsible = false,
  country = "GB",
  onChangeDelivery,
}: CheckoutSummaryProps) {
  const { rates } = useMarket();
  const route = resolvePaymentRoute(country);
  const displayCurrency = frozenCharge ? "INR" : (route?.displayCurrency ?? "GBP");
  const chargeCurrency = frozenCharge ? "INR" : (route?.paymentCurrency ?? "GBP");
  const money = (gbpMinor: number, chargeMinor?: number | null) =>
    presentCheckoutAmount({
      gbpMinor,
      chargeMinor,
      displayCurrency,
      chargeCurrency,
      rates,
      cents: displayCurrency === chargeCurrency,
    });
  const lockedCharge =
    !frozenCharge && lineLock && lineLock.chargeCurrency === chargeCurrency ? lineLock : null;
  const subtotalCharge = frozenCharge?.subtotalMinor ?? lockedCharge?.chargeSubtotalMinor;
  const shippingCharge = frozenCharge?.shippingMinor ?? lockedCharge?.chargeShippingMinor;
  const subtotalLabel = money(quote.subtotalMinor, subtotalCharge);
  const shippingLabel =
    quote.shippingStatus === "priced" || frozenCharge
      ? money(quote.shippingMinor, shippingCharge)
      : SHIPPING_UNAVAILABLE;
  const totalParts = [{ gbpMinor: quote.subtotalMinor, chargeMinor: subtotalCharge }];
  if (
    quote.shippingStatus === "priced" ||
    frozenCharge ||
    quote.totalMinor > quote.subtotalMinor
  ) {
    totalParts.push({ gbpMinor: quote.shippingMinor, chargeMinor: shippingCharge });
  }
  const totalLabel = presentCheckoutPartsTotal({
    parts: totalParts,
    displayCurrency,
    chargeCurrency,
    rates,
  });
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
              <p className={`text-small ${styles.price}`}>
                {money(
                  Math.round(displayLineTotal(lineLock, item) * 100),
                  frozenCharge || lockedCharge ? displayLockedChargeMinor(lineLock, item) : null,
                )}
              </p>
            </li>
          );
        })}
      </ul>
      <div className={styles.totals}>
        {onChangeDelivery ? (
          <p className={`text-small ${styles.delivering}`}>
            Delivering to {supportedCountry(country)?.name ?? country}.{" "}
            <button type="button" className={styles.change} onClick={onChangeDelivery}>
              Change
            </button>
          </p>
        ) : null}
        <div className={styles.row}>
          <p className="text-small">{SUBTOTAL_LABEL}</p>
          <p className="text-small">{subtotalLabel}</p>
        </div>
        <div className={styles.row}>
          <p className="text-small">{quote.shippingStatus === "priced" ? (quote.shippingLabel ?? UK_STANDARD_DELIVERY) : "Shipping"}</p>
          <p className="text-small">{shippingLabel}</p>
        </div>
        <div className={styles.total}>
          <p className={`text-micro ${styles.totalLabel}`}>{TOTAL_LABEL}</p>
          <p className={`text-h3 ${styles.totalValue}`}>{totalLabel}</p>
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
            {TOTAL_LABEL} {totalLabel}
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

