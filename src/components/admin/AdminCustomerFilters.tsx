import type { AdminCustomerListQuery } from "@/contracts/admin/customers";
import { adminCustomerListQueryString } from "@/contracts/admin/customers";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field, FieldSelect } from "@/components/ui/Field";
import {
  ADMIN_CUSTOMERS_APPLY,
  ADMIN_CUSTOMERS_CLEAR,
  ADMIN_CUSTOMERS_FILTER_ALL,
  ADMIN_CUSTOMERS_FILTER_ORDERS,
  ADMIN_CUSTOMERS_FILTER_TYPE,
  ADMIN_CUSTOMERS_ORDERS_HAS,
  ADMIN_CUSTOMERS_ORDERS_NONE,
  ADMIN_CUSTOMERS_SEARCH_HINT,
  ADMIN_CUSTOMERS_SEARCH_LABEL,
  ADMIN_CUSTOMERS_TYPE_GUEST,
  ADMIN_CUSTOMERS_TYPE_REGISTERED,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import styles from "./AdminCustomers.module.css";

export function AdminCustomerFilters({ query }: { query: AdminCustomerListQuery }) {
  return (
    <form className={styles.filters} method="get" action={routes.adminCustomers}>
      <div className={styles.filterFields}>
        <Field
          id="admin-customers-q"
          name="q"
          label={ADMIN_CUSTOMERS_SEARCH_LABEL}
          hint={ADMIN_CUSTOMERS_SEARCH_HINT}
          defaultValue={query.q}
          autoComplete="off"
        />
        <FieldSelect
          id="admin-customers-type"
          name="type"
          label={ADMIN_CUSTOMERS_FILTER_TYPE}
          defaultValue={query.accountType}
        >
          <option value="all">{ADMIN_CUSTOMERS_FILTER_ALL}</option>
          <option value="registered">{ADMIN_CUSTOMERS_TYPE_REGISTERED}</option>
          <option value="guest">{ADMIN_CUSTOMERS_TYPE_GUEST}</option>
        </FieldSelect>
        <FieldSelect
          id="admin-customers-orders"
          name="orders"
          label={ADMIN_CUSTOMERS_FILTER_ORDERS}
          defaultValue={query.orders}
        >
          <option value="all">{ADMIN_CUSTOMERS_FILTER_ALL}</option>
          <option value="has_orders">{ADMIN_CUSTOMERS_ORDERS_HAS}</option>
          <option value="no_orders">{ADMIN_CUSTOMERS_ORDERS_NONE}</option>
        </FieldSelect>
      </div>
      <div className={styles.filterActions}>
        <Button type="submit" variant="primary">
          {ADMIN_CUSTOMERS_APPLY}
        </Button>
        <ButtonLink href={routes.adminCustomers} variant="tertiary">
          {ADMIN_CUSTOMERS_CLEAR}
        </ButtonLink>
      </div>
    </form>
  );
}

export function adminCustomersHref(query: AdminCustomerListQuery, page = query.page): string {
  return `${routes.adminCustomers}${adminCustomerListQueryString(query, page)}`;
}
