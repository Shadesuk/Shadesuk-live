export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export const DEMO_VARIANT_PREFIX = "demo:";

export function demoVariantId(
  productId: string,
  colourId: string,
  size?: string,
): string {
  return `${DEMO_VARIANT_PREFIX}${productId}:${colourId}:${size ?? ""}`;
}

export function isDemoVariantId(value: string): boolean {
  return value.startsWith(DEMO_VARIANT_PREFIX);
}
