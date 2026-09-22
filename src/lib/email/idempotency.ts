import "server-only";

import { isUuid } from "@/lib/ids";
import { TRANSACTIONAL_EMAIL_TYPES } from "./types";

export function orderConfirmationIdempotencyKey(orderId: string): string {
  return `${TRANSACTIONAL_EMAIL_TYPES.orderConfirmation}:${orderId.trim()}`;
}

export function shipmentConfirmationIdempotencyKey(shipmentId: string): string {
  return `${TRANSACTIONAL_EMAIL_TYPES.shipmentConfirmation}:${shipmentId.trim()}`;
}

export function parseOrderConfirmationIdempotencyKey(value: string): string | null {
  const prefix = `${TRANSACTIONAL_EMAIL_TYPES.orderConfirmation}:`;
  if (!value.startsWith(prefix)) {
    return null;
  }
  const orderId = value.slice(prefix.length).trim();
  return isUuid(orderId) ? orderId : null;
}

export function parseShipmentConfirmationIdempotencyKey(value: string): string | null {
  const prefix = `${TRANSACTIONAL_EMAIL_TYPES.shipmentConfirmation}:`;
  if (!value.startsWith(prefix)) {
    return null;
  }
  const shipmentId = value.slice(prefix.length).trim();
  return isUuid(shipmentId) ? shipmentId : null;
}
