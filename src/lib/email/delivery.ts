import "server-only";

export const EMAIL_DELIVERY_RANK: Record<
  "unknown" | "delivered" | "bounced" | "complained",
  number
> = {
  unknown: 0,
  delivered: 1,
  bounced: 2,
  complained: 3,
};

export type DeliveryTransitionDecision = "apply" | "ignore";

/**
 * Delivery state is independent of application send status.
 * Identical events are no-ops. Older provider timestamps cannot overwrite
 * newer ones. Rank prevents delivered from replacing bounced/complained.
 */
export function decideDeliveryTransition(input: {
  currentStatus: keyof typeof EMAIL_DELIVERY_RANK;
  currentAt: string | null;
  incomingStatus: keyof typeof EMAIL_DELIVERY_RANK;
  incomingAt: string;
}): DeliveryTransitionDecision {
  if (input.incomingStatus === "unknown") {
    return "ignore";
  }
  if (input.currentStatus === input.incomingStatus) {
    return "ignore";
  }

  const incomingAt = Date.parse(input.incomingAt);
  if (Number.isNaN(incomingAt)) {
    return "ignore";
  }
  if (input.currentAt) {
    const currentAt = Date.parse(input.currentAt);
    if (!Number.isNaN(currentAt) && incomingAt < currentAt) {
      return "ignore";
    }
  }

  if (EMAIL_DELIVERY_RANK[input.incomingStatus] < EMAIL_DELIVERY_RANK[input.currentStatus]) {
    return "ignore";
  }
  return "apply";
}

export function deliveryStatusForResendType(
  eventType: string,
): "delivered" | "bounced" | "complained" | null {
  if (eventType === "email.delivered") {
    return "delivered";
  }
  if (eventType === "email.bounced") {
    return "bounced";
  }
  if (eventType === "email.complained") {
    return "complained";
  }
  return null;
}
