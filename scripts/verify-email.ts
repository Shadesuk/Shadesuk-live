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
  "index.ts",
  "service.ts",
  "types.ts",
  "variables.ts",
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
    source.includes("sendShipmentConfirmation")
  ) {
    throw new Error(`${surface} must not trigger Resend emails in Block 3.1.`);
  }
}

console.log("verify-email: ok");
