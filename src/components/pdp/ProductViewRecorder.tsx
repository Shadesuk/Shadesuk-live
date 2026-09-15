"use client";

import { useEffect } from "react";
import { recordProductView } from "@/lib/recently-viewed";

export function ProductViewRecorder({ productId }: { productId: string }) {
  useEffect(() => {
    recordProductView(productId);
  }, [productId]);
  return null;
}
