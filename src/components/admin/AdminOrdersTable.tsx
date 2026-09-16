import Link from "next/link";
import {
  adminOrderStatusLabel,
  adminPaymentStatusLabel,
} from "@/contracts/admin/dashboard";
import {
  adminOrderCustomerLabel,
  type AdminOrderListItem,
  type AdminOrderListQuery,
} from "@/contracts/admin/orders";
import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_ORDER_COL_AMOUNT,
  ADMIN_ORDER_COL_CUSTOMER,
  ADMIN_ORDER_COL_DATE,
  ADMIN_ORDER_COL_PAYMENT,
  ADMIN_ORDER_COL_REFERENCE,
  ADMIN_ORDER_COL_STATUS,
  ADMIN_ORDER_GUEST,
  ADMIN_ORDERS_EMPTY_BODY,
  ADMIN_ORDERS_EMPTY_FILTER_BODY,
  ADMIN_ORDERS_EMPTY_FILTER_TITLE,
  ADMIN_ORDERS_EMPTY_TITLE,
  ADMIN_ORDERS_NEXT,
  ADMIN_ORDERS_PREV,
  ADMIN_ORDERS_TITLE,
} from "@/lib/admin-copy";
import { formatAdminDateTime } from "@/lib/admin-format";
import { formatGbpMinor } from "@/lib/money";
import { adminOrderPath } from "@/lib/navigation";
import { loadAdminOrderList } from "@/services/admin-orders";
import { adminOrdersHref } from "./AdminOrderFilters";
import { AdminOrdersUnavailable } from "./AdminOrdersUnavailable";
import styles from "./AdminOrders.module.css";

export async function AdminOrdersList({ query }: { query: AdminOrderListQuery }) {
  const result = await loadAdminOrderList(query);
  if (result.status !== "ok") {
    return <AdminOrdersUnavailable />;
  }
  return (
    <AdminOrdersTable
      orders={result.data.orders}
      query={query}
      total={result.data.total}
      page={result.data.page}
      pageCount={result.data.pageCount}
    />
  );
}

export function AdminOrdersTable({
  orders,
  query,
  total,
  page,
  pageCount,
}: {
  orders: AdminOrderListItem[];
  query: AdminOrderListQuery;
  total: number;
  page: number;
  pageCount: number;
}) {
  const filtered = Boolean(query.q || query.status || query.payment || query.period !== "all");
  if (orders.length === 0) {
    const noMatch = filtered || page > 1;
    return (
      <div className={styles.quiet}>
        <p className={`text-micro ${styles.quietTitle}`}>
          {noMatch ? ADMIN_ORDERS_EMPTY_FILTER_TITLE : ADMIN_ORDERS_EMPTY_TITLE}
        </p>
        <p className={`text-small ${styles.quietBody}`}>
          {noMatch ? ADMIN_ORDERS_EMPTY_FILTER_BODY : ADMIN_ORDERS_EMPTY_BODY}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.head} aria-hidden="true">
        <span>{ADMIN_ORDER_COL_REFERENCE}</span>
        <span>{ADMIN_ORDER_COL_CUSTOMER}</span>
        <span>{ADMIN_ORDER_COL_DATE}</span>
        <span>{ADMIN_ORDER_COL_PAYMENT}</span>
        <span>{ADMIN_ORDER_COL_STATUS}</span>
        <span>{ADMIN_ORDER_COL_AMOUNT}</span>
      </div>
      <ul className={styles.list} aria-label={ADMIN_ORDERS_TITLE}>
        {orders.map((order) => (
          <li key={order.id}>
            <Link href={adminOrderPath(order.id)} className={styles.row}>
              <p className={`text-small ${styles.ref}`}>
                <span className="visually-hidden">{ADMIN_ORDER_COL_REFERENCE} </span>
                {order.orderReference}
              </p>
              <span className="text-small">
                <span className="visually-hidden">{ADMIN_ORDER_COL_CUSTOMER} </span>
                {adminOrderCustomerLabel(order.customerName, order.guest, ADMIN_ORDER_GUEST)}
              </span>
              <time className="text-small" dateTime={order.createdAt}>
                <span className="visually-hidden">{ADMIN_ORDER_COL_DATE} </span>
                {formatAdminDateTime(order.createdAt)}
              </time>
              <span className={styles.meta}>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_ORDER_COL_PAYMENT} </span>
                  {adminPaymentStatusLabel(order.paymentStatus)}
                </span>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_ORDER_COL_STATUS} </span>
                  {adminOrderStatusLabel(order.orderStatus)}
                </span>
                <span className={`text-small ${styles.amount}`}>
                  <span className="visually-hidden">{ADMIN_ORDER_COL_AMOUNT} </span>
                  {formatGbpMinor(order.totalMinor)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {pageCount > 1 ? (
        <nav className={styles.pagination} aria-label="Pagination">
          {page > 1 ? (
            <ButtonLink href={adminOrdersHref(query, page - 1)} variant="secondary">
              {ADMIN_ORDERS_PREV}
            </ButtonLink>
          ) : (
            <span />
          )}
          <p className="text-small">
            {page} / {pageCount} · {total}
          </p>
          {page < pageCount ? (
            <ButtonLink href={adminOrdersHref(query, page + 1)} variant="secondary">
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
