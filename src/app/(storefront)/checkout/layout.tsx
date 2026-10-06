"use client";

import { useLayoutEffect, type ReactNode } from "react";

/**
 * Checkout chrome hides the header and footer country controls for every
 * checkout URL, including an empty bag, the loading state, and errors.
 */
export default function CheckoutRouteLayout({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.body.setAttribute("data-checkout", "");
    return () => {
      document.body.removeAttribute("data-checkout");
    };
  }, []);
  return children;
}
