"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { recordProductView } from "@/lib/recently-viewed";

export function ProductViewRecorder({
  productId,
  productName,
  price,
  currency,
}: {
  productId: string;
  productName?: string;
  price?: number;
  currency?: string;
}) {
  useEffect(() => {
    recordProductView(productId);
    track("view_item", {
      item_id: productId,
      item_name: productName,
      price,
      currency,
    });
  }, [productId, productName, price, currency]);
  return null;
}
