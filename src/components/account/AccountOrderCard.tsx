import Link from "next/link";
import { OrderStatus } from "@/components/order/OrderStatus";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { formatOrderHeading, type CustomerOrderListItem } from "@/contracts";
import { QTY_PREFIX, VIEW_ORDER } from "@/lib/account-copy";
import { formatGbp } from "@/lib/money";
import { accountOrderPath } from "@/lib/navigation";
import { formatTrackingDateWithYear } from "@/lib/tracking-timeline";
import styles from "./Account.module.css";

export function AccountOrderCard({ order }: { order: CustomerOrderListItem }) {
  const href = accountOrderPath(order.orderReference);
  const variant = [order.colourName, order.variantName].filter(Boolean).join(" · ");
  const dateLabel = formatTrackingDateWithYear(order.placedAt);

  return (
    <article className={styles.card}>
      <h2 className="text-micro">
        <Link className={styles.cardLink} href={href}>
          {formatOrderHeading(order.orderReference)}
        </Link>
      </h2>
      {dateLabel ? <p className="text-small">{dateLabel}</p> : null}
      {order.productName ? <p className="text-body">{order.productName}</p> : null}
      {variant ? <p className="text-small">{variant}</p> : null}
      {order.quantity > 0 ? (
        <p className="text-small">
          {QTY_PREFIX} {order.quantity}
        </p>
      ) : null}
      <p className="text-body">{formatGbp(order.total)}</p>
      <OrderStatus label={order.statusLabel} />
      <div className={styles.cardActions}>
        <ButtonLink href={href} variant="tertiary">
          {VIEW_ORDER}
        </ButtonLink>
      </div>
    </article>
  );
}
