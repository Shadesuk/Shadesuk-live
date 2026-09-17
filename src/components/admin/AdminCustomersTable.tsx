import Link from "next/link";
import type { AdminCustomerListItem, AdminCustomerListQuery } from "@/contracts/admin/customers";
import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_CUSTOMERS_COL_CUSTOMER,
  ADMIN_CUSTOMERS_COL_EMAIL,
  ADMIN_CUSTOMERS_COL_LAST_ORDER,
  ADMIN_CUSTOMERS_COL_ORDERS,
  ADMIN_CUSTOMERS_COL_SPENT,
  ADMIN_CUSTOMERS_COL_TYPE,
  ADMIN_CUSTOMERS_EMPTY_BODY,
  ADMIN_CUSTOMERS_EMPTY_FILTER_BODY,
  ADMIN_CUSTOMERS_EMPTY_FILTER_TITLE,
  ADMIN_CUSTOMERS_EMPTY_TITLE,
  ADMIN_CUSTOMERS_TITLE,
  ADMIN_CUSTOMERS_TYPE_GUEST,
  ADMIN_CUSTOMERS_TYPE_REGISTERED,
  ADMIN_ORDERS_NEXT,
  ADMIN_ORDERS_PREV,
} from "@/lib/admin-copy";
import { formatAdminDateTime } from "@/lib/admin-format";
import { formatGbpMinor } from "@/lib/money";
import { adminCustomerPath } from "@/lib/navigation";
import { loadAdminCustomerList } from "@/services/admin-customers";
import { adminCustomersHref } from "./AdminCustomerFilters";
import { AdminCustomersUnavailable } from "./AdminCustomersUnavailable";
import styles from "./AdminCustomers.module.css";

export async function AdminCustomersList({ query }: { query: AdminCustomerListQuery }) {
  const result = await loadAdminCustomerList(query);
  if (result.status !== "ok") {
    return <AdminCustomersUnavailable />;
  }
  return (
    <AdminCustomersTable
      customers={result.data.customers}
      query={query}
      total={result.data.total}
      page={result.data.page}
      pageCount={result.data.pageCount}
    />
  );
}

export function AdminCustomersTable({
  customers,
  query,
  total,
  page,
  pageCount,
}: {
  customers: AdminCustomerListItem[];
  query: AdminCustomerListQuery;
  total: number;
  page: number;
  pageCount: number;
}) {
  const filtered = Boolean(query.q || query.accountType !== "all" || query.orders !== "all");
  if (customers.length === 0) {
    const noMatch = filtered || page > 1;
    return (
      <div className={styles.quiet}>
        <p className={`text-micro ${styles.quietTitle}`}>
          {noMatch ? ADMIN_CUSTOMERS_EMPTY_FILTER_TITLE : ADMIN_CUSTOMERS_EMPTY_TITLE}
        </p>
        <p className={`text-small ${styles.quietBody}`}>
          {noMatch ? ADMIN_CUSTOMERS_EMPTY_FILTER_BODY : ADMIN_CUSTOMERS_EMPTY_BODY}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.head} aria-hidden="true">
        <span>{ADMIN_CUSTOMERS_COL_CUSTOMER}</span>
        <span>{ADMIN_CUSTOMERS_COL_EMAIL}</span>
        <span>{ADMIN_CUSTOMERS_COL_ORDERS}</span>
        <span>{ADMIN_CUSTOMERS_COL_SPENT}</span>
        <span>{ADMIN_CUSTOMERS_COL_LAST_ORDER}</span>
        <span>{ADMIN_CUSTOMERS_COL_TYPE}</span>
      </div>
      <ul className={styles.list} aria-label={ADMIN_CUSTOMERS_TITLE}>
        {customers.map((customer) => (
          <li key={customer.id}>
            <Link
              href={adminCustomerPath(customer.id)}
              className={styles.row}
              data-account-type={customer.accountType}
            >
              <p className={`text-small ${styles.name}`}>
                <span className="visually-hidden">{ADMIN_CUSTOMERS_COL_CUSTOMER} </span>
                {customer.name}
              </p>
              <span className="text-small">
                <span className="visually-hidden">{ADMIN_CUSTOMERS_COL_EMAIL} </span>
                {customer.email}
              </span>
              <span className={styles.meta}>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_CUSTOMERS_COL_ORDERS} </span>
                  {customer.orderCount}
                </span>
                <span className={`text-small ${styles.amount}`}>
                  <span className="visually-hidden">{ADMIN_CUSTOMERS_COL_SPENT} </span>
                  {formatGbpMinor(customer.totalSpentMinor)}
                </span>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_CUSTOMERS_COL_LAST_ORDER} </span>
                  {customer.lastOrderAt ? (
                    <time dateTime={customer.lastOrderAt}>
                      {formatAdminDateTime(customer.lastOrderAt)}
                    </time>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_CUSTOMERS_COL_TYPE} </span>
                  {customer.accountType === "guest"
                    ? ADMIN_CUSTOMERS_TYPE_GUEST
                    : ADMIN_CUSTOMERS_TYPE_REGISTERED}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {pageCount > 1 ? (
        <nav className={styles.pagination} aria-label="Pagination">
          {page > 1 ? (
            <ButtonLink href={adminCustomersHref(query, page - 1)} variant="secondary">
              {ADMIN_ORDERS_PREV}
            </ButtonLink>
          ) : (
            <span />
          )}
          <p className="text-small">
            {page} / {pageCount} · {total}
          </p>
          {page < pageCount ? (
            <ButtonLink href={adminCustomersHref(query, page + 1)} variant="secondary">
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
