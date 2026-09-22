import "server-only";

import { SHIPMENT_STATUS_LABELS } from "@/contracts/fulfilment/shipment";
import { normalizeEmail } from "@/contracts/order/tracking";
import { formatGbpMinor } from "@/lib/money";
import { routes } from "@/lib/navigation";
import { site } from "@/lib/site";
import { safeHttpUrl } from "@/lib/tracking-url";
import { TRACK_ORDER_ACTION } from "@/lib/tracking-copy";
import type { OrderConfirmationItem, OrderConfirmationPayload, ShipmentConfirmationPayload } from "./types";

/**
 * Resend template variable keys must be ASCII letters, numbers, and underscores.
 * Reserved names `FIRST_NAME`, `LAST_NAME`, `EMAIL`, and `UNSUBSCRIBE_URL` are
 * not used. Recipient address is sent as `to`, not as a template variable.
 *
 * The approved dashboard templates are not in this repository, so these keys
 * are the application contract derived from existing order/shipment fields.
 * Align the dashboard variables to this map, or replace the map once the
 * published template variable names are supplied.
 */
export const ORDER_CONFIRMATION_VARIABLE_KEYS = [
  "CUSTOMER_NAME",
  "CUSTOMER_FIRST_NAME",
  "CUSTOMER_LAST_NAME",
  "ORDER_REFERENCE",
  "ORDER_TOTAL",
  "ORDER_SUBTOTAL",
  "ORDER_SHIPPING",
  "ORDER_CURRENCY",
  "ORDER_PLACED_AT",
  "DELIVERY_NAME",
  "DELIVERY_LINE1",
  "DELIVERY_LINE2",
  "DELIVERY_CITY",
  "DELIVERY_COUNTY",
  "DELIVERY_POSTCODE",
  "DELIVERY_COUNTRY",
  "ORDER_ITEMS_SUMMARY",
] as const;

export const SHIPMENT_CONFIRMATION_VARIABLE_KEYS = [
  "CUSTOMER_NAME",
  "CUSTOMER_FIRST_NAME",
  "CUSTOMER_LAST_NAME",
  "ORDER_REFERENCE",
  "SHIPMENT_STATUS",
  "CARRIER_NAME",
  "TRACKING_NUMBER",
  "TRACKING_URL",
  "TRACK_ORDER_URL",
  "TRACK_ORDER_LABEL",
  "ORDER_ITEMS_SUMMARY",
  "SHIPPED_AT",
] as const;

const RESERVED_TEMPLATE_VARIABLES = new Set([
  "FIRST_NAME",
  "LAST_NAME",
  "EMAIL",
  "UNSUBSCRIBE_URL",
]);

const VARIABLE_VALUE_MAX = 2000;

export type TemplateVariables = Record<string, string | number>;

export function toOrderConfirmationVariables(
  payload: OrderConfirmationPayload,
): TemplateVariables {
  const first = payload.customerFirstName.trim();
  const last = payload.customerLastName.trim();
  const address = payload.deliveryAddress;
  return sanitizeVariables({
    CUSTOMER_NAME: customerName(first, last),
    CUSTOMER_FIRST_NAME: first,
    CUSTOMER_LAST_NAME: last,
    ORDER_REFERENCE: payload.orderReference.trim(),
    ORDER_TOTAL: formatGbpMinor(payload.totalMinor),
    ORDER_SUBTOTAL: formatGbpMinor(payload.subtotalMinor),
    ORDER_SHIPPING: formatGbpMinor(payload.shippingMinor),
    ORDER_CURRENCY: payload.currency,
    ORDER_PLACED_AT: payload.placedAt,
    DELIVERY_NAME: address?.name ?? "",
    DELIVERY_LINE1: address?.line1 ?? "",
    DELIVERY_LINE2: address?.line2 ?? "",
    DELIVERY_CITY: address?.city ?? "",
    DELIVERY_COUNTY: address?.county ?? "",
    DELIVERY_POSTCODE: address?.postcode ?? "",
    DELIVERY_COUNTRY: address?.country ?? "",
    ORDER_ITEMS_SUMMARY: summariseOrderItems(payload.items),
  });
}

/** Absolute Track Order page. No order reference or email in the query string. */
export function trackOrderCtaUrl(): string {
  return `${site.url}${routes.trackOrder}`;
}

export function toShipmentConfirmationVariables(
  payload: ShipmentConfirmationPayload,
): TemplateVariables {
  const first = payload.customerFirstName.trim();
  const last = payload.customerLastName.trim();
  return sanitizeVariables({
    CUSTOMER_NAME: customerName(first, last),
    CUSTOMER_FIRST_NAME: first,
    CUSTOMER_LAST_NAME: last,
    ORDER_REFERENCE: payload.orderReference.trim(),
    SHIPMENT_STATUS: SHIPMENT_STATUS_LABELS[payload.shipmentStatus],
    CARRIER_NAME: payload.carrierName?.trim() ?? "",
    TRACKING_NUMBER: payload.trackingNumber?.trim() ?? "",
    TRACKING_URL: safeHttpUrl(payload.trackingUrl) ?? "",
    TRACK_ORDER_URL: safeSiteUrl(payload.trackOrderUrl),
    TRACK_ORDER_LABEL: TRACK_ORDER_ACTION,
    ORDER_ITEMS_SUMMARY: summariseOrderItems(payload.items),
    SHIPPED_AT: payload.shippedAt?.trim() ?? "",
  });
}

export function recipientAddress(email: string): string | null {
  const normalised = normalizeEmail(email);
  if (!normalised || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return null;
  }
  return normalised;
}

function customerName(first: string, last: string): string {
  return [first, last].filter(Boolean).join(" ").trim();
}

function safeSiteUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (url.origin !== site.url) {
      return "";
    }
    if (url.pathname !== routes.trackOrder) {
      return "";
    }
    if (url.search || url.hash) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function summariseOrderItems(items: OrderConfirmationItem[]): string {
  const lines = items.map((item) => {
    const label = [item.productName, item.colourName, item.variantName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" · ");
    return `${label} × ${item.quantity} — ${formatGbpMinor(item.lineTotalMinor)}`;
  });
  return lines.join("\n");
}

function sanitizeVariables(input: TemplateVariables): TemplateVariables {
  const output: TemplateVariables = {};
  for (const [key, value] of Object.entries(input)) {
    if (RESERVED_TEMPLATE_VARIABLES.has(key)) {
      throw new Error(`Template variable ${key} is reserved by Resend.`);
    }
    if (!/^[A-Za-z0-9_]{1,50}$/.test(key)) {
      throw new Error("Template variable key is invalid.");
    }
    if (typeof value === "number") {
      output[key] = value;
      continue;
    }
    output[key] = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, VARIABLE_VALUE_MAX);
  }
  return output;
}
