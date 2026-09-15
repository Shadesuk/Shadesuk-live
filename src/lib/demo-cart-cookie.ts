import { createHmac } from "node:crypto";
import { ADD_TO_BAG_QUANTITY_MAX } from "@/lib/add-to-bag";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";

export const DEMO_CART_LINES_COOKIE = "shadesuk_guest_cart_lines";

export type DemoCartLine = {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  colourId: string;
  quantity: number;
  unitPriceMinor: number;
  size?: string;
};

export function encodeDemoCartCookie(sessionId: string, items: DemoCartLine[]): string {
  const body = JSON.stringify({ items: items.map(sanitizeLine) });
  const hmac = sign(sessionId, body);
  return `v1.${Buffer.from(body, "utf8").toString("base64url")}.${hmac}`;
}

export function decodeDemoCartCookie(
  sessionId: string,
  value: string | undefined | null,
): DemoCartLine[] {
  if (!value) {
    return [];
  }
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return [];
  }
  const [, encoded, hmac] = parts;
  if (!encoded || !hmac) {
    return [];
  }
  let body: string;
  try {
    body = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return [];
  }
  if (!safeEqual(hmac, sign(sessionId, body))) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(body);
    return parseDemoItems(parsed);
  } catch {
    return [];
  }
}

function parseDemoItems(raw: unknown): DemoCartLine[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  if (hasForbiddenOwnershipKey(raw)) {
    return [];
  }
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return [];
  }
  const parsed: DemoCartLine[] = [];
  for (const item of items) {
    const line = parseLine(item);
    if (line) {
      parsed.push(line);
    }
  }
  return parsed;
}

function parseLine(raw: unknown): DemoCartLine | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  if (hasForbiddenOwnershipKey(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = asNonEmpty(record.id);
  const variantId = asNonEmpty(record.variantId);
  const productId = asNonEmpty(record.productId);
  const slug = asNonEmpty(record.slug);
  const colourId = asNonEmpty(record.colourId);
  const quantity = asPositiveInt(record.quantity);
  const unitPriceMinor = asNonNegativeInt(record.unitPriceMinor);
  if (!id || !variantId || !productId || !slug || !colourId || !quantity || unitPriceMinor == null) {
    return null;
  }
  const size = typeof record.size === "string" && record.size.trim() ? record.size.trim() : undefined;
  const line: DemoCartLine = {
    id,
    variantId,
    productId,
    slug,
    colourId,
    quantity: Math.min(quantity, ADD_TO_BAG_QUANTITY_MAX),
    unitPriceMinor,
  };
  if (size) {
    line.size = size;
  }
  return line;
}

function sanitizeLine(line: DemoCartLine): DemoCartLine {
  const next: DemoCartLine = {
    id: line.id,
    variantId: line.variantId,
    productId: line.productId,
    slug: line.slug,
    colourId: line.colourId,
    quantity: line.quantity,
    unitPriceMinor: line.unitPriceMinor,
  };
  if (line.size) {
    next.size = line.size;
  }
  return next;
}

function sign(sessionId: string, body: string): string {
  return createHmac("sha256", sessionId).update(body).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function asNonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return null;
  }
  return value;
}

function asNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}
