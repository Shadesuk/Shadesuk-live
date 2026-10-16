"use client";

import { useEffect } from "react";
import { trackPurchaseOnce } from "@/lib/analytics";
import { subscribeCookieConsent } from "@/lib/cookie-consent";
import { encodeMetaContents, subscribeMetaPixelReady } from "@/lib/meta-pixel";

type ConfirmationItem = {
  productId?: string;
  quantity: number;
  lineTotal?: number;
};

type OrderConfirmationPurchaseProps = {
  orderReference: string;
  total: number;
  items?: ConfirmationItem[];
};

/**
 * Purchase analytics fire only on the captured confirmation page.
 * The sent marker is written only after the Pixel queues the event, so a
 * temporary init failure can retry. Reloads after a successful send are skipped.
 */
export function OrderConfirmationPurchase({
  orderReference,
  total,
  items = [],
}: OrderConfirmationPurchaseProps) {
  useEffect(() => {
    function attempt() {
      try {
        const contentIds = items
          .map((item) => item.productId?.trim())
          .filter((id): id is string => Boolean(id));
        const contents = items
          .filter((item) => item.productId?.trim())
          .map((item) => ({
            id: item.productId?.trim() ?? "",
            quantity: item.quantity > 0 ? item.quantity : 1,
            item_price:
              typeof item.lineTotal === "number" && item.quantity > 0
                ? item.lineTotal / item.quantity
                : undefined,
          }));
        trackPurchaseOnce(orderReference, {
          currency: "GBP",
          value: total,
          content_ids: contentIds.join(","),
          contents: encodeMetaContents(contents),
          num_items: items.reduce((sum, item) => sum + (item.quantity > 0 ? item.quantity : 0), 0),
        });
      } catch {
        // Tracking must never break confirmation.
      }
    }

    attempt();
    const unsubscribeConsent = subscribeCookieConsent(attempt);
    const unsubscribeReady = subscribeMetaPixelReady(attempt);
    return () => {
      unsubscribeConsent();
      unsubscribeReady();
    };
  }, [items, orderReference, total]);

  return null;
}
