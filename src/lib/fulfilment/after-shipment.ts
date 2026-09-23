import "server-only";

import { dispatchShipmentConfirmationEmail } from "@/lib/email/shipment-confirmation";

/**
 * Post-commit side effect after a shipment confirmation has been saved.
 *
 * Invoke only after `dispatchAdminOrder` or `saveAdminFulfilment` has
 * committed. The dispatcher skips pending and exception shipments, and
 * duplicate calls resolve to the existing email_events row.
 *
 * Email failures are swallowed here and must never roll back the shipment
 * or the order.
 */
export async function onShipmentConfirmed(orderId: string): Promise<void> {
  try {
    await dispatchShipmentConfirmationEmail(orderId);
  } catch {
    // The shipment write has already committed.
  }
}
