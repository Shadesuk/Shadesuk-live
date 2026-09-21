import "server-only";

import { getResendClient } from "./client";
import { formatResendFromHeader, type ResendTemplateKind } from "./config";
import { providerFailureMessage } from "./errors";
import type {
  EmailSendOptions,
  EmailSendResult,
  OrderConfirmationPayload,
  ShipmentConfirmationPayload,
} from "./types";
import {
  recipientAddress,
  toOrderConfirmationVariables,
  toShipmentConfirmationVariables,
  type TemplateVariables,
} from "./variables";

const IDEMPOTENCY_KEY_MAX = 256;

export async function sendOrderConfirmation(
  payload: OrderConfirmationPayload,
  options?: EmailSendOptions,
): Promise<EmailSendResult> {
  try {
    return await sendTemplateEmail({
      kind: "order_confirmation",
      recipientEmail: payload.recipientEmail,
      variables: toOrderConfirmationVariables(payload),
      options,
    });
  } catch (error) {
    return { success: false, error: providerFailureMessage(error) };
  }
}

export async function sendShipmentConfirmation(
  payload: ShipmentConfirmationPayload,
  options?: EmailSendOptions,
): Promise<EmailSendResult> {
  try {
    return await sendTemplateEmail({
      kind: "shipment_confirmation",
      recipientEmail: payload.recipientEmail,
      variables: toShipmentConfirmationVariables(payload),
      options,
    });
  } catch (error) {
    return { success: false, error: providerFailureMessage(error) };
  }
}

async function sendTemplateEmail(input: {
  kind: ResendTemplateKind;
  recipientEmail: string;
  variables: TemplateVariables;
  options?: EmailSendOptions;
}): Promise<EmailSendResult> {
  const to = recipientAddress(input.recipientEmail);
  if (!to) {
    return { success: false, error: "Recipient email is invalid." };
  }

  const idempotency = parseIdempotencyKey(input.options?.idempotencyKey);
  if (!idempotency.ok) {
    return { success: false, error: idempotency.error };
  }

  const clientResult = getResendClient();
  if (!clientResult.ok) {
    return {
      success: false,
      error: "Resend is not configured.",
    };
  }

  const { client, config } = clientResult;
  const templateId = config.templates[input.kind];

  try {
    const response = await client.emails.send(
      {
        from: formatResendFromHeader(config),
        to,
        template: {
          id: templateId,
          variables: input.variables,
        },
      },
      idempotency.key ? { idempotencyKey: idempotency.key } : undefined,
    );

    if (response.error) {
      return { success: false, error: providerFailureMessage(response.error) };
    }

    const messageId = response.data?.id?.trim();
    if (!messageId) {
      return { success: false, error: "Resend did not return a message id." };
    }

    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: providerFailureMessage(error) };
  }
}

function parseIdempotencyKey(
  value: string | undefined,
): { ok: true; key?: string } | { ok: false; error: string } {
  if (value == null) {
    return { ok: true };
  }
  const key = value.trim();
  if (!key) {
    return { ok: false, error: "Idempotency key is empty." };
  }
  if (key.length > IDEMPOTENCY_KEY_MAX) {
    return { ok: false, error: "Idempotency key is too long." };
  }
  return { ok: true, key };
}
