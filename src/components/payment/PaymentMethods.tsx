"use client";

import { useId } from "react";
import { enabledPaymentMethods } from "@/lib/payment-methods";
import { PAYMENTS_ACCEPTED } from "@/lib/checkout-copy";
import styles from "./PaymentMethods.module.css";

type PaymentMethodsProps = {
  heading?: string;
};

export function PaymentMethods({ heading = PAYMENTS_ACCEPTED }: PaymentMethodsProps) {
  const headingId = useId();
  const methods = enabledPaymentMethods();
  if (methods.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrap} data-payment-methods>
      <p id={headingId} className={`text-micro ${styles.heading}`}>
        {heading}
      </p>
      <ul className={styles.list} aria-labelledby={headingId}>
        {methods.map((method) => (
          <li key={method.id} className={styles.item} data-method={method.id}>
            {method.markSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.mark} src={method.markSrc} alt={method.label} />
            ) : (
              <span className="text-micro">{method.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
