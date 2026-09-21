import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ORDER_CONFIRMATION_VARIABLE_KEYS,
  SHIPMENT_CONFIRMATION_VARIABLE_KEYS,
  recipientAddress,
  toOrderConfirmationVariables,
  toShipmentConfirmationVariables,
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
  carrierName: "Royal Mail",
  trackingNumber: "AB123",
  trackingUrl: "https://example.com/track/AB123",
  shippedAt: "2026-09-22T10:00:00.000Z",
});
if (shipmentVariables.TRACKING_URL !== "https://example.com/track/AB123") {
  throw new Error("Shipment confirmation must pass a safe https tracking URL.");
}
if (toShipmentConfirmationVariables({
  recipientEmail: "ada@shadesuk.example",
  customerFirstName: "Ada",
  customerLastName: "Lovelace",
  orderReference: "SHU1A2B3C4D5E",
  carrierName: null,
  trackingNumber: null,
  trackingUrl: "http://insecure.example/track",
  shippedAt: null,
}).TRACKING_URL !== "") {
  throw new Error("Non-https tracking URLs must not be passed to templates.");
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
  "src/services/admin-orders.ts",
  "src/app/admin/orders/actions.ts",
];
for (const surface of triggerSurfaces) {
  const source = read(surface);
  if (
    source.includes("@/lib/email") ||
    source.includes("sendOrderConfirmation") ||
    source.includes("sendShipmentConfirmation") ||
    source.includes("createOrGetEmailEvent")
  ) {
    throw new Error(`${surface} must not trigger or persist emails in this block.`);
  }
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
}
