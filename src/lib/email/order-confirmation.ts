import "server-only";

import { toGuestDeliveryAddress } from "@/contracts/order/dto";
import type { OrderItemRow, OrderRow } from "@/contracts/order/schema";
import { isUuid } from "@/lib/ids";
import { parseOrderItemRow, parseOrderRow } from "@/lib/order-rows";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createOrGetOrderConfirmationEvent,
  markEmailFailed,
  markEmailSent,
  ownsSendAttempt,
} from "./events";
import { providerFailureMessage } from "./errors";
import { orderConfirmationIdempotencyKey } from "./idempotency";
import { sendOrderConfirmation } from "./service";
import type { EmailEventStore } from "./store";
import type { EmailSendOptions, EmailSendResult, OrderConfirmationPayload } from "./types";
import { recipientAddress } from "./variables";

const ORDER_COLUMNS =
  "id, order_reference, user_id, customer_email, customer_first_name, customer_last_name, status, payment_status, currency, subtotal_minor, shipping_minor, total_minor, delivery_address, created_at, updated_at";

const ORDER_ITEM_COLUMNS =
  "id, order_id, product_id, product_variant_id, sku, product_name, colour_name, variant_name, quantity, unit_price_minor, line_total_minor, product_snapshot, created_at";

/**
 * Verified paid state for this schema. Matches QUALIFYING_REVENUE_PAYMENT_STATUS
 * and PAYMENT_SUCCEEDED. Do not treat checkout review or frontend return as paid.
 */
export const ORDER_CONFIRMATION_PAYMENT_STATUS = "captured" as const;

export type ConfirmedOrderSnapshot = {
  order: OrderRow;
  items: OrderItemRow[];
};

export type OrderConfirmationDispatchResult =
  | { outcome: "sent"; eventId: string; providerMessageId: string }
  | {
      outcome: "skipped";
      reason: "invalid_order_id" | "order_not_found" | "payment_not_captured" | "existing_event";
    }
  | { outcome: "failed"; reason: string; eventId: string | null };

export type OrderConfirmationSend = (
  payload: OrderConfirmationPayload,
  options?: EmailSendOptions,
) => Promise<EmailSendResult>;

export type OrderConfirmationDispatcherOptions = {
  store?: EmailEventStore;
  loadOrder?: (orderId: string) => Promise<ConfirmedOrderSnapshot | null>;
  send?: OrderConfirmationSend;
};

/**
 * Post-commit Order Confirmation trigger.
 *
 * Call only after the commerce transaction that set
 * `orders.payment_status = captured` has committed. Never invoke from checkout
 * review, analytics, frontend success UI, or inside a payment/order transaction.
 */
export async function dispatchOrderConfirmationEmail(
  orderId: string,
  options?: OrderConfirmationDispatcherOptions,
): Promise<OrderConfirmationDispatchResult> {
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
  options?: OrderConfirmationDispatcherOptions,
): Promise<OrderConfirmationDispatchResult> {
  const id = orderId.trim();
  if (!isUuid(id)) {
    return { outcome: "skipped", reason: "invalid_order_id" };
  }

  const loadOrder = options?.loadOrder ?? loadOrderForConfirmation;
  const snapshot = await loadOrder(id);
  if (!snapshot) {
    return { outcome: "skipped", reason: "order_not_found" };
  }
  if (snapshot.order.payment_status !== ORDER_CONFIRMATION_PAYMENT_STATUS) {
    return { outcome: "skipped", reason: "payment_not_captured" };
  }

  const claim = await createOrGetOrderConfirmationEvent(
    { orderId: snapshot.order.id, recipientEmail: snapshot.order.customer_email },
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

  const payload = toOrderConfirmationPayload(snapshot, recipientEmail);
  const send = options?.send ?? sendOrderConfirmation;
  const sent = await send(payload, {
    idempotencyKey: orderConfirmationIdempotencyKey(snapshot.order.id),
  });

  if (!sent.success) {
    await markEmailFailed(claim.event.id, sent.error, options?.store);
    return { outcome: "failed", reason: sent.error, eventId: claim.event.id };
  }

  await markEmailSent(claim.event.id, sent.messageId, options?.store);
  return { outcome: "sent", eventId: claim.event.id, providerMessageId: sent.messageId };
}

export async function loadOrderForConfirmation(orderId: string): Promise<ConfirmedOrderSnapshot | null> {
  if (!isUuid(orderId)) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const orderResult = await admin.from("orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle();
  const order = parseOrderRow(orderResult.data);
  if (!order || order.id !== orderId) {
    return null;
  }

  const itemsResult = await admin
    .from("order_items")
    .select(ORDER_ITEM_COLUMNS)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (itemsResult.error) {
    throw new Error(providerFailureMessage(itemsResult.error));
  }

  const items = (Array.isArray(itemsResult.data) ? itemsResult.data : [])
    .map(parseOrderItemRow)
    .filter((row): row is OrderItemRow => row !== null && row.order_id === orderId);

  return { order, items };
}

function toOrderConfirmationPayload(
  snapshot: ConfirmedOrderSnapshot,
  recipientEmail: string,
): OrderConfirmationPayload {
  const { order, items } = snapshot;
  return {
    recipientEmail,
    customerFirstName: order.customer_first_name,
    customerLastName: order.customer_last_name,
    orderReference: order.order_reference,
    placedAt: order.created_at,
    currency: order.currency,
    subtotalMinor: order.subtotal_minor,
    shippingMinor: order.shipping_minor,
    totalMinor: order.total_minor,
    items: items.map((item) => ({
      productName: item.product_name,
      colourName: item.colour_name,
      variantName: item.variant_name,
      quantity: item.quantity,
      unitPriceMinor: item.unit_price_minor,
      lineTotalMinor: item.line_total_minor,
    })),
    deliveryAddress: toGuestDeliveryAddress(order.delivery_address),
  };
}
