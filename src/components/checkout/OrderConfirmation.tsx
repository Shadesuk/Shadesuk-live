import { ButtonLink } from "@/components/ui/ButtonLink";
import { PinPageStart } from "@/lib/page-scroll";
import { ErrorState } from "@/components/ui/ErrorState";
import { OrderConfirmationPurchase } from "@/components/checkout/OrderConfirmationPurchase";
import {
  AMOUNT_PAID_LABEL,
  ESTIMATED_DELIVERY_LABEL,
  ESTIMATED_DELIVERY_WINDOW,
  ORDER_CONFIRMATION_BODY,
  ORDER_CONFIRMATION_EMAIL_LABEL,
  ORDER_CONFIRMATION_NEXT,
  ORDER_CONFIRMATION_TITLE,
  ORDER_CONFIRMATION_UNPAID_BODY,
  ORDER_CONFIRMATION_UNPAID_TITLE,
  ORDER_SUMMARY_HEADING,
  SHIPPING_LABEL,
  UK_STANDARD_DELIVERY,
} from "@/lib/checkout-copy";
import { formatGbp, formatGbpMinor } from "@/lib/money";
import { formatOrderHeading } from "@/contracts/order/dto";
import { routes } from "@/lib/navigation";
import type { CheckoutConfirmationView } from "@/services/checkout-confirmation";
import styles from "./CheckoutReview.module.css";

type OrderConfirmationProps = {
  order?: CheckoutConfirmationView;
};

export function OrderConfirmation({ order }: OrderConfirmationProps) {
  if (!order) {
    return (
      <>
      <PinPageStart focusId="order-confirmation-heading" />
      <ErrorState
        title={ORDER_CONFIRMATION_UNPAID_TITLE}
        description={ORDER_CONFIRMATION_UNPAID_BODY}
        titleAs="h1"
        titleId="order-confirmation-heading"
        actions={
          <ButtonLink href={routes.trackOrder} variant="secondary">
            {ORDER_CONFIRMATION_NEXT}
          </ButtonLink>
        }
      />
      </>
    );
  }

  return (
    <div className={styles.review} data-order-confirmation>
      <PinPageStart focusId="order-confirmation-heading" />
      <OrderConfirmationPurchase orderReference={order.orderReference} total={order.total} />
      <section className={styles.block} aria-labelledby="order-confirmation-heading">
        <h1 id="order-confirmation-heading" tabIndex={-1} className="text-h3">
          {ORDER_CONFIRMATION_TITLE}
        </h1>
        <p className="text-small">{ORDER_CONFIRMATION_BODY}</p>
        <p className="text-small">{formatOrderHeading(order.orderReference)}</p>
        <p className="text-micro">{ORDER_CONFIRMATION_EMAIL_LABEL}</p>
        <p className="text-small">{order.customerEmail}</p>
      </section>

      <section className={styles.block} aria-labelledby="order-confirmation-summary">
        <h2 id="order-confirmation-summary" className="text-micro">
          {ORDER_SUMMARY_HEADING}
        </h2>
        <ul className={styles.items}>
          {order.items.map((item) => {
            const variant = [item.colourName, item.variantName].filter(Boolean).join(" · ");
            return (
              <li key={`${item.productName}-${item.colourName}-${item.quantity}`} className={styles.itemPlain}>
                <div className={styles.details}>
                  <p className="text-small">{item.productName}</p>
                  {variant ? <p className="text-micro">{variant}</p> : null}
                  <p className="text-small">Qty {item.quantity}</p>
                  <p className="text-small">{formatGbp(item.lineTotal)}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-micro">{SHIPPING_LABEL}</p>
        <p className="text-small">{UK_STANDARD_DELIVERY}</p>
        <p className="text-small">{formatGbpMinor(order.shippingMinor)}</p>
        <p className="text-micro">{AMOUNT_PAID_LABEL}</p>
        <p className="text-small">{formatGbp(order.total)}</p>
        <p className="text-micro">{ESTIMATED_DELIVERY_LABEL}</p>
        <p className="text-small">{ESTIMATED_DELIVERY_WINDOW}</p>
      </section>

      <div className={styles.actions}>
        <ButtonLink href={routes.trackOrder} variant="secondary">
          {ORDER_CONFIRMATION_NEXT}
        </ButtonLink>
      </div>
    </div>
  );
}
