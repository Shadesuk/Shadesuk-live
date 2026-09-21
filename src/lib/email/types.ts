import "server-only";

import type { GuestDeliveryAddressView } from "@/contracts/order/dto";
import type { StoreCurrency } from "@/contracts/money";

/**
 * Application-level transactional types for later `email_events` work.
 * Persistence is not implemented in this block.
 */
export const TRANSACTIONAL_EMAIL_TYPES = {
  orderConfirmation: "order_confirmation",
  shipmentConfirmation: "shipment_confirmation",
} as const;

export type TransactionalEmailType =
  (typeof TRANSACTIONAL_EMAIL_TYPES)[keyof typeof TRANSACTIONAL_EMAIL_TYPES];

export type EmailSendResult =
  | { success: true; messageId: string }
  | { success: false; error: string };

/**
 * Optional caller-supplied key for later deterministic idempotency, e.g.
 * `order_confirmation:{order_id}` or `shipment_confirmation:{shipment_id}`.
 * This service never generates a random application-level identifier.
 */
export type EmailSendOptions = {
  idempotencyKey?: string;
};

export type OrderConfirmationItem = {
  productName: string;
  colourName: string;
  variantName: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
};

/**
 * Payload for the approved Order Confirmation template.
 * Fields follow existing order / order_item / delivery-address contracts.
 */
export type OrderConfirmationPayload = {
  recipientEmail: string;
  customerFirstName: string;
  customerLastName: string;
  orderReference: string;
  placedAt: string;
  currency: StoreCurrency;
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  items: OrderConfirmationItem[];
  deliveryAddress: GuestDeliveryAddressView | null;
};

/**
 * Payload for the approved Shipment Confirmation template.
 * Tracking fields match `shipments` (nullable until an operator records them).
 */
export type ShipmentConfirmationPayload = {
  recipientEmail: string;
  customerFirstName: string;
  customerLastName: string;
  orderReference: string;
  carrierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
};
