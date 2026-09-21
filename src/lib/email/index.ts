import "server-only";

export { sendOrderConfirmation, sendShipmentConfirmation } from "./service";
export { TRANSACTIONAL_EMAIL_TYPES } from "./types";
export type {
  EmailSendOptions,
  EmailSendResult,
  OrderConfirmationItem,
  OrderConfirmationPayload,
  ShipmentConfirmationPayload,
  TransactionalEmailType,
} from "./types";
export {
  createOrGetEmailEvent,
  createOrGetOrderConfirmationEvent,
  createOrGetShipmentConfirmationEvent,
  markEmailFailed,
  markEmailSent,
  ownsSendAttempt,
} from "./events";
export {
  orderConfirmationIdempotencyKey,
  shipmentConfirmationIdempotencyKey,
} from "./idempotency";
export { EMAIL_PROVIDER_RESEND, EMAIL_STATUSES } from "./schema";
export type {
  CreateEmailEventInput,
  EmailEventClaimResult,
  EmailEventMutationResult,
  EmailEventRow,
  EmailStatus,
} from "./schema";
