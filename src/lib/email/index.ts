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
