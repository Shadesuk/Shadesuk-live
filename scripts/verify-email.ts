import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ORDER_CONFIRMATION_VARIABLE_KEYS,
  SHIPMENT_CONFIRMATION_VARIABLE_KEYS,
  recipientAddress,
  toOrderConfirmationVariables,
  toShipmentConfirmationVariables,
  trackOrderCtaUrl,
} from "../src/lib/email/variables";
import { TRANSACTIONAL_EMAIL_TYPES } from "../src/lib/email/types";
import { providerFailureMessage, redactSecrets } from "../src/lib/email/errors";
import { formatResendFromHeader } from "../src/lib/email/config";
import {
  createOrGetEmailEvent,
  markEmailFailed,
  markEmailSent,
  ownsSendAttempt,
} from "../src/lib/email/events";
import {
  orderConfirmationIdempotencyKey,
  shipmentConfirmationIdempotencyKey,
} from "../src/lib/email/idempotency";
import { createMemoryEmailEventStore } from "../src/lib/email/memory-store";
import { decideDeliveryTransition, deliveryStatusForResendType } from "../src/lib/email/delivery";
import { processVerifiedResendWebhook } from "../src/lib/email/webhook";
import { verifyResendWebhook } from "../src/lib/email/webhook-verify";
import {
  dispatchOrderConfirmationEmail,
  ORDER_CONFIRMATION_PAYMENT_STATUS,
} from "../src/lib/email/order-confirmation";
import type { ConfirmedOrderSnapshot } from "../src/lib/email/order-confirmation";
import {
  dispatchShipmentConfirmationEmail,
} from "../src/lib/email/shipment-confirmation";
import type { ConfirmedShipmentSnapshot } from "../src/lib/email/shipment-confirmation";
import type { OrderRow } from "../src/contracts/order/schema";
import type { ShipmentRow } from "../src/contracts/fulfilment/shipment";
import { isShipmentConfirmationStatus } from "../src/contracts/fulfilment/shipment";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

const envExample = read(".env.example");
for (const name of [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_FROM_NAME",
  "RESEND_ORDER_CONFIRMATION_TEMPLATE_ID",
  "RESEND_SHIPMENT_CONFIRMATION_TEMPLATE_ID",
  "RESEND_WEBHOOK_SECRET",
] as const) {
  if (!envExample.includes(`${name}=`)) {
    throw new Error(`.env.example must document ${name}.`);
  }
}
if (envExample.includes("NEXT_PUBLIC_RESEND")) {
  throw new Error("Resend secrets must never use a NEXT_PUBLIC_ prefix.");
}

const emailDir = resolve(root, "src/lib/email");
const emailFiles = [
  "client.ts",
  "config.ts",
  "errors.ts",
  "events.ts",
  "idempotency.ts",
  "index.ts",
  "memory-store.ts",
  "schema.ts",
  "service.ts",
  "store.ts",
  "supabase-store.ts",
  "types.ts",
  "variables.ts",
  "delivery.ts",
  "webhook.ts",
  "webhook-verify.ts",
  "order-confirmation.ts",
  "shipment-confirmation.ts",
];
for (const file of emailFiles) {
  const path = resolve(emailDir, file);
  if (!existsSync(path)) {
    throw new Error(`Missing email module ${file}.`);
  }
  const source = readFileSync(path, "utf8");
  if (!source.includes('import "server-only"')) {
    throw new Error(`${file} must be marked server-only.`);
  }
  if (source.includes("NEXT_PUBLIC_RESEND") || source.includes("html:") || source.includes("react:")) {
    throw new Error(`${file} must not expose public Resend env or recreate email HTML.`);
  }
}

const service = read("src/lib/email/service.ts");
if (!service.includes("sendOrderConfirmation") || !service.includes("sendShipmentConfirmation")) {
  throw new Error("Email service must expose sendOrderConfirmation and sendShipmentConfirmation.");
}
if (!service.includes("template:") || !service.includes("idempotencyKey")) {
  throw new Error("Email service must send Resend templates and accept a caller idempotency key.");
}
if (service.includes("crypto.randomUUID") || service.includes("randomUUID(")) {
  throw new Error("Email service must not generate random application-level identifiers.");
}

const reserved = new Set(["FIRST_NAME", "LAST_NAME", "EMAIL", "UNSUBSCRIBE_URL"]);
for (const key of [...ORDER_CONFIRMATION_VARIABLE_KEYS, ...SHIPMENT_CONFIRMATION_VARIABLE_KEYS]) {
  if (reserved.has(key)) {
    throw new Error(`Template variable ${key} is reserved by Resend.`);
  }
}

if (TRANSACTIONAL_EMAIL_TYPES.orderConfirmation !== "order_confirmation") {
  throw new Error("Order confirmation type must stay order_confirmation.");
}
if (TRANSACTIONAL_EMAIL_TYPES.shipmentConfirmation !== "shipment_confirmation") {
  throw new Error("Shipment confirmation type must stay shipment_confirmation.");
}

if (recipientAddress("  Ada@Shadesuk.example ") !== "ada@shadesuk.example") {
  throw new Error("Recipient emails must be normalised.");
}
if (recipientAddress("not-an-email") !== null) {
  throw new Error("Invalid recipient emails must be rejected.");
}

const orderVariables = toOrderConfirmationVariables({
  recipientEmail: "ada@shadesuk.example",
  customerFirstName: "Ada",
  customerLastName: "Lovelace",
  orderReference: "SHU1A2B3C4D5E",
  placedAt: "2026-09-21T10:00:00.000Z",
  currency: "GBP",
  subtotalMinor: 4900,
  shippingMinor: 465,
  totalMinor: 5365,
  items: [
    {
      productName: "Frame 01",
      colourName: "Black",
      variantName: null,
      quantity: 1,
      unitPriceMinor: 4900,
      lineTotalMinor: 4900,
    },
  ],
  deliveryAddress: {
    name: "Ada Lovelace",
    line1: "10 Example Street",
    line2: null,
    city: "London",
    county: null,
    postcode: "E1 6AN",
    country: "GB",
  },
});
if (orderVariables.CUSTOMER_NAME !== "Ada Lovelace") {
  throw new Error("Order confirmation must pass customer name from the payload.");
}
if (orderVariables.ORDER_REFERENCE !== "SHU1A2B3C4D5E") {
  throw new Error("Order confirmation must pass the order reference.");
}
if (typeof orderVariables.ORDER_TOTAL !== "string" || !orderVariables.ORDER_TOTAL.includes("53.65")) {
  throw new Error("Order confirmation total must be formatted GBP from minor units.");
}
if (typeof orderVariables.ORDER_ITEMS_SUMMARY !== "string" || !orderVariables.ORDER_ITEMS_SUMMARY.includes("Frame 01")) {
  throw new Error("Order confirmation must summarise existing order items, not invent catalogue data.");
}

const shipmentVariables = toShipmentConfirmationVariables({
  recipientEmail: "ada@shadesuk.example",
  customerFirstName: "Ada",
  customerLastName: "Lovelace",
  orderReference: "SHU1A2B3C4D5E",
  shipmentStatus: "dispatched",
  carrierName: "Royal Mail",
  trackingNumber: "AB123",
  trackingUrl: "https://example.com/track/AB123",
  shippedAt: "2026-09-22T10:00:00.000Z",
  trackOrderUrl: trackOrderCtaUrl(),
  items: [
    {
      productName: "Frame 01",
      colourName: "Black",
      variantName: null,
      quantity: 1,
      unitPriceMinor: 4900,
      lineTotalMinor: 4900,
    },
  ],
});
if (shipmentVariables.ORDER_REFERENCE !== "SHU1A2B3C4D5E") {
  throw new Error("Shipment confirmation must pass the order reference.");
}
if (shipmentVariables.SHIPMENT_STATUS !== "Dispatched") {
  throw new Error("Shipment confirmation must pass the shipment status label.");
}
if (shipmentVariables.CARRIER_NAME !== "Royal Mail" || shipmentVariables.TRACKING_NUMBER !== "AB123") {
  throw new Error("Shipment confirmation must pass carrier and tracking reference.");
}
if (shipmentVariables.TRACKING_URL !== "https://example.com/track/AB123") {
  throw new Error("Shipment confirmation must pass a safe https tracking URL.");
}
if (
  shipmentVariables.TRACK_ORDER_URL !== trackOrderCtaUrl() ||
  shipmentVariables.TRACK_ORDER_LABEL !== "Track order" ||
  !String(shipmentVariables.TRACK_ORDER_URL).endsWith("/track-order")
) {
  throw new Error("Shipment confirmation must include a Track Order CTA on this site.");
}
if (String(shipmentVariables.TRACK_ORDER_URL).includes("?") || String(shipmentVariables.TRACK_ORDER_URL).includes("SHU")) {
  throw new Error("Track Order CTA must not put the order reference in the URL.");
}
if (typeof shipmentVariables.ORDER_ITEMS_SUMMARY !== "string" || !shipmentVariables.ORDER_ITEMS_SUMMARY.includes("Frame 01")) {
  throw new Error("Shipment confirmation must include the shipped order lines.");
}
if (toShipmentConfirmationVariables({
  recipientEmail: "ada@shadesuk.example",
  customerFirstName: "Ada",
  customerLastName: "Lovelace",
  orderReference: "SHU1A2B3C4D5E",
  shipmentStatus: "tracking_unavailable",
  carrierName: null,
  trackingNumber: null,
  trackingUrl: "http://insecure.example/track",
  shippedAt: null,
  trackOrderUrl: "https://evil.example/track-order",
  items: [],
}).TRACKING_URL !== "") {
  throw new Error("Non-https tracking URLs must not be passed to templates.");
}
if (toShipmentConfirmationVariables({
  recipientEmail: "ada@shadesuk.example",
  customerFirstName: "Ada",
  customerLastName: "Lovelace",
  orderReference: "SHU1A2B3C4D5E",
  shipmentStatus: "tracking_unavailable",
  carrierName: "Royal Mail",
  trackingNumber: null,
  trackingUrl: null,
  shippedAt: null,
  trackOrderUrl: "https://evil.example/track-order?ref=SHU1A2B3C4D5E",
  items: [],
}).TRACK_ORDER_URL !== "") {
  throw new Error("Track Order CTA must stay on the site track-order path without a query string.");
}
if (!isShipmentConfirmationStatus("dispatched") || !isShipmentConfirmationStatus("tracking_unavailable")) {
  throw new Error("Dispatch and tracking-unavailable are shipment confirmation events.");
}
if (isShipmentConfirmationStatus("pending") || isShipmentConfirmationStatus("exception")) {
  throw new Error("Pending and exception must not send a shipment confirmation.");
}

if (formatResendFromHeader({ fromName: "SHADESUK", fromEmail: "orders@example.com" }) !== "SHADESUK <orders@example.com>") {
  throw new Error("From header must use RESEND_FROM_NAME and RESEND_FROM_EMAIL.");
}

if (redactSecrets("key re_123abc Bearer secret") !== "key [redacted] [redacted]") {
  throw new Error("Provider errors must redact Resend secrets.");
}
if (providerFailureMessage({ message: "invalid_api_key re_secretvalue" }).includes("re_secretvalue")) {
  throw new Error("Structured failures must not leak API keys.");
}

const triggerSurfaces = [
  "src/services/checkout.ts",
  "src/app/admin/orders/actions.ts",
];
for (const surface of triggerSurfaces) {
  const source = read(surface);
  if (
    source.includes("@/lib/email") ||
    source.includes("sendOrderConfirmation") ||
    source.includes("sendShipmentConfirmation") ||
    source.includes("createOrGetEmailEvent") ||
    source.includes("dispatchOrderConfirmationEmail") ||
    source.includes("dispatchShipmentConfirmationEmail") ||
    source.includes("onVerifiedPaymentCaptured") ||
    source.includes("onShipmentConfirmed")
  ) {
    throw new Error(`${surface} must not trigger transactional emails.`);
  }
}

const adminOrders = read("src/services/admin-orders.ts");
if (!adminOrders.includes("onShipmentConfirmed") || !adminOrders.includes("finishConfirmedShipment")) {
  throw new Error("Committed dispatch must call the shipment confirmation hook.");
}
if (
  adminOrders.includes("sendOrderConfirmation") ||
  adminOrders.includes("sendShipmentConfirmation") ||
  adminOrders.includes("getResendClient") ||
  adminOrders.includes('from "resend"') ||
  adminOrders.includes("dispatchOrderConfirmationEmail") ||
  adminOrders.includes("createSupabaseAdminClient")
) {
  throw new Error("Admin orders must not send mail or use the service-role client directly.");
}
const afterShipment = read("src/lib/fulfilment/after-shipment.ts");
if (!afterShipment.includes('import "server-only"') || !afterShipment.includes("dispatchShipmentConfirmationEmail")) {
  throw new Error("Shipment hook must dispatch confirmation email after commit.");
}
if (afterShipment.includes("getResendClient") || afterShipment.includes('from "resend"')) {
  throw new Error("Shipment hook must not construct the Resend client.");
}

const orderConfirmationTrigger = read("src/lib/email/order-confirmation.ts");
if (
  !orderConfirmationTrigger.includes("createOrGetOrderConfirmationEvent") ||
  !orderConfirmationTrigger.includes("ownsSendAttempt") ||
  !orderConfirmationTrigger.includes("sendOrderConfirmation") ||
  !orderConfirmationTrigger.includes("markEmailSent") ||
  !orderConfirmationTrigger.includes("markEmailFailed") ||
  !orderConfirmationTrigger.includes("customer_email")
) {
  throw new Error("Order confirmation trigger must use the event layer, Resend service, and orders.customer_email.");
}
if (orderConfirmationTrigger.includes("sendShipmentConfirmation")) {
  throw new Error("Order confirmation must not send shipment emails.");
}
if (
  !orderConfirmationTrigger.includes('payment_status !== ORDER_CONFIRMATION_PAYMENT_STATUS') &&
  !orderConfirmationTrigger.includes('payment_status !== "captured"')
) {
  throw new Error("Order confirmation must gate on captured payment_status.");
}

const afterCaptured = read("src/lib/payment/after-captured.ts");
if (!afterCaptured.includes('import "server-only"')) {
  throw new Error("Payment captured hook must be server-only.");
}
if (!afterCaptured.includes("dispatchOrderConfirmationEmail") || afterCaptured.includes("sendShipmentConfirmation")) {
  throw new Error("Captured-payment hook must dispatch order confirmation only, after commit.");
}
if (afterCaptured.includes("from \"resend\"") || afterCaptured.includes("getResendClient")) {
  throw new Error("Payment layer must not construct the Resend client.");
}

if (ORDER_CONFIRMATION_PAYMENT_STATUS !== "captured") {
  throw new Error("Order confirmation paid gate must remain captured.");
}

const eventsSource = read("src/lib/email/events.ts");
if (eventsSource.includes("sendOrderConfirmation") || eventsSource.includes("sendShipmentConfirmation")) {
  throw new Error("Email event persistence must not send Resend messages.");
}
const supabaseStoreSource = read("src/lib/email/supabase-store.ts");
if (!supabaseStoreSource.includes("isUniqueViolation") || !supabaseStoreSource.includes('.eq("status", "pending")')) {
  throw new Error("Supabase email store must treat unique conflicts and pending-only updates.");
}

const initialSchema = read("supabase/migrations/20260914230750_initial_production_schema.sql");
if (!initialSchema.includes("idempotency_key text not null unique")) {
  throw new Error("email_events.idempotency_key must remain unique in Postgres.");
}
if (!initialSchema.includes("'pending'") || !initialSchema.includes("'sent'") || !initialSchema.includes("'failed'")) {
  throw new Error("email_status enum must remain pending/sent/failed.");
}

const eventMigration = read("supabase/migrations/20260921140000_email_events_attempts_and_shipment.sql");
if (!eventMigration.includes("shipment_id") || !eventMigration.includes("attempts")) {
  throw new Error("Migration must add shipment_id and attempts only as missing fields.");
}

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const SHIPMENT_ID = "22222222-2222-4222-8222-222222222222";
const MESSAGE_ID = "33333333-3333-4333-8333-333333333333";

if (orderConfirmationIdempotencyKey(ORDER_ID) !== `order_confirmation:${ORDER_ID}`) {
  throw new Error("Order confirmation idempotency key drifted.");
}
if (shipmentConfirmationIdempotencyKey(SHIPMENT_ID) !== `shipment_confirmation:${SHIPMENT_ID}`) {
  throw new Error("Shipment confirmation idempotency key drifted.");
}

verifyEmailEvents()
  .then(() => {
    console.log("verify-email: ok");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });

async function verifyEmailEvents() {
  const store = createMemoryEmailEventStore(() => "2026-09-21T12:00:00.000Z");
  const payload = {
    idempotencyKey: orderConfirmationIdempotencyKey(ORDER_ID),
    emailType: "order_confirmation" as const,
    recipientEmail: "Ada@Shadesuk.example",
    orderId: ORDER_ID,
    shipmentId: null,
  };

  const [first, second] = await Promise.all([
    createOrGetEmailEvent(payload, store),
    createOrGetEmailEvent(payload, store),
  ]);
  if (first.status === "error" || second.status === "error") {
    throw new Error("Concurrent createOrGet must not error on a unique key.");
  }
  const createdCount = [first, second].filter((result) => result.status === "created").length;
  const existingCount = [first, second].filter((result) => result.status === "existing").length;
  if (createdCount !== 1 || existingCount !== 1) {
    throw new Error("Exactly one concurrent caller may own the send; the other must see the existing row.");
  }
  if (first.event.id !== second.event.id) {
    throw new Error("Concurrent duplicate creation must resolve to one email_event row.");
  }
  const created = first.status === "created" ? first : second;
  if (!ownsSendAttempt(created)) {
    throw new Error("ownsSendAttempt must identify the created event.");
  }

  const event = created.event;
  if (event.attempts !== 0 || event.status !== "pending" || event.recipient_email !== "ada@shadesuk.example") {
    throw new Error("New email events must start pending with zero attempts and a normalised recipient.");
  }

  const sent = await markEmailSent(event.id, MESSAGE_ID, store);
  if (sent.status !== "ok" || sent.event.status !== "sent" || sent.event.provider_message_id !== MESSAGE_ID) {
    throw new Error("pending → sent must persist the Resend message id.");
  }
  if (sent.event.attempts !== 1 || !sent.event.sent_at) {
    throw new Error("First successful send must set attempts = 1 and sent_at.");
  }

  const sentAgain = await markEmailSent(event.id, MESSAGE_ID, store);
  if (sentAgain.status !== "conflict" || sentAgain.event?.status !== "sent") {
    throw new Error("sent → sent/failed transitions must be rejected.");
  }
  const failAfterSent = await markEmailFailed(event.id, { message: "too late" }, store);
  if (failAfterSent.status !== "conflict") {
    throw new Error("sent → failed must be rejected.");
  }

  const failStore = createMemoryEmailEventStore();
  const pendingFail = await createOrGetEmailEvent(payload, failStore);
  if (pendingFail.status !== "created") {
    throw new Error("Failure-path fixture must create a pending event.");
  }
  const failed = await markEmailFailed(
    pendingFail.event.id,
    { message: "invalid_api_key re_secretvalue Bearer token" },
    failStore,
  );
  if (failed.status !== "ok" || failed.event.status !== "failed") {
    throw new Error("pending → failed must persist.");
  }
  if (failed.event.attempts !== 1) {
    throw new Error("First failed send must set attempts = 1.");
  }
  if (failed.event.error_message?.includes("re_secretvalue") || failed.event.error_message?.includes("Bearer")) {
    throw new Error("Persisted errors must be sanitized.");
  }

  const shipmentStore = createMemoryEmailEventStore();
  const shipment = await createOrGetEmailEvent(
    {
      idempotencyKey: shipmentConfirmationIdempotencyKey(SHIPMENT_ID),
      emailType: "shipment_confirmation",
      recipientEmail: "ada@shadesuk.example",
      orderId: ORDER_ID,
      shipmentId: SHIPMENT_ID,
    },
    shipmentStore,
  );
  if (shipment.status !== "created" || shipment.event.shipment_id !== SHIPMENT_ID || shipment.event.order_id !== ORDER_ID) {
    throw new Error("Shipment confirmation events must store shipment_id and order_id.");
  }

  const badKey = await createOrGetEmailEvent(
    { ...payload, idempotencyKey: `order_confirmation:${ORDER_ID}:${Date.now()}` },
    createMemoryEmailEventStore(),
  );
  if (badKey.status !== "error") {
    throw new Error("Timestamped idempotency keys must be rejected.");
  }

  if (deliveryStatusForResendType("email.delivered") !== "delivered") {
    throw new Error("email.delivered must map to delivery_status delivered.");
  }
  if (decideDeliveryTransition({
    currentStatus: "bounced",
    currentAt: "2026-09-21T12:00:00.000Z",
    incomingStatus: "delivered",
    incomingAt: "2026-09-21T13:00:00.000Z",
  }) !== "ignore") {
    throw new Error("delivered must not overwrite bounced.");
  }
  if (decideDeliveryTransition({
    currentStatus: "delivered",
    currentAt: "2026-09-21T13:00:00.000Z",
    incomingStatus: "bounced",
    incomingAt: "2026-09-21T12:00:00.000Z",
  }) !== "ignore") {
    throw new Error("Older bounced webhooks must not overwrite later delivered state.");
  }

  const webhookStore = createMemoryEmailEventStore();
  const pending = await createOrGetEmailEvent(payload, webhookStore);
  if (pending.status !== "created") {
    throw new Error("Webhook fixture must create a pending event.");
  }
  const sentEvent = await markEmailSent(pending.event.id, MESSAGE_ID, webhookStore);
  if (sentEvent.status !== "ok") {
    throw new Error("Webhook fixture must reach application sent state.");
  }
  if (sentEvent.event.delivery_status !== "unknown") {
    throw new Error("Application sent must not imply mailbox delivered.");
  }

  const delivered = await processVerifiedResendWebhook(
    {
      type: "email.delivered",
      createdAt: "2026-09-21T14:00:00.000Z",
      emailId: MESSAGE_ID,
      providerEventId: "msg_delivered_1",
    },
    webhookStore,
  );
  if (delivered.httpStatus !== 200 || delivered.outcome !== "updated") {
    throw new Error("email.delivered must set delivery_status.");
  }
  const afterDelivered = await webhookStore.findById(pending.event.id);
  if (afterDelivered?.delivery_status !== "delivered") {
    throw new Error("email.delivered must persist delivery_status = delivered.");
  }

  const duplicate = await processVerifiedResendWebhook(
    {
      type: "email.delivered",
      createdAt: "2026-09-21T14:00:00.000Z",
      emailId: MESSAGE_ID,
      providerEventId: "msg_delivered_1",
    },
    webhookStore,
  );
  if (duplicate.outcome !== "duplicate") {
    throw new Error("Duplicate svix-id must be a no-op.");
  }

  const bounceStore = createMemoryEmailEventStore();
  const bouncePending = await createOrGetEmailEvent(payload, bounceStore);
  if (bouncePending.status !== "created") {
    throw new Error("Bounce fixture must create a pending event.");
  }
  await markEmailSent(bouncePending.event.id, MESSAGE_ID, bounceStore);
  const bounced = await processVerifiedResendWebhook(
    {
      type: "email.bounced",
      createdAt: "2026-09-21T14:10:00.000Z",
      emailId: MESSAGE_ID,
      providerEventId: "msg_bounced_1",
    },
    bounceStore,
  );
  if (bounced.outcome !== "updated") {
    throw new Error("email.bounced must set delivery_status.");
  }
  if ((await bounceStore.findById(bouncePending.event.id))?.delivery_status !== "bounced") {
    throw new Error("email.bounced must persist delivery_status = bounced.");
  }
  const deliveredAfterBounce = await processVerifiedResendWebhook(
    {
      type: "email.delivered",
      createdAt: "2026-09-21T15:00:00.000Z",
      emailId: MESSAGE_ID,
      providerEventId: "msg_delivered_after_bounce",
    },
    bounceStore,
  );
  if (deliveredAfterBounce.outcome !== "unchanged") {
    throw new Error("delivered must not overwrite bounced.");
  }
  if ((await bounceStore.findById(bouncePending.event.id))?.delivery_status !== "bounced") {
    throw new Error("Bounce state must remain after a later delivered webhook.");
  }

  const complaintStore = createMemoryEmailEventStore();
  const complaintPending = await createOrGetEmailEvent(payload, complaintStore);
  if (complaintPending.status !== "created") {
    throw new Error("Complaint fixture must create a pending event.");
  }
  await markEmailSent(complaintPending.event.id, MESSAGE_ID, complaintStore);
  const complained = await processVerifiedResendWebhook(
    {
      type: "email.complained",
      createdAt: "2026-09-21T14:20:00.000Z",
      emailId: MESSAGE_ID,
      providerEventId: "msg_complained_1",
    },
    complaintStore,
  );
  if (complained.outcome !== "updated") {
    throw new Error("email.complained must set delivery_status.");
  }
  if ((await complaintStore.findById(complaintPending.event.id))?.delivery_status !== "complained") {
    throw new Error("email.complained must persist delivery_status = complained.");
  }

  const untouched = await processVerifiedResendWebhook(
    {
      type: "email.delivered",
      createdAt: "2026-09-21T14:00:00.000Z",
      emailId: "99999999-9999-4999-8999-999999999999",
      providerEventId: "msg_unknown",
    },
    webhookStore,
  );
  if (untouched.httpStatus !== 404 || untouched.outcome !== "unmatched") {
    throw new Error("Unknown provider message id must not be acknowledged as processed.");
  }
  if ((await webhookStore.findById(pending.event.id))?.delivery_status !== "delivered") {
    throw new Error("Unknown message ids must not mutate unrelated email events.");
  }

  const ignored = await processVerifiedResendWebhook(
    {
      type: "email.opened",
      createdAt: "2026-09-21T14:30:00.000Z",
      emailId: MESSAGE_ID,
      providerEventId: "msg_opened",
    },
    webhookStore,
  );
  if (ignored.outcome !== "ignored") {
    throw new Error("Unsupported Resend events must be acknowledged without changing delivery_status.");
  }

  const invalid = verifyResendWebhook({
    payload: '{"type":"email.delivered"}',
    headers: { id: "msg_bad", timestamp: "1", signature: "v1,not-a-signature" },
    webhookSecret: "whsec_dGVzdC1yZXNlbmQtd2ViaG9vay1zZWNyZXQ",
  });
  if (invalid.ok) {
    throw new Error("Invalid webhook signatures must be rejected.");
  }

  const webhookRoute = read("src/app/api/webhooks/resend/route.ts");
  const webhookProcessor = read("src/lib/email/webhook.ts");
  for (const source of [webhookRoute, webhookProcessor]) {
    if (
      source.includes('.from("orders")') ||
      source.includes('.from("payments")') ||
      source.includes('.from("shipments")')
    ) {
      throw new Error("Resend webhook processing must not mutate orders, payments, or shipments.");
    }
    if (source.includes("sendOrderConfirmation") || source.includes("sendShipmentConfirmation")) {
      throw new Error("Resend webhook processing must not send mail.");
    }
  }

  const deliveryMigration = read(
    "supabase/migrations/20260921150000_email_delivery_status_and_webhooks.sql",
  );
  if (!deliveryMigration.includes("email_delivery_status") || !deliveryMigration.includes("email_webhook_events")) {
    throw new Error("Delivery-status migration must add enum and webhook receipts.");
  }

  await verifyOrderConfirmationTrigger();
  await verifyShipmentConfirmationTrigger();
}

async function verifyOrderConfirmationTrigger() {
  const GUEST_ORDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const AUTH_ORDER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const DUP_ORDER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const FAIL_ORDER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const BAD_EMAIL_ORDER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const UNPAID_ORDER_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const WEBHOOK_ORDER_ID = "abababab-abab-4aba-8aba-abababababab";
  const PROVIDER_MESSAGE_ID = "44444444-4444-4444-8444-444444444444";

  function snapshot(orderId: string, input: Partial<OrderRow> & Pick<OrderRow, "customer_email" | "payment_status">): ConfirmedOrderSnapshot {
    return {
      order: {
        id: orderId,
        order_reference: "SHU1A2B3C4D5E",
        user_id: input.user_id === undefined ? null : input.user_id,
        customer_email: input.customer_email,
        customer_first_name: input.customer_first_name ?? "Ada",
        customer_last_name: input.customer_last_name ?? "Lovelace",
        status: "placed",
        payment_status: input.payment_status,
        currency: "GBP",
        subtotal_minor: 4900,
        shipping_minor: 465,
        total_minor: 5365,
        delivery_address: {
          first_name: "Ada",
          last_name: "Lovelace",
          address_line_1: "10 Example Street",
          city: "London",
          postcode: "E1 6AN",
          country: "GB",
        },
        created_at: "2026-09-21T10:00:00.000Z",
        updated_at: "2026-09-21T10:00:00.000Z",
      },
      items: [
        {
          id: "99999999-9999-4999-8999-999999999991",
          order_id: orderId,
          product_id: "99999999-9999-4999-8999-999999999992",
          product_variant_id: null,
          sku: "FRAME-01-BLK",
          product_name: "Frame 01",
          colour_name: "Black",
          variant_name: null,
          quantity: 1,
          unit_price_minor: 4900,
          line_total_minor: 4900,
          product_snapshot: null,
          created_at: "2026-09-21T10:00:00.000Z",
        },
      ],
    };
  }

  // A + D: captured guest order → one event → Resend → sent + provider id
  const guestStore = createMemoryEmailEventStore();
  const guestOrder = snapshot(GUEST_ORDER_ID, {
    customer_email: "guest@shadesuk.example",
    payment_status: "captured",
    user_id: null,
  });
  let guestSends = 0;
  const guestSent = await dispatchOrderConfirmationEmail(GUEST_ORDER_ID, {
    store: guestStore,
    loadOrder: async () => guestOrder,
    send: async (payload, options) => {
      guestSends += 1;
      if (payload.recipientEmail !== "guest@shadesuk.example") {
        throw new Error("Guest recipient must come from orders.customer_email.");
      }
      if (payload.orderReference !== "SHU1A2B3C4D5E" || payload.totalMinor !== 5365) {
        throw new Error("Confirmation payload must use the confirmed order totals.");
      }
      if (options?.idempotencyKey !== orderConfirmationIdempotencyKey(GUEST_ORDER_ID)) {
        throw new Error("Send must pass order_confirmation:{order_id}.");
      }
      return { success: true, messageId: PROVIDER_MESSAGE_ID };
    },
  });
  if (guestSent.outcome !== "sent" || guestSends !== 1) {
    throw new Error("Captured guest order must send exactly one confirmation.");
  }
  const guestEvent = await guestStore.findById(guestSent.eventId);
  if (
    !guestEvent ||
    guestEvent.status !== "sent" ||
    guestEvent.provider_message_id !== PROVIDER_MESSAGE_ID ||
    guestEvent.delivery_status !== "unknown" ||
    guestEvent.recipient_email !== "guest@shadesuk.example"
  ) {
    throw new Error("Successful send must persist provider_message_id with delivery_status unknown.");
  }

  // Authenticated captured order still uses orders.customer_email, not a profile
  const authStore = createMemoryEmailEventStore();
  const authOrder = snapshot(AUTH_ORDER_ID, {
    customer_email: "ada@shadesuk.example",
    payment_status: "captured",
    user_id: "12121212-1212-4121-8121-121212121212",
  });
  const authSent = await dispatchOrderConfirmationEmail(AUTH_ORDER_ID, {
    store: authStore,
    loadOrder: async () => authOrder,
    send: async (payload) => {
      if (payload.recipientEmail !== "ada@shadesuk.example") {
        throw new Error("Authenticated orders must still use orders.customer_email.");
      }
      return { success: true, messageId: "55555555-5555-4555-8555-555555555555" };
    },
  });
  if (authSent.outcome !== "sent") {
    throw new Error("Captured authenticated order must send confirmation.");
  }

  // B: duplicate payment/order processing → one event, one Resend send
  const dupStore = createMemoryEmailEventStore();
  const dupOrder = snapshot(DUP_ORDER_ID, {
    customer_email: "ada@shadesuk.example",
    payment_status: "captured",
  });
  let dupSends = 0;
  const sendDup = async () =>
    dispatchOrderConfirmationEmail(DUP_ORDER_ID, {
      store: dupStore,
      loadOrder: async () => dupOrder,
      send: async () => {
        dupSends += 1;
        return { success: true, messageId: "66666666-6666-4666-8666-666666666666" };
      },
    });
  const [dupFirst, dupSecond] = await Promise.all([sendDup(), sendDup()]);
  const dupSentCount = [dupFirst, dupSecond].filter((result) => result.outcome === "sent").length;
  const dupSkipped = [dupFirst, dupSecond].filter((result) => result.outcome === "skipped");
  if (dupSends !== 1 || dupSentCount !== 1 || dupSkipped.length !== 1) {
    throw new Error("Duplicate captured-order processing must send only once.");
  }
  if (dupSkipped[0]?.reason !== "existing_event") {
    throw new Error("Non-owner duplicate must skip because the email event already exists.");
  }
  const persistedDup = await dupStore.findByIdempotencyKey(orderConfirmationIdempotencyKey(DUP_ORDER_ID));
  if (!persistedDup || persistedDup.status !== "sent") {
    throw new Error("Duplicate processing must leave a single sent email_event.");
  }

  // C: Resend failure records failed email; order snapshot stays captured
  const failStore = createMemoryEmailEventStore();
  const failOrder = snapshot(FAIL_ORDER_ID, {
    customer_email: "ada@shadesuk.example",
    payment_status: "captured",
  });
  const failed = await dispatchOrderConfirmationEmail(FAIL_ORDER_ID, {
    store: failStore,
    loadOrder: async () => failOrder,
    send: async () => ({ success: false, error: "Resend unavailable" }),
  });
  if (failed.outcome !== "failed" || failed.reason !== "Resend unavailable") {
    throw new Error("Resend failure must be recorded without throwing.");
  }
  const failedEvent = failed.eventId ? await failStore.findById(failed.eventId) : null;
  if (!failedEvent || failedEvent.status !== "failed" || failedEvent.provider_message_id) {
    throw new Error("Resend failure must set email_status = failed.");
  }
  if (failOrder.order.payment_status !== "captured" || failOrder.order.status !== "placed") {
    throw new Error("Resend failure must not mutate the successful order.");
  }

  // E: invalid recipient → no Resend call; order remains successful
  const badStore = createMemoryEmailEventStore();
  const badOrder = snapshot(BAD_EMAIL_ORDER_ID, {
    customer_email: "not-an-email",
    payment_status: "captured",
  });
  let badSends = 0;
  const bad = await dispatchOrderConfirmationEmail(BAD_EMAIL_ORDER_ID, {
    store: badStore,
    loadOrder: async () => badOrder,
    send: async () => {
      badSends += 1;
      return { success: true, messageId: PROVIDER_MESSAGE_ID };
    },
  });
  if (bad.outcome !== "failed" || badSends !== 0) {
    throw new Error("Invalid order email must not call Resend.");
  }
  if (await badStore.findByIdempotencyKey(orderConfirmationIdempotencyKey(BAD_EMAIL_ORDER_ID))) {
    throw new Error("Invalid recipient must not persist a sendable email_event.");
  }
  if (badOrder.order.payment_status !== "captured") {
    throw new Error("Invalid recipient must not fail the order.");
  }

  const unpaid = await dispatchOrderConfirmationEmail(UNPAID_ORDER_ID, {
    store: createMemoryEmailEventStore(),
    loadOrder: async () =>
      snapshot(UNPAID_ORDER_ID, {
        customer_email: "ada@shadesuk.example",
        payment_status: "created",
      }),
    send: async () => {
      throw new Error("Uncaptured orders must not send.");
    },
  });
  if (unpaid.outcome !== "skipped" || unpaid.reason !== "payment_not_captured") {
    throw new Error("Uncaptured orders must not create or send confirmation emails.");
  }

  // F: sent leaves delivery unknown; existing webhook can mark delivered
  const hookStore = createMemoryEmailEventStore();
  const hookOrder = snapshot(WEBHOOK_ORDER_ID, {
    customer_email: "ada@shadesuk.example",
    payment_status: "captured",
  });
  const hookSent = await dispatchOrderConfirmationEmail(WEBHOOK_ORDER_ID, {
    store: hookStore,
    loadOrder: async () => hookOrder,
    send: async () => ({ success: true, messageId: PROVIDER_MESSAGE_ID }),
  });
  if (hookSent.outcome !== "sent") {
    throw new Error("Webhook continuation fixture must send.");
  }
  const beforeWebhook = await hookStore.findById(hookSent.eventId);
  if (beforeWebhook?.status !== "sent" || beforeWebhook.delivery_status !== "unknown") {
    throw new Error("Successful send must leave delivery_status = unknown.");
  }
  const delivered = await processVerifiedResendWebhook(
    {
      type: "email.delivered",
      createdAt: "2026-09-21T16:00:00.000Z",
      emailId: PROVIDER_MESSAGE_ID,
      providerEventId: "msg_order_delivered",
    },
    hookStore,
  );
  if (delivered.outcome !== "updated") {
    throw new Error("Block 3.2A webhook must still transition delivery_status.");
  }
  if ((await hookStore.findById(hookSent.eventId))?.delivery_status !== "delivered") {
    throw new Error("Webhook must set delivery_status = delivered after a successful send.");
  }

  if (!read("src/lib/payment/after-captured.ts").includes("dispatchOrderConfirmationEmail(orderId)")) {
    throw new Error("onVerifiedPaymentCaptured must call dispatchOrderConfirmationEmail after commit.");
  }
}

async function verifyShipmentConfirmationTrigger() {
  const ORDER_ID = "12121212-1212-4121-8121-121212121212";
  const SHIPMENT_ID = "34343434-3434-4343-8343-343434343434";
  const DUP_ORDER_ID = "56565656-5656-4565-8565-565656565656";
  const DUP_SHIPMENT_ID = "78787878-7878-4787-8787-787878787878";
  const FAIL_ORDER_ID = "90909090-9090-4909-8909-909090909090";
  const FAIL_SHIPMENT_ID = "a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0";
  const PROVIDER_MESSAGE_ID = "b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1";

  function shipmentSnapshot(
    orderId: string,
    shipmentId: string,
    input: Partial<ShipmentRow> & Pick<ShipmentRow, "status"> & { payment_status?: OrderRow["payment_status"] },
  ): ConfirmedShipmentSnapshot {
    const paymentStatus = input.payment_status ?? "captured";
    return {
      order: {
        id: orderId,
        order_reference: "SHU1A2B3C4D5E",
        user_id: null,
        customer_email: "guest@shadesuk.example",
        customer_first_name: "Ada",
        customer_last_name: "Lovelace",
        status: "dispatched",
        payment_status: paymentStatus,
        currency: "GBP",
        subtotal_minor: 4900,
        shipping_minor: 465,
        total_minor: 5365,
        delivery_address: {
          first_name: "Ada",
          last_name: "Lovelace",
          address_line_1: "10 Example Street",
          city: "London",
          postcode: "E1 6AN",
          country: "GB",
        },
        created_at: "2026-09-21T10:00:00.000Z",
        updated_at: "2026-09-22T10:00:00.000Z",
      },
      items: [
        {
          id: "99999999-9999-4999-8999-999999999991",
          order_id: orderId,
          product_id: "99999999-9999-4999-8999-999999999992",
          product_variant_id: null,
          sku: "FRAME-01-BLK",
          product_name: "Frame 01",
          colour_name: "Black",
          variant_name: null,
          quantity: 1,
          unit_price_minor: 4900,
          line_total_minor: 4900,
          product_snapshot: null,
          created_at: "2026-09-21T10:00:00.000Z",
        },
      ],
      shipment: {
        id: shipmentId,
        order_id: orderId,
        carrier_name: input.carrier_name === undefined ? "Royal Mail" : input.carrier_name,
        tracking_number: input.tracking_number === undefined ? "AB123" : input.tracking_number,
        tracking_url: input.tracking_url === undefined ? "https://example.com/track/AB123" : input.tracking_url,
        status: input.status,
        shipped_at: input.shipped_at === undefined ? "2026-09-22T10:00:00.000Z" : input.shipped_at,
        delivered_at: null,
        notes: null,
        created_at: "2026-09-22T10:00:00.000Z",
        updated_at: "2026-09-22T10:00:00.000Z",
      },
    };
  }

  const store = createMemoryEmailEventStore();
  const confirmed = shipmentSnapshot(ORDER_ID, SHIPMENT_ID, { status: "dispatched" });
  let sends = 0;
  const sent = await dispatchShipmentConfirmationEmail(ORDER_ID, {
    store,
    loadShipment: async () => confirmed,
    send: async (payload, options) => {
      sends += 1;
      if (payload.orderReference !== "SHU1A2B3C4D5E" || payload.shipmentStatus !== "dispatched") {
        throw new Error("Shipment email must include the order reference and shipment status.");
      }
      if (payload.carrierName !== "Royal Mail" || payload.trackingNumber !== "AB123") {
        throw new Error("Shipment email must include carrier and tracking reference.");
      }
      if (payload.trackingUrl !== "https://example.com/track/AB123" || payload.trackOrderUrl !== trackOrderCtaUrl()) {
        throw new Error("Shipment email must include the tracking URL and Track Order CTA.");
      }
      if (payload.items.length !== 1 || payload.items[0]?.productName !== "Frame 01") {
        throw new Error("Shipment email must include the order lines.");
      }
      if (payload.recipientEmail !== "guest@shadesuk.example") {
        throw new Error("Shipment email must use orders.customer_email.");
      }
      if (options?.idempotencyKey !== shipmentConfirmationIdempotencyKey(SHIPMENT_ID)) {
        throw new Error("Send must pass shipment_confirmation:{shipment_id}.");
      }
      return { success: true, messageId: PROVIDER_MESSAGE_ID };
    },
  });
  if (sent.outcome !== "sent" || sends !== 1) {
    throw new Error("A confirmed shipment must send exactly one email.");
  }
  const event = await store.findById(sent.eventId);
  if (!event || event.status !== "sent" || event.shipment_id !== SHIPMENT_ID || event.email_type !== "shipment_confirmation") {
    throw new Error("Successful shipment email must persist one shipment_confirmation event.");
  }
  if (confirmed.shipment.status !== "dispatched" || confirmed.order.payment_status !== "captured") {
    throw new Error("Sending must not mutate the shipment or order.");
  }

  const unavailable = await dispatchShipmentConfirmationEmail("cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd", {
    store: createMemoryEmailEventStore(),
    loadShipment: async () =>
      shipmentSnapshot("cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd", "dededede-dede-4ded-8ded-dededededede", {
        status: "tracking_unavailable",
        tracking_number: null,
        tracking_url: null,
      }),
    send: async (payload) => {
      if (payload.shipmentStatus !== "tracking_unavailable" || payload.trackingNumber !== null) {
        throw new Error("Dispatch without tracking must still confirm the shipment.");
      }
      return { success: true, messageId: "efefefef-efef-4efe-8efe-efefefefefef" };
    },
  });
  if (unavailable.outcome !== "sent") {
    throw new Error("Tracking-unavailable dispatch must send one shipment email.");
  }

  const dupStore = createMemoryEmailEventStore();
  const dupSnapshot = shipmentSnapshot(DUP_ORDER_ID, DUP_SHIPMENT_ID, { status: "dispatched" });
  let dupSends = 0;
  const sendDup = () =>
    dispatchShipmentConfirmationEmail(DUP_ORDER_ID, {
      store: dupStore,
      loadShipment: async () => dupSnapshot,
      send: async () => {
        dupSends += 1;
        return { success: true, messageId: "f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1" };
      },
    });
  const [dupFirst, dupSecond] = await Promise.all([sendDup(), sendDup()]);
  const dupSent = [dupFirst, dupSecond].filter((result) => result.outcome === "sent").length;
  const dupSkipped = [dupFirst, dupSecond].filter((result) => result.outcome === "skipped");
  if (dupSends !== 1 || dupSent !== 1 || dupSkipped.length !== 1 || dupSkipped[0]?.reason !== "existing_event") {
    throw new Error("Duplicate shipment events must not send a second email.");
  }

  const failStore = createMemoryEmailEventStore();
  const failSnapshot = shipmentSnapshot(FAIL_ORDER_ID, FAIL_SHIPMENT_ID, { status: "in_transit" });
  const failed = await dispatchShipmentConfirmationEmail(FAIL_ORDER_ID, {
    store: failStore,
    loadShipment: async () => failSnapshot,
    send: async () => ({ success: false, error: "Resend unavailable" }),
  });
  if (failed.outcome !== "failed" || failed.reason !== "Resend unavailable") {
    throw new Error("Shipment email failure must be recorded without throwing.");
  }
  const failedEvent = failed.eventId ? await failStore.findById(failed.eventId) : null;
  if (!failedEvent || failedEvent.status !== "failed") {
    throw new Error("Shipment email failure must set email_status = failed.");
  }
  if (failSnapshot.shipment.status !== "in_transit" || failSnapshot.order.status !== "dispatched") {
    throw new Error("Shipment email failure must not roll back shipment or order state.");
  }

  const pending = await dispatchShipmentConfirmationEmail(ORDER_ID, {
    store: createMemoryEmailEventStore(),
    loadShipment: async () => shipmentSnapshot(ORDER_ID, SHIPMENT_ID, { status: "pending" }),
    send: async () => {
      throw new Error("Pending shipments must not send.");
    },
  });
  if (pending.outcome !== "skipped" || pending.reason !== "not_confirmed") {
    throw new Error("Pending shipments must not create a shipment email.");
  }

  const unpaid = await dispatchShipmentConfirmationEmail(ORDER_ID, {
    store: createMemoryEmailEventStore(),
    loadShipment: async () =>
      shipmentSnapshot(ORDER_ID, SHIPMENT_ID, { status: "dispatched", payment_status: "created" }),
    send: async () => {
      throw new Error("Uncaptured orders must not send a shipment email.");
    },
  });
  if (unpaid.outcome !== "skipped" || unpaid.reason !== "payment_not_captured") {
    throw new Error("Uncaptured orders must not send a shipment email.");
  }

  const hookStore = createMemoryEmailEventStore();
  const hookSent = await dispatchShipmentConfirmationEmail("13131313-1313-4131-8131-131313131313", {
    store: hookStore,
    loadShipment: async () =>
      shipmentSnapshot("13131313-1313-4131-8131-131313131313", "14141414-1414-4141-8141-141414141414", {
        status: "dispatched",
      }),
    send: async () => ({ success: true, messageId: PROVIDER_MESSAGE_ID }),
  });
  if (hookSent.outcome !== "sent") {
    throw new Error("Shipment webhook fixture must send.");
  }
  const delivered = await processVerifiedResendWebhook(
    {
      type: "email.delivered",
      createdAt: "2026-09-22T12:00:00.000Z",
      emailId: PROVIDER_MESSAGE_ID,
      providerEventId: "msg_shipment_delivered",
    },
    hookStore,
  );
  if (delivered.outcome !== "updated" || (await hookStore.findById(hookSent.eventId))?.delivery_status !== "delivered") {
    throw new Error("Existing Resend webhook must track shipment email delivery.");
  }
}
