import type { CartRevalidationIssue } from "@/contracts";

export const EMPTY_BAG_TITLE = "Your bag is empty";
export const EMPTY_BAG_DESCRIPTION = "Nothing here yet.";
export const EMPTY_BAG_CTA = "Explore shades";

export const CHECKOUT_NEXT_TITLE = "Checkout";
export const CHECKOUT_NEXT_COPY =
  "Guest checkout is next. Payment, delivery details, and order confirmation will follow in a later step.";

export function cartIssueMessage(issue: CartRevalidationIssue): string {
  if (issue === "price_changed") {
    return "The price of this shade has changed.";
  }
  if (issue === "variant_unavailable") {
    return "This shade is no longer available.";
  }
  if (issue === "product_removed") {
    return "A shade in your bag is no longer available.";
  }
  return "Quantity was updated to match available stock.";
}
