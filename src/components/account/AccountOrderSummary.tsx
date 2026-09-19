import { OrderStatus } from "@/components/order/OrderStatus";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { formatOrderHeading, type CustomerOrderView } from "@/contracts";
import {
  DELIVERY_ADDRESS_LABEL,
  QTY_PREFIX,
  TOTAL_LABEL,
  TRACK_ORDER_LINK,
} from "@/lib/account-copy";
import { formatGbp } from "@/lib/money";
import { routes } from "@/lib/navigation";
import { formatTrackingDateWithYear } from "@/lib/tracking-timeline";
import styles from "./Account.module.css";

export function AccountOrderSummary({ order }: { order: CustomerOrderView }) {
  const dateLabel = formatTrackingDateWithYear(order.placedAt);
  const address = order.deliveryAddress;

  return (
    <div className={styles.form}>
      <h1 className="text-h2">{formatOrderHeading(order.orderReference)}</h1>
      <OrderStatus label={order.statusLabel} />
      {dateLabel ? <p className="text-small">{dateLabel}</p> : null}
      <ul className={styles.itemList}>
        {order.items.map((item) => {
          const variant = [item.colourName, item.variantName].filter(Boolean).join(" · ");
          return (
            <li key={item.id} className={styles.item}>
              <p className="text-body">{item.productName}</p>
              {variant ? <p className="text-small">{variant}</p> : null}
              <p className="text-small">
                {QTY_PREFIX} {item.quantity}
              </p>
              <p className="text-small">{formatGbp(item.lineTotal)}</p>
            </li>
          );
        })}
      </ul>
      {address ? (
        <div>
          <h2 className="text-micro">{DELIVERY_ADDRESS_LABEL}</h2>
          <p className="text-body">
            {address.name ? (
              <>
                {address.name}
                <br />
              </>
            ) : null}
            {address.line1}
            {address.line2 ? (
              <>
                <br />
                {address.line2}
              </>
            ) : null}
            <br />
            {[address.city, address.postcode].filter(Boolean).join(" ")}
          </p>
        </div>
      ) : null}
      <p className="text-body">
        {TOTAL_LABEL} {formatGbp(order.total)}
      </p>
      <ButtonLink href={routes.trackOrder} variant="secondary">
        {TRACK_ORDER_LINK}
      </ButtonLink>
    </div>
  );
}
