/**
 * Public `orders.order_reference`.
 *
 * Internal primary key stays the order UUID. Customers, emails, admin lists,
 * and Track Order show this reference only.
 *
 * New orders: 4 decimal digits (`4827`), from cryptographic randomness, unique
 * in `orders.order_reference`, retried on collision.
 *
 * A 4-digit code is guessable. It must never be enough, on its own, to read
 * an order. Guest tracking still requires the checkout email and the existing
 * verification grant.
 *
 * Legacy references (`SHU-` + 12 Crockford characters) stay valid so existing
 * orders can still be looked up. New orders are not issued in that format.
 */

export const ORDER_REFERENCE_PREFIX = "SHU-";
export const ORDER_REFERENCE_BODY_LENGTH = 12;
export const ORDER_REFERENCE_DIGIT_LENGTH = 4;
export const ORDER_REFERENCE_ALLOCATION_ATTEMPTS = 8;
export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const ORDER_REFERENCE_PATTERN = /^[0-9]{4}$/;
export const LEGACY_ORDER_REFERENCE_PATTERN = /^SHU-[0-9A-HJKMNP-TV-Z]{12}$/;

export function createOrderReference(
  randomBytes: (size: number) => Uint8Array = defaultRandomBytes,
): string {
  const bytes = randomBytes(4);
  const a = bytes[0];
  const b = bytes[1];
  const c = bytes[2];
  const d = bytes[3];
  if (a === undefined || b === undefined || c === undefined || d === undefined) {
    throw new Error("Insufficient entropy for order_reference.");
  }
  const value = ((a * 256 + b) * 256 + c) * 256 + d;
  return String(value % 10_000).padStart(ORDER_REFERENCE_DIGIT_LENGTH, "0");
}

/**
 * Pure collision retry. Production inserts use the database unique constraint
 * and the same attempt budget; this helper is the testable form of that loop.
 */
export function takeUniqueOrderReference(
  isTaken: (reference: string) => boolean,
  randomBytes?: (size: number) => Uint8Array,
  maxAttempts = ORDER_REFERENCE_ALLOCATION_ATTEMPTS,
): string | null {
  const limit = Math.max(1, maxAttempts);
  for (let attempt = 0; attempt < limit; attempt += 1) {
    const reference = createOrderReference(randomBytes);
    if (!isTaken(reference)) {
      return reference;
    }
  }
  return null;
}

export function isLegacyOrderReference(value: string | undefined | null): value is string {
  return typeof value === "string" && LEGACY_ORDER_REFERENCE_PATTERN.test(value);
}

export function isOrderReference(value: string | undefined | null): value is string {
  return (
    typeof value === "string" &&
    (ORDER_REFERENCE_PATTERN.test(value) || LEGACY_ORDER_REFERENCE_PATTERN.test(value))
  );
}

export function parseOrderReferenceInput(value: string | undefined | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (ORDER_REFERENCE_PATTERN.test(trimmed)) {
    return trimmed;
  }
  const legacy = trimmed.toUpperCase();
  return isLegacyOrderReference(legacy) ? legacy : null;
}

function defaultRandomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}
