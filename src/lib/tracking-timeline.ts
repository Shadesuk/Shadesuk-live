import {
  CUSTOMER_ORDER_STATUS_LABELS,
  CUSTOMER_TRACKING_STEPS,
  type CustomerTrackingStep,
} from "@/contracts/order/status";
import type { CustomerShipmentView } from "@/contracts/fulfilment/shipment";
import type { OrderStatus } from "@/contracts/order/schema";

export type TimelineStepState = "done" | "current" | "upcoming" | "exception";

export type TrackingTimelineStep = {
  status: CustomerTrackingStep;
  label: string;
  state: TimelineStepState;
  dateLabel: string | null;
  description: string | null;
};

export function buildTrackingTimeline(input: {
  status: OrderStatus;
  placedAt: string;
  shipment: CustomerShipmentView | null;
}): TrackingTimelineStep[] {
  const currentIndex = currentStepIndex(input.status, input.shipment);
  const dates = datesFromShipment(input.shipment);
  dates.placed = dates.placed ?? formatTrackingDate(input.placedAt) ?? undefined;

  const exception = isExceptionTracking(input.status, input.shipment);

  return CUSTOMER_TRACKING_STEPS.map((status, index) => {
    let state: TimelineStepState = "upcoming";
    if (currentIndex < 0) {
      state = index === 0 ? (exception ? "exception" : "current") : "upcoming";
    } else if (index < currentIndex) {
      state = "done";
    } else if (index === currentIndex) {
      state = exception ? "exception" : "current";
    }
    return {
      status,
      label: CUSTOMER_ORDER_STATUS_LABELS[status],
      state,
      dateLabel: dates[status] ?? null,
      description: descriptionForStep(status, input.shipment),
    };
  });
}

export function isExceptionTracking(
  status: OrderStatus,
  shipment: CustomerShipmentView | null,
): boolean {
  return status === "exception" || shipment?.status === "exception";
}

export function isNoShipmentYet(shipment: CustomerShipmentView | null): boolean {
  return shipment == null;
}

export function isTrackingUnavailable(
  status: OrderStatus,
  shipment: CustomerShipmentView | null,
): boolean {
  if (isExceptionTracking(status, shipment) || !shipment) {
    return false;
  }
  if (status === "tracking_unavailable" || shipment.status === "tracking_unavailable") {
    return true;
  }
  if (
    status === "dispatched" ||
    status === "in_transit" ||
    status === "out_for_delivery" ||
    status === "delivered" ||
    shipment.status === "dispatched" ||
    shipment.status === "in_transit" ||
    shipment.status === "out_for_delivery" ||
    shipment.status === "delivered"
  ) {
    return false;
  }
  const hasTracking = Boolean(shipment.trackingNumber?.trim() || shipment.trackingUrl);
  return !hasTracking;
}

export function timelineStateLabel(state: TimelineStepState): string {
  if (state === "done") {
    return "Completed";
  }
  if (state === "current") {
    return "Current";
  }
  if (state === "exception") {
    return "Exception";
  }
  return "Upcoming";
}

export function formatTrackingDate(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/London",
  })
    .format(date)
    .toUpperCase();
}

export function formatTrackingDateWithYear(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  })
    .format(date)
    .toUpperCase();
}

function currentStepIndex(
  status: OrderStatus,
  shipment: CustomerShipmentView | null,
): number {
  const unavailable =
    status === "tracking_unavailable" || shipment?.status === "tracking_unavailable";
  const exception = status === "exception" || shipment?.status === "exception";
  if (exception || unavailable) {
    const fromEvents = latestMainStepFromShipment(shipment);
    if (fromEvents) {
      return CUSTOMER_TRACKING_STEPS.indexOf(fromEvents);
    }
    return unavailable ? 0 : 1;
  }

  const orderIndex = isMainStep(status) ? CUSTOMER_TRACKING_STEPS.indexOf(status) : -1;
  const shipmentIndex =
    shipment && isMainStep(shipment.status) ? CUSTOMER_TRACKING_STEPS.indexOf(shipment.status) : -1;
  return Math.max(orderIndex, shipmentIndex);
}

function latestMainStepFromShipment(
  shipment: CustomerShipmentView | null,
): CustomerTrackingStep | null {
  if (!shipment) {
    return null;
  }
  const fromEvents = [...shipment.events]
    .reverse()
    .find((event) => isMainStep(event.status));
  if (fromEvents && isMainStep(fromEvents.status)) {
    return fromEvents.status;
  }
  if (isMainStep(shipment.status)) {
    return shipment.status;
  }
  return null;
}

function isMainStep(status: string): status is CustomerTrackingStep {
  return (CUSTOMER_TRACKING_STEPS as readonly string[]).includes(status);
}

function datesFromShipment(
  shipment: CustomerShipmentView | null,
): Partial<Record<CustomerTrackingStep, string>> {
  const dates: Partial<Record<CustomerTrackingStep, string>> = {};
  if (!shipment) {
    return dates;
  }
  for (const event of shipment.events) {
    if (isMainStep(event.status)) {
      const label = formatTrackingDate(event.occurredAt);
      if (label) {
        dates[event.status] = label;
      }
    }
  }
  if (shipment.shippedAt && !dates.dispatched) {
    dates.dispatched = formatTrackingDate(shipment.shippedAt) ?? undefined;
  }
  if (shipment.deliveredAt && !dates.delivered) {
    dates.delivered = formatTrackingDate(shipment.deliveredAt) ?? undefined;
  }
  return dates;
}

function descriptionForStep(
  status: CustomerTrackingStep,
  shipment: CustomerShipmentView | null,
): string | null {
  const event = shipment?.events.find((entry) => entry.status === status);
  const description = event?.description?.trim();
  return description ? description.slice(0, 240) : null;
}
