import "server-only";

import { isShipmentConfirmationStatus, type ShipmentRow } from "@/contracts/fulfilment/shipment";
import type { OrderItemRow, OrderRow } from "@/contracts/order/schema";
import { isUuid } from "@/lib/ids";
import { parseShipmentRow } from "@/lib/order-rows";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createOrGetShipmentConfirmationEvent,
  markEmailFailed,
  markEmailSent,
  ownsSendAttempt,
} from "./events";
import { providerFailureMessage } from "./errors";
import { shipmentConfirmationIdempotencyKey } from "./idempotency";
import { loadOrderForConfirmation, ORDER_CONFIRMATION_PAYMENT_STATUS } from "./order-confirmation";
import { sendShipmentConfirmation } from "./service";
import type { EmailEventStore } from "./store";
import type { EmailSendOptions, EmailSendResult, ShipmentConfirmationPayload } from "./types";
import { recipientAddress, trackOrderCtaUrl } from "./variables";

const SHIPMENT_COLUMNS =
  "id, order_id, carrier_name, tracking_number, tracking_url, status, shipped_at, delivered_at, created_at, updated_at";

export type ConfirmedShipmentSnapshot = {
  order: OrderRow;
  items: OrderItemRow[];
  shipment: ShipmentRow;
};

export type ShipmentConfirmationDispatchResult =
  | { outcome: "sent"; eventId: string; providerMessageId: string }
  | {
      outcome: "skipped";
      reason:
        | "invalid_order_id"
        | "not_found"
        | "payment_not_captured"
        | "not_confirmed"
        | "existing_event";
    }
  | { outcome: "failed"; reason: string; eventId: string | null };

export type ShipmentConfirmationSend = (
  payload: ShipmentConfirmationPayload,
  options?: EmailSendOptions,
) => Promise<EmailSendResult>;

export type ShipmentConfirmationDispatcherOptions = {
  store?: EmailEventStore;
  loadShipment?: (orderId: string) => Promise<ConfirmedShipmentSnapshot | null>;
  send?: ShipmentConfirmationSend;
};

/**
 * Post-commit shipment confirmation trigger.
 *
 * Call only after the shipment write has committed. Email failures are
 * recorded on email_events and must never roll back the shipment or order.
 */
export async function dispatchShipmentConfirmationEmail(
  orderId: string,
  options?: ShipmentConfirmationDispatcherOptions,
): Promise<ShipmentConfirmationDispatchResult> {
  try {
    return await runDispatch(orderId, options);
  } catch (error) {
    return {
      outcome: "failed",
      reason: providerFailureMessage(error),
      eventId: null,
    };
  }
}

async function runDispatch(
  orderId: string,
  options?: ShipmentConfirmationDispatcherOptions,
): Promise<ShipmentConfirmationDispatchResult> {
  const id = orderId.trim();
  if (!isUuid(id)) {
    return { outcome: "skipped", reason: "invalid_order_id" };
  }

  const loadShipment = options?.loadShipment ?? loadShipmentForConfirmation;
  const snapshot = await loadShipment(id);
  if (!snapshot || snapshot.shipment.order_id !== snapshot.order.id) {
    return { outcome: "skipped", reason: "not_found" };
  }
  if (snapshot.order.payment_status !== ORDER_CONFIRMATION_PAYMENT_STATUS) {
    return { outcome: "skipped", reason: "payment_not_captured" };
  }
  if (!isShipmentConfirmationStatus(snapshot.shipment.status)) {
    return { outcome: "skipped", reason: "not_confirmed" };
  }

  const claim = await createOrGetShipmentConfirmationEvent(
    {
      shipmentId: snapshot.shipment.id,
      orderId: snapshot.order.id,
      recipientEmail: snapshot.order.customer_email,
    },
    options?.store,
  );

  if (claim.status === "error") {
    return { outcome: "failed", reason: claim.error, eventId: null };
  }
  if (!ownsSendAttempt(claim)) {
    return { outcome: "skipped", reason: "existing_event" };
  }

  const recipientEmail = recipientAddress(snapshot.order.customer_email);
  if (!recipientEmail) {
    await markEmailFailed(claim.event.id, "Recipient email is invalid.", options?.store);
    return { outcome: "failed", reason: "Recipient email is invalid.", eventId: claim.event.id };
  }

  const payload = toShipmentConfirmationPayload(snapshot, recipientEmail);
  const send = options?.send ?? sendShipmentConfirmation;
  const sent = await send(payload, {
    idempotencyKey: shipmentConfirmationIdempotencyKey(snapshot.shipment.id),
  });

  if (!sent.success) {
    await markEmailFailed(claim.event.id, sent.error, options?.store);
    return { outcome: "failed", reason: sent.error, eventId: claim.event.id };
  }

  await markEmailSent(claim.event.id, sent.messageId, options?.store);
  return { outcome: "sent", eventId: claim.event.id, providerMessageId: sent.messageId };
}

export async function loadShipmentForConfirmation(orderId: string): Promise<ConfirmedShipmentSnapshot | null> {
  const order = await loadOrderForConfirmation(orderId);
  if (!order) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const shipmentResult = await admin
    .from("shipments")
    .select(SHIPMENT_COLUMNS)
    .eq("order_id", orderId)
    .maybeSingle();
  if (shipmentResult.error) {
    throw new Error(providerFailureMessage(shipmentResult.error));
  }

  const shipment = parseShipmentRow(shipmentResult.data);
  if (!shipment || shipment.order_id !== orderId) {
    return null;
  }

  return { order: order.order, items: order.items, shipment };
}

function toShipmentConfirmationPayload(
  snapshot: ConfirmedShipmentSnapshot,
  recipientEmail: string,
): ShipmentConfirmationPayload {
  const { order, items, shipment } = snapshot;
  return {
    recipientEmail,
    customerFirstName: order.customer_first_name,
    customerLastName: order.customer_last_name,
    orderReference: order.order_reference,
    shipmentStatus: shipment.status,
    carrierName: shipment.carrier_name,
    trackingNumber: shipment.tracking_number,
    trackingUrl: shipment.tracking_url,
    shippedAt: shipment.shipped_at,
    trackOrderUrl: trackOrderCtaUrl(),
    items: items.map((item) => ({
      productName: item.product_name,
      colourName: item.colour_name,
      variantName: item.variant_name,
      quantity: item.quantity,
      unitPriceMinor: item.unit_price_minor,
      lineTotalMinor: item.line_total_minor,
    })),
  };
}
