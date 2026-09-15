import { OrderStatus } from "@/components/order/OrderStatus";
import { TrackingTimeline } from "@/components/order/TrackingTimeline";
import { Button } from "@/components/ui/Button";
import { formatOrderHeading, type GuestOrderTrackingView } from "@/contracts/order/dto";
import { TRACKING_UNAVAILABLE_COPY } from "@/contracts/fulfilment/shipment";
import { formatGbp } from "@/lib/money";
import {
  DELIVERY_ADDRESS_LABEL,
  DELIVERY_UPDATE_BODY,
  DELIVERY_UPDATE_TITLE,
  EXPECTED_DELIVERY,
  EXPECTED_DELIVERY_LABEL,
  TRACK_ANOTHER_ORDER,
  TRACK_ORDER_HEADING,
  TRACK_WITH_CARRIER,
  TRACKING_NUMBER_LABEL,
  UNITED_KINGDOM,
} from "@/lib/tracking-copy";
import { buildTrackingTimeline, formatTrackingDateWithYear } from "@/lib/tracking-timeline";
import { safeHttpUrl } from "@/lib/tracking-url";
import buttonStyles from "@/components/ui/Button.module.css";
import { cx } from "@/lib/cx";
import styles from "./Tracking.module.css";

type TrackOrderResultProps = {
  order: GuestOrderTrackingView;
  onTrackAnother: () => void;
};

export function TrackOrderResult({ order, onTrackAnother }: TrackOrderResultProps) {
  const timeline = buildTrackingTimeline({
    status: order.status,
    placedAt: order.placedAt,
    shipment: order.shipment,
  });
  const placed = formatTrackingDateWithYear(order.placedAt);
  const trackingUrl = safeHttpUrl(order.shipment?.trackingUrl);
  const trackingNumber = order.shipment?.trackingNumber?.trim() || null;
  const addressLines = formatDeliveryLines(order);
  const trackingUnavailable =
    order.status === "tracking_unavailable" ||
    order.shipment?.status === "tracking_unavailable" ||
    ((order.status === "placed" ||
      order.status === "processing" ||
      order.shipment?.status === "pending") &&
      !trackingUrl &&
      !trackingNumber);

  return (
    <article className={styles.result} data-track-order-result>
      <header className={styles.resultHeader}>
        <h1 className="text-h2">{TRACK_ORDER_HEADING}</h1>
        <p className="text-h3">{formatOrderHeading(order.orderReference)}</p>
        <OrderStatus label={order.statusLabel} />
        {placed ? <p className="text-small">{placed}</p> : null}
      </header>

      <ul className={styles.items}>
        {order.items.map((item, index) => {
          const variant = [item.colourName, item.variantName].filter(Boolean).join(" · ");
          return (
            <li key={`${item.productName}-${index}`}>
              <p className="text-small">{item.productName}</p>
              {variant ? <p className="text-micro">{variant}</p> : null}
              <p className="text-small">Qty {item.quantity}</p>
            </li>
          );
        })}
      </ul>

      {order.status === "exception" || order.shipment?.status === "exception" ? (
        <section className={styles.notice} aria-labelledby="track-order-exception">
          <h2 id="track-order-exception" className="text-micro">
            {DELIVERY_UPDATE_TITLE}
          </h2>
          <p className="text-small">{DELIVERY_UPDATE_BODY}</p>
        </section>
      ) : null}

      {trackingUnavailable && order.status !== "exception" ? (
        <section className={styles.notice} aria-labelledby="track-order-unavailable">
          <h2 id="track-order-unavailable" className="text-micro">
            {TRACKING_UNAVAILABLE_COPY.heading}
          </h2>
          <p className="text-small">{TRACKING_UNAVAILABLE_COPY.body}</p>
        </section>
      ) : null}

      <TrackingTimeline steps={timeline} />

      {addressLines.length > 0 ? (
        <section className={styles.block} aria-labelledby="track-order-address">
          <h2 id="track-order-address" className="text-micro">
            {DELIVERY_ADDRESS_LABEL}
          </h2>
          {addressLines.map((line) => (
            <p key={line} className="text-small">
              {line}
            </p>
          ))}
        </section>
      ) : null}

      <section className={styles.block} aria-labelledby="track-order-expected">
        <h2 id="track-order-expected" className="text-micro">
          {EXPECTED_DELIVERY_LABEL}
        </h2>
        <p className="text-small">{EXPECTED_DELIVERY}</p>
      </section>

      <p className="text-small">
        Total {formatGbp(order.total)}
      </p>

      {trackingNumber ? (
        <p className="text-small">
          {TRACKING_NUMBER_LABEL}: {trackingNumber}
        </p>
      ) : null}

      <div className={styles.actions}>
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
        <Button type="button" variant="tertiary" onClick={onTrackAnother}>
          {TRACK_ANOTHER_ORDER}
        </Button>
      </div>
    </article>
  );
}

function formatDeliveryLines(order: GuestOrderTrackingView): string[] {
  const address = order.deliveryAddress;
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
