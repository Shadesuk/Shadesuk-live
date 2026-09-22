"use client";

import { useEffect } from "react";
import { trackPurchaseOnce } from "@/lib/analytics";

type OrderConfirmationPurchaseProps = {
  orderReference: string;
  total: number;
};

/**
 * Purchase analytics fire only on the captured confirmation page.
 * sessionStorage plus trackPurchaseOnce prevent refresh duplicates.
 */
export function OrderConfirmationPurchase({
  orderReference,
  total,
}: OrderConfirmationPurchaseProps) {
  useEffect(() => {
    const key = `shadesuk.purchase.${orderReference}`;
    try {
      if (sessionStorage.getItem(key)) {
        return;
      }
    } catch {
      // Storage may be unavailable; in-memory dedupe still applies.
    }
    trackPurchaseOnce(orderReference, {
      currency: "GBP",
      value: total,
    });
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // Ignore quota / private-mode failures.
    }
  }, [orderReference, total]);

  return null;
}
