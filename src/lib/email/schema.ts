import "server-only";

export const EMAIL_STATUSES = ["pending", "sent", "failed"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const EMAIL_DELIVERY_STATUSES = [
  "unknown",
  "delivered",
  "bounced",
  "complained",
] as const;
export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

export const EMAIL_PROVIDER_RESEND = "resend";

export type EmailEventRow = {
  id: string;
  order_id: string | null;
  shipment_id: string | null;
  recipient_email: string;
  email_type: string;
  provider: string;
  provider_message_id: string | null;
  idempotency_key: string;
  status: EmailStatus;
  delivery_status: EmailDeliveryStatus;
  delivery_updated_at: string | null;
  error_message: string | null;
  attempts: number;
  sent_at: string | null;
  created_at: string;
};

export type CreateEmailEventInput = {
  idempotencyKey: string;
  emailType: "order_confirmation" | "shipment_confirmation";
  recipientEmail: string;
  orderId: string | null;
  shipmentId: string | null;
};

export type EmailEventClaimResult =
  | { status: "created"; event: EmailEventRow }
  | { status: "existing"; event: EmailEventRow }
  | { status: "error"; error: string };

export type EmailEventMutationResult =
  | { status: "ok"; event: EmailEventRow }
  | { status: "conflict"; event: EmailEventRow | null }
  | { status: "error"; error: string };

export const EMAIL_EVENT_COLUMNS =
  "id, order_id, shipment_id, recipient_email, email_type, provider, provider_message_id, idempotency_key, status, delivery_status, delivery_updated_at, error_message, attempts, sent_at, created_at";

export function isEmailStatus(value: unknown): value is EmailStatus {
  return typeof value === "string" && (EMAIL_STATUSES as readonly string[]).includes(value);
}

export function isEmailDeliveryStatus(value: unknown): value is EmailDeliveryStatus {
  return typeof value === "string" && (EMAIL_DELIVERY_STATUSES as readonly string[]).includes(value);
}

export function parseEmailEventRow(value: unknown): EmailEventRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = asNonEmptyString(row.id);
  const recipientEmail = asNonEmptyString(row.recipient_email);
  const emailType = asNonEmptyString(row.email_type);
  const provider = asNonEmptyString(row.provider);
  const idempotencyKey = asNonEmptyString(row.idempotency_key);
  const createdAt = asNonEmptyString(row.created_at);
  const status = row.status;
  const attempts = asNonNegativeInteger(row.attempts);
  if (
    !id ||
    !recipientEmail ||
    !emailType ||
    !provider ||
    !idempotencyKey ||
    !createdAt ||
    !isEmailStatus(status) ||
    attempts == null
  ) {
    return null;
  }
  const deliveryStatus = isEmailDeliveryStatus(row.delivery_status)
    ? row.delivery_status
    : "unknown";
  return {
    id,
    order_id: asNonEmptyString(row.order_id),
    shipment_id: asNonEmptyString(row.shipment_id),
    recipient_email: recipientEmail,
    email_type: emailType,
    provider,
    provider_message_id: asNonEmptyString(row.provider_message_id),
    idempotency_key: idempotencyKey,
    status,
    delivery_status: deliveryStatus,
    delivery_updated_at: asNonEmptyString(row.delivery_updated_at),
    error_message: asNonEmptyString(row.error_message),
    attempts,
    sent_at: asNonEmptyString(row.sent_at),
    created_at: createdAt,
  };
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNonNegativeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  return null;
}
