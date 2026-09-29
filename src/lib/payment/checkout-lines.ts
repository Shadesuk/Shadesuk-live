export type CheckoutLineIdentity = {
  variantId: string;
  quantity: number;
};

/**
 * Same bag the quote was built from: variant and quantity only.
 * Price is checked separately so a later price change cannot reuse the attempt.
 */
export function sameCheckoutLines(
  left: readonly CheckoutLineIdentity[],
  right: readonly CheckoutLineIdentity[],
): boolean {
  return lineKey(left) === lineKey(right);
}

function lineKey(lines: readonly CheckoutLineIdentity[]): string {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.variantId || !Number.isInteger(line.quantity) || line.quantity < 1) {
      return "";
    }
    totals.set(line.variantId, (totals.get(line.variantId) ?? 0) + line.quantity);
  }
  return [...totals.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([variantId, quantity]) => `${variantId}:${quantity}`)
    .join("|");
}
