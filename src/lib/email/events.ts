import "server-only";

import { isUuid } from "@/lib/ids";
import { providerFailureMessage } from "./errors";
import {
  orderConfirmationIdempotencyKey,
  parseOrderConfirmationIdempotencyKey,
  parseShipmentConfirmationIdempotencyKey,
  shipmentConfirmationIdempotencyKey,
} from "./idempotency";
import { EMAIL_PROVIDER_RESEND, type CreateEmailEventInput, type EmailEventClaimResult, type EmailEventMutationResult, type EmailEventRow } from "./schema";
import type { EmailEventStore } from "./store";
import { createSupabaseEmailEventStore } from "./supabase-store";
import { recipientAddress } from "./variables";

/**
 * Durable email_events layer. Isolated from order/payment/shipment mutations
 * so a failed email cannot roll back a successful commerce operation.
 */
export async function createOrGetEmailEvent(
  input: CreateEmailEventInput,
  store?: EmailEventStore,
): Promise<EmailEventClaimResult> {
  const db = store ?? createSupabaseEmailEventStore();
  const prepared = prepareInsert(input);
  if (!prepared.ok) {
    return { status: "error", error: prepared.error };
  }

  const inserted = await db.insertPending(prepared.row);
  if (inserted.status === "inserted") {
    return { status: "created", event: inserted.event };
  }
  if (inserted.status === "error") {
    return { status: "error", error: inserted.error };
  }

  const existing = await db.findByIdempotencyKey(prepared.row.idempotency_key);
  if (!existing) {
    return { status: "error", error: "Email event already exists but could not be loaded." };
  }
  return { status: "existing", event: existing };
}

export async function markEmailSent(
  eventId: string,
  providerMessageId: string,
  store?: EmailEventStore,
): Promise<EmailEventMutationResult> {
  const db = store ?? createSupabaseEmailEventStore();
  const messageId = providerMessageId.trim();
  if (!isUuid(eventId)) {
    return { status: "error", error: "Email event id is invalid." };
  }
  if (!messageId) {
    return { status: "error", error: "Provider message id is missing." };
  }

  const current = await db.findById(eventId);
  if (!current) {
    return { status: "error", error: "Email event was not found." };
  }
  if (current.status !== "pending") {
    return { status: "conflict", event: current };
  }

  const updated = await db.updateIfPending(eventId, {
    status: "sent",
    provider_message_id: messageId,
    error_message: null,
    sent_at: new Date().toISOString(),
    attempts: current.attempts + 1,
  });
  if (!updated) {
    const latest = await db.findById(eventId);
    return { status: "conflict", event: latest };
  }
  return { status: "ok", event: updated };
}

export async function markEmailFailed(
  eventId: string,
  error: unknown,
  store?: EmailEventStore,
): Promise<EmailEventMutationResult> {
  const db = store ?? createSupabaseEmailEventStore();
  if (!isUuid(eventId)) {
    return { status: "error", error: "Email event id is invalid." };
  }

  const current = await db.findById(eventId);
  if (!current) {
    return { status: "error", error: "Email event was not found." };
  }
  if (current.status !== "pending") {
    return { status: "conflict", event: current };
  }

  const updated = await db.updateIfPending(eventId, {
    status: "failed",
    provider_message_id: current.provider_message_id,
    error_message: providerFailureMessage(error),
    sent_at: null,
    attempts: current.attempts + 1,
  });
  if (!updated) {
    const latest = await db.findById(eventId);
    return { status: "conflict", event: latest };
  }
  return { status: "ok", event: updated };
}

export async function createOrGetOrderConfirmationEvent(
  input: { orderId: string; recipientEmail: string },
  store?: EmailEventStore,
): Promise<EmailEventClaimResult> {
  return createOrGetEmailEvent(
    {
      idempotencyKey: orderConfirmationIdempotencyKey(input.orderId),
      emailType: "order_confirmation",
      recipientEmail: input.recipientEmail,
      orderId: input.orderId,
      shipmentId: null,
    },
    store,
  );
}

export async function createOrGetShipmentConfirmationEvent(
  input: { shipmentId: string; orderId: string | null; recipientEmail: string },
  store?: EmailEventStore,
): Promise<EmailEventClaimResult> {
  return createOrGetEmailEvent(
    {
      idempotencyKey: shipmentConfirmationIdempotencyKey(input.shipmentId),
      emailType: "shipment_confirmation",
      recipientEmail: input.recipientEmail,
      orderId: input.orderId,
      shipmentId: input.shipmentId,
    },
    store,
  );
}

export function ownsSendAttempt(
  result: EmailEventClaimResult,
): result is { status: "created"; event: EmailEventRow } {
  return result.status === "created";
}

function prepareInsert(
  input: CreateEmailEventInput,
): { ok: true; row: Parameters<EmailEventStore["insertPending"]>[0] } | { ok: false; error: string } {
  const recipientEmail = recipientAddress(input.recipientEmail);
  if (!recipientEmail) {
    return { ok: false, error: "Recipient email is invalid." };
  }

  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) {
    return { ok: false, error: "Idempotency key is empty." };
  }
  if (idempotencyKey.length > 256) {
    return { ok: false, error: "Idempotency key is too long." };
  }

  if (input.emailType === "order_confirmation") {
    const orderId = parseOrderConfirmationIdempotencyKey(idempotencyKey);
    if (!orderId || orderId !== input.orderId?.trim()) {
      return { ok: false, error: "Order confirmation key must be order_confirmation:{order_id}." };
    }
    if (input.shipmentId) {
      return { ok: false, error: "Order confirmation events must not include a shipment id." };
    }
    return {
      ok: true,
      row: {
        order_id: orderId,
        shipment_id: null,
        recipient_email: recipientEmail,
        email_type: input.emailType,
        provider: EMAIL_PROVIDER_RESEND,
        idempotency_key: orderConfirmationIdempotencyKey(orderId),
        status: "pending",
        attempts: 0,
      },
    };
  }

  const shipmentId = parseShipmentConfirmationIdempotencyKey(idempotencyKey);
  if (!shipmentId || shipmentId !== input.shipmentId?.trim()) {
    return { ok: false, error: "Shipment confirmation key must be shipment_confirmation:{shipment_id}." };
  }
  const orderId = input.orderId?.trim() || null;
  if (orderId && !isUuid(orderId)) {
    return { ok: false, error: "Order id is invalid." };
  }
  return {
    ok: true,
    row: {
      order_id: orderId,
      shipment_id: shipmentId,
      recipient_email: recipientEmail,
      email_type: input.emailType,
      provider: EMAIL_PROVIDER_RESEND,
      idempotency_key: shipmentConfirmationIdempotencyKey(shipmentId),
      status: "pending",
      attempts: 0,
    },
  };
}
