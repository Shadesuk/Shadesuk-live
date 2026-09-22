import "server-only";

export { sendOrderConfirmation, sendShipmentConfirmation } from "./service";
export {
  dispatchOrderConfirmationEmail,
  loadOrderForConfirmation,
  ORDER_CONFIRMATION_PAYMENT_STATUS,
} from "./order-confirmation";
export type {
  ConfirmedOrderSnapshot,
  OrderConfirmationDispatchResult,
  OrderConfirmationDispatcherOptions,
} from "./order-confirmation";
export {
  dispatchShipmentConfirmationEmail,
  loadShipmentForConfirmation,
} from "./shipment-confirmation";
export type {
  ConfirmedShipmentSnapshot,
  ShipmentConfirmationDispatchResult,
  ShipmentConfirmationDispatcherOptions,
} from "./shipment-confirmation";
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
export { EMAIL_PROVIDER_RESEND, EMAIL_DELIVERY_STATUSES, EMAIL_STATUSES } from "./schema";
export type {
  CreateEmailEventInput,
  EmailDeliveryStatus,
  EmailEventClaimResult,
  EmailEventMutationResult,
  EmailEventRow,
  EmailStatus,
} from "./schema";
export { decideDeliveryTransition, deliveryStatusForResendType } from "./delivery";
export { processVerifiedResendWebhook } from "./webhook";
