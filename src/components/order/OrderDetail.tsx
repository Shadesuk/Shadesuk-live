import type { ReactNode } from "react";
import { OrderStatus } from "@/components/order/OrderStatus";
import { TrackingTimeline } from "@/components/order/TrackingTimeline";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type { CustomerShipmentView } from "@/contracts/fulfilment/shipment";
import { TRACKING_UNAVAILABLE_COPY } from "@/contracts/fulfilment/shipment";
import { formatOrderHeading } from "@/contracts/order/dto";
import type { GuestDeliveryAddressView } from "@/contracts/order/dto";
import type { OrderStatus as OrderStatusValue } from "@/contracts/order/schema";
import type { CustomerOrderStatusLabel } from "@/contracts/order/status";
import type { CustomerPaymentState } from "@/contracts/payment/stub";
import { customerPaymentStateLabel } from "@/contracts/payment/stub";
import {
  DELIVERY_LABEL,
  ORDER_CONFIRMED,
  PAYMENT_LABEL,
  PRODUCTS_LABEL,
  QTY_PREFIX,
  SHIPPING_ADDRESS_LABEL,
  TOTAL_LABEL,
  TRACK_ORDER_LINK,
} from "@/lib/account-copy";
import { formatGbp } from "@/lib/money";
import {
  DELIVERY_UPDATE_BODY,
  DELIVERY_UPDATE_TITLE,
  EXPECTED_DELIVERY,
  TRACK_ORDER_HEADING,
  TRACK_WITH_CARRIER,
  TRACKING_NUMBER_LABEL,
  UNITED_KINGDOM,
} from "@/lib/tracking-copy";
import {
  buildTrackingTimeline,
  formatTrackingDateWithYear,
  isExceptionTracking,
  isTrackingUnavailable,
} from "@/lib/tracking-timeline";
import { safeHttpUrl } from "@/lib/tracking-url";
import buttonStyles from "@/components/ui/Button.module.css";
import { cx } from "@/lib/cx";
import styles from "@/components/tracking/Tracking.module.css";

export type OrderDetailItem = {
  id?: string;
  productName: string;
  colourName: string;
  variantName: string | null;
  quantity: number;
  lineTotal?: number;
};

export type OrderDetailModel = {
  orderReference: string;
  status: OrderStatusValue;
  statusLabel: CustomerOrderStatusLabel;
  placedAt: string;
  items: OrderDetailItem[];
  total: number;
  deliveryAddress: GuestDeliveryAddressView | null;
  shipment: CustomerShipmentView | null;
  paymentState?: CustomerPaymentState;
};

type OrderDetailProps = {
  order: OrderDetailModel;
  variant: "account" | "guest";
  trackHref?: string;
  footer?: ReactNode;
};

export function OrderDetail({ order, variant, trackHref, footer }: OrderDetailProps) {
  const placed = formatTrackingDateWithYear(order.placedAt);
  const trackingUrl = safeHttpUrl(order.shipment?.trackingUrl);
  const trackingNumber = order.shipment?.trackingNumber?.trim() || null;
  const exception = isExceptionTracking(order.status, order.shipment);
  const trackingUnavailable = isTrackingUnavailable(order.status, order.shipment);
  const timeline = buildTrackingTimeline({
    status: order.status,
    placedAt: order.placedAt,
    shipment: order.shipment,
  });
  const visibleTimeline = trackingUnavailable
    ? timeline.filter((step) => step.state !== "upcoming")
    : timeline;
  const addressLines = formatDeliveryLines(order.deliveryAddress);

  return (
    <article className={styles.result} data-order-detail data-variant={variant}>
      <header className={styles.resultHeader}>
        {variant === "guest" ? <h1 className="text-h2">{TRACK_ORDER_HEADING}</h1> : null}
        {variant === "guest" ? (
          <p className="text-h3">{formatOrderHeading(order.orderReference)}</p>
        ) : (
          <h1 className="text-h2">{formatOrderHeading(order.orderReference)}</h1>
        )}
        {variant === "account" ? <p className="text-micro">{ORDER_CONFIRMED}</p> : null}
        <OrderStatus label={order.statusLabel} />
        {placed ? <p className="text-small">{placed}</p> : null}
      </header>

      <section className={styles.block} aria-labelledby="order-products-heading">
        <h2 id="order-products-heading" className="text-micro">
          {PRODUCTS_LABEL}
        </h2>
        <ul className={styles.items}>
          {order.items.map((item, index) => {
            const variantLabel = [item.colourName, item.variantName].filter(Boolean).join(" · ");
            return (
              <li key={item.id ?? `${item.productName}-${index}`}>
                <p className="text-body">{item.productName}</p>
                {variantLabel ? <p className="text-small">{variantLabel}</p> : null}
                <p className="text-small">
                  {QTY_PREFIX} {item.quantity}
                </p>
                {typeof item.lineTotal === "number" ? (
                  <p className="text-small">{formatGbp(item.lineTotal)}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.block} aria-labelledby="order-delivery-heading">
        <h2 id="order-delivery-heading" className="text-micro">
          {DELIVERY_LABEL}
        </h2>
        <p className="text-small">{EXPECTED_DELIVERY}</p>
      </section>

      {addressLines.length > 0 ? (
        <section className={styles.block} aria-labelledby="order-address-heading">
          <h2 id="order-address-heading" className="text-micro">
            {SHIPPING_ADDRESS_LABEL}
          </h2>
          <address className={styles.address}>
            {addressLines.map((line) => (
              <span key={line} className={styles.addressLine}>
                {line}
              </span>
            ))}
          </address>
        </section>
      ) : null}

      {order.paymentState ? (
        <section className={styles.block} aria-labelledby="order-payment-heading">
          <h2 id="order-payment-heading" className="text-micro">
            {PAYMENT_LABEL}
          </h2>
          <p className="text-small">{customerPaymentStateLabel(order.paymentState)}</p>
        </section>
      ) : null}

      <p className="text-body">
        {TOTAL_LABEL} {formatGbp(order.total)}
      </p>

      {trackHref ? (
        <ButtonLink href={trackHref} variant="secondary">
          {TRACK_ORDER_LINK}
        </ButtonLink>
      ) : null}

      <section className={styles.tracking} id="track-order" aria-labelledby="order-tracking-heading">
        <h2
          id="order-tracking-heading"
          className={variant === "account" ? "text-h3" : "visually-hidden"}
        >
          {TRACK_ORDER_HEADING}
        </h2>

        {exception ? (
          <div className={styles.notice} aria-labelledby="order-exception-heading">
            <h3 id="order-exception-heading" className="text-micro">
              {DELIVERY_UPDATE_TITLE}
            </h3>
            <p className="text-small">{DELIVERY_UPDATE_BODY}</p>
          </div>
        ) : null}

        {trackingUnavailable ? (
          <div className={styles.notice} aria-labelledby="order-unavailable-heading">
            <h3 id="order-unavailable-heading" className="text-micro">
              {TRACKING_UNAVAILABLE_COPY.heading}
            </h3>
            <p className="text-small">{TRACKING_UNAVAILABLE_COPY.body}</p>
          </div>
        ) : null}

        {visibleTimeline.length > 0 ? <TrackingTimeline steps={visibleTimeline} /> : null}

        {trackingNumber ? (
          <p className="text-small">
            {TRACKING_NUMBER_LABEL}: {trackingNumber}
          </p>
        ) : null}

        {trackingUrl ? (
          <a
            className={cx(buttonStyles.button, buttonStyles.secondary)}
            href={trackingUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span>{TRACK_WITH_CARRIER} →</span>
          </a>
        ) : null}
      </section>

      {footer}
    </article>
  );
}

function formatDeliveryLines(address: GuestDeliveryAddressView | null): string[] {
  if (!address) {
    return [];
  }
  const country =
    !address.country || address.country === "GB" || address.country === "UK"
      ? UNITED_KINGDOM
      : address.country;
  return [
    address.name,
    address.line1,
    address.line2,
    [address.city, address.county].filter(Boolean).join(", ") || null,
    address.postcode,
    country,
  ].filter((line): line is string => Boolean(line));
}
