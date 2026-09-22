export const SHIPMENT_STATUSES = [
  "pending",
  "dispatched",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
  "tracking_unavailable",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/** Customer-facing labels. Matches the admin fulfilment labels. */
export const SHIPMENT_STATUS_LABELS = {
  pending: "Pending",
  dispatched: "Dispatched",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  exception: "Exception",
  tracking_unavailable: "Tracking unavailable",
} as const satisfies Record<ShipmentStatus, string>;

/**
 * A real dispatch/shipment confirmation. Pending and exception are not
 * confirmation events and must not send the shipment email.
 */
const SHIPMENT_CONFIRMATION_STATUSES = new Set<ShipmentStatus>([
  "dispatched",
  "tracking_unavailable",
  "in_transit",
  "out_for_delivery",
  "delivered",
]);

export function isShipmentConfirmationStatus(status: ShipmentStatus): boolean {
  return SHIPMENT_CONFIRMATION_STATUSES.has(status);
}

export type ShipmentRow = {
  id: string;
  order_id: string;
  carrier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: ShipmentStatus;
  shipped_at: string | null;
  delivered_at: string | null;
  /** Internal. Not selectable by client roles. Never put on GuestOrderTrackingView. */
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TrackingEventRow = {
  id: string;
  shipment_id: string;
  status: ShipmentStatus;
  description: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
};

/**
 * Customer-safe shipment projection. V1 is manual: an operator pastes
 * carrier / AWB / URL. No supplier API, no carrier API, no label purchase.
 */
export type CustomerShipmentView = {
  status: ShipmentStatus;
  carrierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  events: Array<{
    status: ShipmentStatus;
    description: string | null;
    occurredAt: string;
  }>;
};

export const TRACKING_UNAVAILABLE_COPY = {
  heading: "TRACKING NOT AVAILABLE YET",
  body: "Your order has been received. Tracking information will appear once your shipment has been dispatched.",
} as const;

export function toCustomerShipmentView(
  shipment: ShipmentRow,
  events: TrackingEventRow[],
): CustomerShipmentView {
  return {
    status: shipment.status,
    carrierName: shipment.carrier_name,
    trackingNumber: shipment.tracking_number,
    trackingUrl: shipment.tracking_url,
    shippedAt: shipment.shipped_at,
    deliveredAt: shipment.delivered_at,
    events: [...events]
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
      .map((event) => ({
        status: event.status,
        description: event.description,
        occurredAt: event.occurred_at,
      })),
  };
}

export function isManualFulfilmentV1(): true {
  return true;
}
