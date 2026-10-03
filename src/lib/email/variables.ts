import "server-only";

import { normalizeEmail } from "@/contracts/order/tracking";
import { formatGbpMinor } from "@/lib/money";
import { routes } from "@/lib/navigation";
import { site } from "@/lib/site";
import { safeHttpUrl } from "@/lib/tracking-url";
import type { OrderConfirmationItem, OrderConfirmationPayload, ShipmentConfirmationPayload } from "./types";

/**
 * Resend template variable keys must be ASCII letters, numbers, and underscores.
 * Reserved names `FIRST_NAME`, `LAST_NAME`, `EMAIL`, and `UNSUBSCRIBE_URL` are
 * not used. Recipient address is sent as `to`, not as a template variable.
 *
 * Keys match the published SHADESUK dashboard templates exactly. Do not rename
 * them and do not send extra variables the templates do not declare.
 */
export const ORDER_CONFIRMATION_VARIABLE_KEYS = [
  "ORDER_NUMBER",
  "ORDER_DATE",
  "TRACK_ORDER_URL",
  "PRODUCT_NAME",
  "PRODUCT_VARIANT",
  "PRODUCT_QUANTITY",
  "PRODUCT_PRICE",
  "SUBTOTAL",
  "SHIPPING",
  "TOTAL",
] as const;

export const SHIPMENT_CONFIRMATION_VARIABLE_KEYS = [
  "ORDER_NUMBER",
  "SHIPMENT_DATE",
  "TRACKING_URL",
  "CARRIER_NAME",
  "AWB_NUMBER",
  "PRODUCT_NAME",
  "PRODUCT_VARIANT",
  "PRODUCT_QUANTITY",
  "PRODUCT_PRICE",
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
  const product = productLine(payload.items);
  return sanitizeVariables({
    ORDER_NUMBER: payload.orderReference.trim(),
    ORDER_DATE: formatEmailDate(payload.placedAt),
    TRACK_ORDER_URL: trackOrderCtaUrl(),
    PRODUCT_NAME: product.name,
    PRODUCT_VARIANT: product.variant,
    PRODUCT_QUANTITY: product.quantity,
    PRODUCT_PRICE: product.price,
    SUBTOTAL: formatGbpMinor(payload.subtotalMinor),
    SHIPPING: formatGbpMinor(payload.shippingMinor),
    TOTAL: formatGbpMinor(payload.totalMinor),
  });
}

/** Absolute Track Order page. No order reference or email in the query string. */
export function trackOrderCtaUrl(): string {
  return `${site.url}${routes.trackOrder}`;
}

export function toShipmentConfirmationVariables(
  payload: ShipmentConfirmationPayload,
): TemplateVariables {
  const product = productLine(payload.items);
  return sanitizeVariables({
    ORDER_NUMBER: payload.orderReference.trim(),
    SHIPMENT_DATE: formatEmailDate(payload.shippedAt),
    TRACKING_URL: safeHttpUrl(payload.trackingUrl) ?? "",
    CARRIER_NAME: payload.carrierName?.trim() ?? "",
    AWB_NUMBER: payload.trackingNumber?.trim() ?? "",
    PRODUCT_NAME: product.name,
    PRODUCT_VARIANT: product.variant,
    PRODUCT_QUANTITY: product.quantity,
    PRODUCT_PRICE: product.price,
  });
}

export function recipientAddress(email: string): string | null {
  const normalised = normalizeEmail(email);
  if (!normalised || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return null;
  }
  return normalised;
}

/**
 * Published templates expose a single product row (`PRODUCT_*`,
 * `cid:product-image-1`). Map the first confirmed order line. Empty when the
 * order has no items. No CID attachment and no invented image URL.
 */
function productLine(items: OrderConfirmationItem[]): {
  name: string;
  variant: string;
  quantity: string;
  price: string;
} {
  const item = items[0];
  if (!item) {
    return { name: "", variant: "", quantity: "", price: "" };
  }
  return {
    name: item.productName.trim(),
    variant: [item.colourName, item.variantName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" / "),
    quantity: String(item.quantity),
    price: formatGbpMinor(item.unitPriceMinor),
  };
}

function formatEmailDate(value: string | null | undefined): string {
  const iso = value?.trim() ?? "";
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
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
