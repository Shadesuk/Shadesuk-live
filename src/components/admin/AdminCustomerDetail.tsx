import Link from "next/link";
import { redirect } from "next/navigation";
import {
  adminOrderStatusLabel,
  adminPaymentStatusLabel,
} from "@/contracts/admin/dashboard";
import {
  formatOrderItemSummary,
  parseAdminCustomerId,
  type AdminCustomerDetailView,
  type AdminCustomerSavedAddress,
} from "@/contracts/admin/customers";
import type { GuestDeliveryAddressView } from "@/contracts/order/dto";
import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_CUSTOMER_ADDRESSES,
  ADMIN_CUSTOMER_ADDRESSES_EMPTY_BODY,
  ADMIN_CUSTOMER_ADDRESSES_EMPTY_TITLE,
  ADMIN_CUSTOMER_BACK,
  ADMIN_CUSTOMER_DEFAULT_ADDRESS,
  ADMIN_CUSTOMER_DETAILS,
  ADMIN_CUSTOMER_GUEST_HINT,
  ADMIN_CUSTOMER_LAST_DELIVERY,
  ADMIN_CUSTOMER_ORDER_HISTORY,
  ADMIN_CUSTOMER_ORDER_HISTORY_EMPTY_BODY,
  ADMIN_CUSTOMER_ORDER_HISTORY_EMPTY_TITLE,
  ADMIN_CUSTOMER_ORDER_SUMMARY,
  ADMIN_CUSTOMER_VIEW_ORDER,
  ADMIN_CUSTOMERS_COL_EMAIL,
  ADMIN_CUSTOMERS_COL_SPENT,
  ADMIN_CUSTOMERS_COL_TYPE,
  ADMIN_CUSTOMERS_TITLE,
  ADMIN_CUSTOMERS_TYPE_GUEST,
  ADMIN_CUSTOMERS_TYPE_REGISTERED,
  ADMIN_ORDER_COL_AMOUNT,
  ADMIN_ORDER_COL_DATE,
  ADMIN_ORDER_COL_PAYMENT,
  ADMIN_ORDER_COL_REFERENCE,
  ADMIN_ORDER_COL_STATUS,
  ADMIN_ORDER_CUSTOMER,
  ADMIN_ORDERS_NEXT,
  ADMIN_ORDERS_PREV,
} from "@/lib/admin-copy";
import { formatAdminDateTime } from "@/lib/admin-format";
import { formatGbpMinor } from "@/lib/money";
import { adminCustomerPath, adminOrderPath, routes } from "@/lib/navigation";
import { loadAdminCustomerDetail } from "@/services/admin-customers";
import { AdminCustomerNotFound } from "./AdminCustomerNotFound";
import { AdminCustomersUnavailable } from "./AdminCustomersUnavailable";
import { AdminPageHeader } from "./AdminPageHeader";
import styles from "./AdminCustomers.module.css";

export async function AdminCustomerDetailSection({
  id,
  ordersPage,
}: {
  id: string;
  ordersPage: number;
}) {
  const result = await loadAdminCustomerDetail(id, ordersPage);
  if (result.status === "not_found") {
    return <AdminCustomerNotFound />;
  }
  if (result.status !== "ok") {
    return <AdminCustomersUnavailable />;
  }
  const parsed = parseAdminCustomerId(id);
  if (parsed?.kind === "guest" && result.data.accountType === "registered") {
    redirect(adminCustomerPath(result.data.id));
  }
  return <AdminCustomerDetail customer={result.data} />;
}

export function AdminCustomerDetail({ customer }: { customer: AdminCustomerDetailView }) {
  const typeLabel =
    customer.accountType === "guest" ? ADMIN_CUSTOMERS_TYPE_GUEST : ADMIN_CUSTOMERS_TYPE_REGISTERED;

  return (
    <div
      data-admin-customer-detail
      data-customer-id={customer.id}
      data-account-type={customer.accountType}
    >
      <AdminPageHeader
        kicker={ADMIN_CUSTOMERS_TITLE}
        title={customer.name}
        description={`${customer.email} · ${typeLabel}`}
        action={
          <ButtonLink href={routes.adminCustomers} variant="tertiary">
            {ADMIN_CUSTOMER_BACK}
          </ButtonLink>
        }
      />
      <div className={styles.detailGrid}>
        <div className={styles.stack}>
          <section className={styles.section} aria-labelledby="customer-heading">
            <h2 id="customer-heading" className={styles.sectionTitle}>
              {ADMIN_ORDER_CUSTOMER}
            </h2>
            <dl className={styles.dl}>
              <div>
                <dt>{ADMIN_ORDER_CUSTOMER}</dt>
                <dd className="text-body">{customer.name}</dd>
              </div>
              <div>
                <dt>{ADMIN_CUSTOMERS_COL_EMAIL}</dt>
                <dd className="text-body">{customer.email}</dd>
              </div>
              <div>
                <dt>{ADMIN_CUSTOMERS_COL_TYPE}</dt>
                <dd className="text-body">{typeLabel}</dd>
              </div>
              <div>
                <dt>{ADMIN_CUSTOMERS_COL_SPENT}</dt>
                <dd className="text-body">{formatGbpMinor(customer.totalSpentMinor)}</dd>
              </div>
            </dl>
            {customer.accountType === "guest" ? (
              <p className={`text-small ${styles.hint}`}>{ADMIN_CUSTOMER_GUEST_HINT}</p>
            ) : null}
          </section>
          <section className={styles.section} aria-labelledby="customer-orders-heading">
            <h2 id="customer-orders-heading" className={styles.sectionTitle}>
              {ADMIN_CUSTOMER_ORDER_HISTORY}
            </h2>
            {customer.orders.length === 0 ? (
              <div className={styles.quiet}>
                <p className={`text-micro ${styles.quietTitle}`}>
                  {ADMIN_CUSTOMER_ORDER_HISTORY_EMPTY_TITLE}
                </p>
                <p className={`text-small ${styles.quietBody}`}>
                  {ADMIN_CUSTOMER_ORDER_HISTORY_EMPTY_BODY}
                </p>
              </div>
            ) : (
              <CustomerOrderHistory customer={customer} />
            )}
          </section>
        </div>
        <div className={styles.stack}>
          <section className={styles.section} aria-labelledby="customer-details-heading">
            <h2 id="customer-details-heading" className={styles.sectionTitle}>
              {ADMIN_CUSTOMER_DETAILS}
            </h2>
            <dl className={styles.dl}>
              <div>
                <dt>{ADMIN_ORDER_CUSTOMER}</dt>
                <dd className="text-body">{customer.name}</dd>
              </div>
              <div>
                <dt>{ADMIN_CUSTOMERS_COL_EMAIL}</dt>
                <dd className="text-body">{customer.email}</dd>
              </div>
            </dl>
          </section>
          {customer.accountType === "registered" ? (
            <section className={styles.section} aria-labelledby="customer-addresses-heading">
              <h2 id="customer-addresses-heading" className={styles.sectionTitle}>
                {ADMIN_CUSTOMER_ADDRESSES}
              </h2>
              {customer.savedAddresses.length === 0 ? (
                <div className={styles.quiet}>
                  <p className={`text-micro ${styles.quietTitle}`}>
                    {ADMIN_CUSTOMER_ADDRESSES_EMPTY_TITLE}
                  </p>
                  <p className={`text-small ${styles.quietBody}`}>
                    {ADMIN_CUSTOMER_ADDRESSES_EMPTY_BODY}
                  </p>
                </div>
              ) : (
                <ul className={styles.addressList}>
                  {customer.savedAddresses.map((address) => (
                    <li key={address.id}>
                      <AddressBlock address={address} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <section className={styles.section} aria-labelledby="customer-delivery-heading">
              <h2 id="customer-delivery-heading" className={styles.sectionTitle}>
                {ADMIN_CUSTOMER_LAST_DELIVERY}
              </h2>
              {customer.lastDelivery ? (
                <DeliveryAddress delivery={customer.lastDelivery} />
              ) : (
                <p className={`text-small ${styles.quietBody}`}>—</p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerOrderHistory({ customer }: { customer: AdminCustomerDetailView }) {
  return (
    <div>
      <div className={styles.ordersHead} aria-hidden="true">
        <span>{ADMIN_ORDER_COL_REFERENCE}</span>
        <span>{ADMIN_ORDER_COL_DATE}</span>
        <span>{ADMIN_ORDER_COL_STATUS}</span>
        <span>{ADMIN_ORDER_COL_PAYMENT}</span>
        <span>{ADMIN_ORDER_COL_AMOUNT}</span>
        <span>{ADMIN_CUSTOMER_ORDER_SUMMARY}</span>
      </div>
      <ul className={styles.orders} aria-label={ADMIN_CUSTOMER_ORDER_HISTORY}>
        {customer.orders.map((order) => (
          <li key={order.id}>
            <Link href={adminOrderPath(order.id)} className={styles.orderLink}>
              <p className="text-small">
                <span className="visually-hidden">{ADMIN_ORDER_COL_REFERENCE} </span>
                {order.orderReference}
              </p>
              <time className="text-small" dateTime={order.createdAt}>
                <span className="visually-hidden">{ADMIN_ORDER_COL_DATE} </span>
                {formatAdminDateTime(order.createdAt)}
              </time>
              <span className={styles.orderMeta}>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_ORDER_COL_STATUS} </span>
                  {adminOrderStatusLabel(order.orderStatus)}
                </span>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_ORDER_COL_PAYMENT} </span>
                  {adminPaymentStatusLabel(order.paymentStatus)}
                </span>
                <span className={`text-small ${styles.amount}`}>
                  <span className="visually-hidden">{ADMIN_ORDER_COL_AMOUNT} </span>
                  {formatGbpMinor(order.totalMinor)}
                </span>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_CUSTOMER_ORDER_SUMMARY} </span>
                  {formatOrderItemSummary(order.summary)}
                </span>
              </span>
              <span className="visually-hidden">{ADMIN_CUSTOMER_VIEW_ORDER}</span>
            </Link>
          </li>
        ))}
      </ul>
      {customer.ordersPageCount > 1 ? (
        <nav className={styles.pagination} aria-label="Pagination">
          {customer.ordersPage > 1 ? (
            <ButtonLink
              href={customerOrdersHref(customer.id, customer.ordersPage - 1)}
              variant="secondary"
            >
              {ADMIN_ORDERS_PREV}
            </ButtonLink>
          ) : (
            <span />
          )}
          <p className="text-small">
            {customer.ordersPage} / {customer.ordersPageCount} · {customer.ordersTotal}
          </p>
          {customer.ordersPage < customer.ordersPageCount ? (
            <ButtonLink
              href={customerOrdersHref(customer.id, customer.ordersPage + 1)}
              variant="secondary"
            >
              {ADMIN_ORDERS_NEXT}
            </ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

function AddressBlock({ address }: { address: AdminCustomerSavedAddress }) {
  return (
    <div>
      {address.label || address.isDefault ? (
        <p className={`text-micro ${styles.quietTitle}`}>
          {[address.label, address.isDefault ? ADMIN_CUSTOMER_DEFAULT_ADDRESS : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      <DeliveryAddress delivery={address.delivery} />
    </div>
  );
}

function DeliveryAddress({ delivery }: { delivery: GuestDeliveryAddressView }) {
  return (
    <address className="text-body">
      {[
        delivery.name,
        delivery.line1,
        delivery.line2,
        [delivery.city, delivery.county].filter(Boolean).join(", "),
        delivery.postcode,
        delivery.country,
      ]
        .filter(Boolean)
        .map((line, index) => (
          <span key={`${index}-${line}`} className={styles.addressLine}>
            {line}
          </span>
        ))}
    </address>
  );
}

function customerOrdersHref(id: string, page: number): string {
  return page > 1 ? `${adminCustomerPath(id)}?page=${page}` : adminCustomerPath(id);
}
