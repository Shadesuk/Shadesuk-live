import {
  adminOrderStatusLabel,
  adminPaymentStatusLabel,
} from "@/contracts/admin/dashboard";
import { isCommittedPurchase } from "@/contracts/order/lifecycle";
import { isAwaitingFulfilment } from "@/contracts/fulfilment/dispatch";
import {
  adminOrderCustomerLabel,
  adminShipmentStatusLabel,
  reportedAdminOrderStatusLabel,
  type AdminOrderDetailView,
} from "@/contracts/admin/orders";
import { formatOrderHeading } from "@/contracts/order/dto";
import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_ORDER_BACK,
  ADMIN_ORDER_CHECKOUT_NOT_COMPLETED,
  ADMIN_ORDERS_AWAITING_FULFILMENT,
  ADMIN_ORDER_CARRIER,
  ADMIN_ORDER_COL_DATE,
  ADMIN_ORDER_COL_PAYMENT,
  ADMIN_ORDER_COL_STATUS,
  ADMIN_ORDER_CUSTOMER,
  ADMIN_ORDER_DELIVERY,
  ADMIN_ORDER_EMAIL,
  ADMIN_ORDER_FULFILMENT,
  ADMIN_ORDER_GUEST,
  ADMIN_ORDER_HISTORY,
  ADMIN_ORDER_HISTORY_EMPTY_BODY,
  ADMIN_ORDER_HISTORY_EMPTY_TITLE,
  ADMIN_ORDER_ITEM_LINE,
  ADMIN_ORDER_ITEM_PRODUCT,
  ADMIN_ORDER_ITEM_QTY,
  ADMIN_ORDER_ITEM_UNIT,
  ADMIN_ORDER_ITEM_VARIANT,
  ADMIN_ORDER_ITEMS,
  ADMIN_ORDER_NO_FULFILMENT_BODY,
  ADMIN_ORDER_NO_FULFILMENT_TITLE,
  ADMIN_ORDER_SHIPMENT_STATUS,
  ADMIN_ORDER_SHIPPING,
  ADMIN_ORDER_SUBTOTAL,
  ADMIN_ORDER_TOTAL,
  ADMIN_ORDER_TOTALS,
  ADMIN_ORDER_TRACKING_EVENTS,
  ADMIN_ORDER_TRACKING_EVENTS_EMPTY,
  ADMIN_ORDER_TRACKING_NUMBER,
  ADMIN_ORDER_TRACKING_URL,
} from "@/lib/admin-copy";
import { formatAdminDateTime } from "@/lib/admin-format";
import { formatGbpMinor } from "@/lib/money";
import { routes } from "@/lib/navigation";
import { safeHttpUrl } from "@/lib/tracking-url";
import { loadAdminOrderDetail } from "@/services/admin-orders";
import { AdminFulfilmentForm, AdminOrderStatusForm } from "./AdminOrderForms";
import { AdminOrderNotFound } from "./AdminOrderNotFound";
import { AdminPageHeader } from "./AdminPageHeader";
import { AdminOrdersUnavailable } from "./AdminOrdersUnavailable";
import styles from "./AdminOrders.module.css";

export async function AdminOrderDetailSection({ id }: { id: string }) {
  const result = await loadAdminOrderDetail(id);
  if (result.status === "not_found") {
    return <AdminOrderNotFound />;
  }
  if (result.status !== "ok") {
    return <AdminOrdersUnavailable />;
  }
  return <AdminOrderDetail order={result.data} />;
}

export function AdminOrderDetail({ order }: { order: AdminOrderDetailView }) {
  const variantLabel = (colour: string, variant: string | null) =>
    [colour, variant].filter(Boolean).join(" · ");
  const trackingUrl = safeHttpUrl(order.shipment?.trackingUrl);
  const provisional = !isCommittedPurchase(order.paymentStatus);

  return (
    <div data-admin-order-detail data-order-id={order.id}>
      <AdminPageHeader
        kicker="Orders"
        title={formatOrderHeading(order.orderReference)}
        description={`${formatAdminDateTime(order.createdAt)} · ${reportedAdminOrderStatusLabel(order.orderStatus, order.paymentStatus)} · ${adminPaymentStatusLabel(order.paymentStatus)}`}
        action={
          <ButtonLink href={routes.adminOrders} variant="tertiary">
            {ADMIN_ORDER_BACK}
          </ButtonLink>
        }
      />
      {provisional ? (
        <p className="text-small" role="status">
          {ADMIN_ORDER_CHECKOUT_NOT_COMPLETED}
        </p>
      ) : null}
      <div className={styles.detailGrid}>
        <div className={styles.stack}>
          <section className={styles.section} aria-labelledby="order-customer-heading">
            <h2 id="order-customer-heading" className={styles.sectionTitle}>
              {ADMIN_ORDER_CUSTOMER}
            </h2>
            <dl className={styles.dl}>
              <div>
                <dt>{ADMIN_ORDER_CUSTOMER}</dt>
                <dd className="text-body">
                  {adminOrderCustomerLabel(order.customerName, order.guest, ADMIN_ORDER_GUEST)}
                </dd>
              </div>
              <div>
                <dt>{ADMIN_ORDER_EMAIL}</dt>
                <dd className="text-body">{order.customerEmail || "—"}</dd>
              </div>
            </dl>
          </section>
          <section className={styles.section} aria-labelledby="order-delivery-heading">
            <h2 id="order-delivery-heading" className={styles.sectionTitle}>
              {ADMIN_ORDER_DELIVERY}
            </h2>
            {order.delivery ? (
              <address className="text-body">
                {[
                  order.delivery.name,
                  order.delivery.line1,
                  order.delivery.line2,
                  [order.delivery.city, order.delivery.county].filter(Boolean).join(", "),
                  order.delivery.postcode,
                  order.delivery.country,
                ]
                  .filter(Boolean)
                  .map((line, index) => (
                    <span key={`${index}-${line}`} className={styles.addressLine}>
                      {line}
                    </span>
                  ))}
              </address>
            ) : (
              <p className={`text-small ${styles.quietBody}`}>—</p>
            )}
          </section>
          <section className={styles.section} aria-labelledby="order-items-heading">
            <h2 id="order-items-heading" className={styles.sectionTitle}>
              {ADMIN_ORDER_ITEMS}
            </h2>
            <div className={styles.itemsHead} aria-hidden="true">
              <span>{ADMIN_ORDER_ITEM_PRODUCT}</span>
              <span>{ADMIN_ORDER_ITEM_VARIANT}</span>
              <span>{ADMIN_ORDER_ITEM_QTY}</span>
              <span>{ADMIN_ORDER_ITEM_UNIT}</span>
              <span>{ADMIN_ORDER_ITEM_LINE}</span>
            </div>
            <ul className={styles.items}>
              {order.items.map((item) => (
                <li key={item.id} className={styles.item}>
                  <p className="text-small">
                    <span className="visually-hidden">{ADMIN_ORDER_ITEM_PRODUCT} </span>
                    {item.productName}
                  </p>
                  <p className="text-small">
                    <span className="visually-hidden">{ADMIN_ORDER_ITEM_VARIANT} </span>
                    {variantLabel(item.colourName, item.variantName)}
                  </p>
                  <p className={`text-small ${styles.itemQty}`}>
                    <span className="visually-hidden">{ADMIN_ORDER_ITEM_QTY} </span>
                    {item.quantity}
                  </p>
                  <p className={`text-small ${styles.amount}`}>
                    <span className="visually-hidden">{ADMIN_ORDER_ITEM_UNIT} </span>
                    {formatGbpMinor(item.unitPriceMinor)}
                  </p>
                  <p className={`text-small ${styles.amount}`}>
                    <span className="visually-hidden">{ADMIN_ORDER_ITEM_LINE} </span>
                    {formatGbpMinor(item.lineTotalMinor)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <section className={styles.section} aria-labelledby="order-totals-heading">
            <h2 id="order-totals-heading" className={styles.sectionTitle}>
              {ADMIN_ORDER_TOTALS}
            </h2>
            <dl className={styles.totals}>
              <div>
                <dt className="text-small">{ADMIN_ORDER_SUBTOTAL}</dt>
                <dd className={`text-small ${styles.amount}`}>{formatGbpMinor(order.subtotalMinor)}</dd>
              </div>
              <div>
                <dt className="text-small">{ADMIN_ORDER_SHIPPING}</dt>
                <dd className={`text-small ${styles.amount}`}>{formatGbpMinor(order.shippingMinor)}</dd>
              </div>
              <div>
                <dt className="text-small">{ADMIN_ORDER_TOTAL}</dt>
                <dd className={`text-small ${styles.amount}`}>{formatGbpMinor(order.totalMinor)}</dd>
              </div>
            </dl>
          </section>
          <section className={styles.section} aria-labelledby="order-history-heading">
            <h2 id="order-history-heading" className={styles.sectionTitle}>
              {ADMIN_ORDER_HISTORY}
            </h2>
            {order.events.length === 0 ? (
              <div className={styles.quiet}>
                <p className={`text-micro ${styles.quietTitle}`}>{ADMIN_ORDER_HISTORY_EMPTY_TITLE}</p>
                <p className={`text-small ${styles.quietBody}`}>{ADMIN_ORDER_HISTORY_EMPTY_BODY}</p>
              </div>
            ) : (
              <ol className={styles.timeline}>
                {order.events.map((event) => (
                  <li key={event.id} className={styles.event}>
                    <p className="text-small">{event.label}</p>
                    {event.oldStatus && event.newStatus ? (
                      <p className="text-small">
                        {adminOrderStatusLabel(event.oldStatus)} → {adminOrderStatusLabel(event.newStatus)}
                      </p>
                    ) : null}
                    <time className="text-small" dateTime={event.createdAt}>
                      {formatAdminDateTime(event.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <div className={styles.stack}>
          <section className={styles.section} aria-labelledby="order-status-heading">
            <h2 id="order-status-heading" className={styles.sectionTitle}>
              {ADMIN_ORDER_COL_STATUS}
            </h2>
            <dl className={styles.dl}>
              <div>
                <dt>{ADMIN_ORDER_COL_DATE}</dt>
                <dd className="text-body">{formatAdminDateTime(order.createdAt)}</dd>
              </div>
              <div>
                <dt>{ADMIN_ORDER_COL_STATUS}</dt>
                <dd className="text-body">
                  {reportedAdminOrderStatusLabel(order.orderStatus, order.paymentStatus)}
                </dd>
              </div>
              <div>
                <dt>{ADMIN_ORDER_COL_PAYMENT}</dt>
                <dd className="text-body">{adminPaymentStatusLabel(order.paymentStatus)}</dd>
              </div>
            </dl>
            {provisional ? null : (
              <AdminOrderStatusForm
                orderId={order.id}
                current={order.orderStatus}
                targets={order.statusTargets}
              />
            )}
          </section>
          <section className={styles.section} aria-labelledby="order-fulfilment-heading">
            <h2 id="order-fulfilment-heading" className={styles.sectionTitle}>
              {ADMIN_ORDER_FULFILMENT}
            </h2>
            {isAwaitingFulfilment(order) ? (
              <p className={`text-small ${styles.quietBody}`}>{ADMIN_ORDERS_AWAITING_FULFILMENT}</p>
            ) : null}
            {order.shipment ? (
              <dl className={styles.dl}>
                <div>
                  <dt>{ADMIN_ORDER_SHIPMENT_STATUS}</dt>
                  <dd className="text-body">{adminShipmentStatusLabel(order.shipment.status)}</dd>
                </div>
                <div>
                  <dt>{ADMIN_ORDER_CARRIER}</dt>
                  <dd className="text-body">{order.shipment.carrierName || "—"}</dd>
                </div>
                <div>
                  <dt>{ADMIN_ORDER_TRACKING_NUMBER}</dt>
                  <dd className={`text-body ${styles.breakUrl}`}>
                    {order.shipment.trackingNumber || "—"}
                  </dd>
                </div>
                <div>
                  <dt>{ADMIN_ORDER_TRACKING_URL}</dt>
                  <dd className={`text-body ${styles.breakUrl}`}>
                    {trackingUrl ? <a href={trackingUrl}>{trackingUrl}</a> : "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className={styles.quiet}>
                <p className={`text-micro ${styles.quietTitle}`}>{ADMIN_ORDER_NO_FULFILMENT_TITLE}</p>
                <p className={`text-small ${styles.quietBody}`}>{ADMIN_ORDER_NO_FULFILMENT_BODY}</p>
              </div>
            )}
            {order.shipment ? (
              <div>
                <h3 className={styles.sectionTitle}>{ADMIN_ORDER_TRACKING_EVENTS}</h3>
                {order.shipment.events.length === 0 ? (
                  <p className={`text-small ${styles.quietBody}`}>{ADMIN_ORDER_TRACKING_EVENTS_EMPTY}</p>
                ) : (
                  <ol className={styles.timeline}>
                    {order.shipment.events.map((event) => (
                      <li key={event.id} className={styles.event}>
                        <p className="text-small">{adminShipmentStatusLabel(event.status)}</p>
                        {event.description ? <p className="text-small">{event.description}</p> : null}
                        <time className="text-small" dateTime={event.occurredAt}>
                          {formatAdminDateTime(event.occurredAt)}
                        </time>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : null}
            {provisional ? null : (
              <AdminFulfilmentForm
                orderId={order.id}
                shipment={order.shipment}
                paymentStatus={order.paymentStatus}
                orderStatus={order.orderStatus}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
