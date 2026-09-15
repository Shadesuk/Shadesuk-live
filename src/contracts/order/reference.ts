/**
 * Non-guessable customer-facing `orders.order_reference` (PR #10 unique text).
 *
 * Locked UI mock `ORDER #SHU10294` is sequential and must not be the generator.
 * Display remains `ORDER #{order_reference}`.
 *
 * Format: `SHU-` + 12 Crockford base32 characters (60 bits of randomness).
 * Not derived from UUID, SKU, payment ids, or a sequence.
 */

export const ORDER_REFERENCE_PREFIX = "SHU-";
export const ORDER_REFERENCE_BODY_LENGTH = 12;
export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const ORDER_REFERENCE_PATTERN = /^SHU-[0-9A-HJKMNP-TV-Z]{12}$/;

export function createOrderReference(
  randomBytes: (size: number) => Uint8Array = defaultRandomBytes,
): string {
  const chars: string[] = [];
  const bytes = randomBytes(ORDER_REFERENCE_BODY_LENGTH);
  for (let index = 0; index < ORDER_REFERENCE_BODY_LENGTH; index += 1) {
    const byte = bytes[index];
    if (byte === undefined) {
      throw new Error("Insufficient entropy for order_reference.");
    }
    chars.push(CROCKFORD_ALPHABET[byte % CROCKFORD_ALPHABET.length]!);
  }
  return `${ORDER_REFERENCE_PREFIX}${chars.join("")}`;
}

export function isOrderReference(value: string | undefined | null): value is string {
  return typeof value === "string" && ORDER_REFERENCE_PATTERN.test(value);
}

export function parseOrderReferenceInput(value: string | undefined | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalised = value.trim().toUpperCase();
  return isOrderReference(normalised) ? normalised : null;
}

function defaultRandomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}
