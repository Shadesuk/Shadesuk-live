export const CANCEL_ORDER_ACTION = "Cancel order";
export const CANCEL_ORDER_REASON_LABEL = "Reason (optional)";
export const CANCEL_ORDER_HINT =
  "You can request cancellation within 12 hours of placing the order, and only before it is dispatched. This does not remove your statutory UK consumer rights.";
export const CANCEL_ORDER_PENDING = "Cancelling order";
export const CANCEL_ORDER_DONE =
  "This order is cancelled. If a payment was taken, the refund is processed separately.";
export const REFUND_PENDING_CUSTOMER_NOTICE =
  "If a payment was taken, the refund is processed separately.";
export const CANCEL_ORDER_ALREADY = "This order is already cancelled.";
export const CANCEL_ORDER_WINDOW =
  "This order can no longer be cancelled online. Your statutory UK consumer rights are unchanged. Use Contact if you need help.";
export const CANCEL_ORDER_SHIPPED =
  "This order has been dispatched, so it can’t be cancelled here. Your statutory UK consumer rights are unchanged.";
export const CANCEL_ORDER_UNAVAILABLE = "We couldn’t cancel this order. Try again.";

export function cancellationResultMessage(status: string, reason?: string): string {
  if (status === "cancelled") {
    return CANCEL_ORDER_DONE;
  }
  if (status === "already_cancelled") {
    return CANCEL_ORDER_ALREADY;
  }
  if (status === "ineligible" && reason === "already_shipped") {
    return CANCEL_ORDER_SHIPPED;
  }
  if (status === "ineligible" && reason === "window_closed") {
    return CANCEL_ORDER_WINDOW;
  }
  if (status === "ineligible") {
    return CANCEL_ORDER_WINDOW;
  }
  return CANCEL_ORDER_UNAVAILABLE;
}
