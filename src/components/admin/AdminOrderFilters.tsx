import {
  ADMIN_ORDER_STATUS_LABELS,
  ADMIN_PAYMENT_STATUS_LABELS,
  DASHBOARD_PERIOD_LABELS,
} from "@/contracts/admin/dashboard";
import {
  ADMIN_ORDER_LIST_PERIODS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type AdminOrderListQuery,
  adminOrderListQueryString,
} from "@/contracts/admin/orders";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field, FieldSelect } from "@/components/ui/Field";
import {
  ADMIN_ORDERS_APPLY,
  ADMIN_ORDERS_CLEAR,
  ADMIN_ORDERS_AWAITING_FULFILMENT,
  ADMIN_ORDERS_FILTER_ALL,
  ADMIN_ORDERS_FILTER_FULFILMENT,
  ADMIN_ORDERS_FILTER_PAYMENT,
  ADMIN_ORDERS_FILTER_PERIOD,
  ADMIN_ORDERS_FILTER_STATUS,
  ADMIN_ORDERS_SEARCH_HINT,
  ADMIN_ORDERS_SEARCH_LABEL,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import styles from "./AdminOrders.module.css";

export function AdminOrderFilters({ query }: { query: AdminOrderListQuery }) {
  return (
    <form className={styles.filters} method="get" action={routes.adminOrders}>
      <div className={styles.filterFields}>
        <Field
          id="admin-orders-q"
          name="q"
          label={ADMIN_ORDERS_SEARCH_LABEL}
          hint={ADMIN_ORDERS_SEARCH_HINT}
          defaultValue={query.q}
          autoComplete="off"
        />
        <FieldSelect
          id="admin-orders-status"
          name="status"
          label={ADMIN_ORDERS_FILTER_STATUS}
          defaultValue={query.status ?? ""}
        >
          <option value="">{ADMIN_ORDERS_FILTER_ALL}</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ADMIN_ORDER_STATUS_LABELS[status]}
            </option>
          ))}
        </FieldSelect>
        <FieldSelect
          id="admin-orders-payment"
          name="payment"
          label={ADMIN_ORDERS_FILTER_PAYMENT}
          defaultValue={query.payment ?? ""}
        >
          <option value="">{ADMIN_ORDERS_FILTER_ALL}</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ADMIN_PAYMENT_STATUS_LABELS[status]}
            </option>
          ))}
        </FieldSelect>
        <FieldSelect
          id="admin-orders-fulfilment"
          name="fulfilment"
          label={ADMIN_ORDERS_FILTER_FULFILMENT}
          defaultValue={query.fulfilment ?? ""}
        >
          <option value="">{ADMIN_ORDERS_FILTER_ALL}</option>
          <option value="awaiting">{ADMIN_ORDERS_AWAITING_FULFILMENT}</option>
        </FieldSelect>
        <FieldSelect
          id="admin-orders-period"
          name="period"
          label={ADMIN_ORDERS_FILTER_PERIOD}
          defaultValue={query.period}
        >
          {ADMIN_ORDER_LIST_PERIODS.map((period) => (
            <option key={period} value={period}>
              {period === "all" ? ADMIN_ORDERS_FILTER_ALL : DASHBOARD_PERIOD_LABELS[period]}
            </option>
          ))}
        </FieldSelect>
      </div>
      <div className={styles.filterActions}>
        <Button type="submit" variant="primary">
          {ADMIN_ORDERS_APPLY}
        </Button>
        <ButtonLink href={routes.adminOrders} variant="tertiary">
          {ADMIN_ORDERS_CLEAR}
        </ButtonLink>
      </div>
    </form>
  );
}

export function adminOrdersHref(query: AdminOrderListQuery, page = query.page): string {
  return `${routes.adminOrders}${adminOrderListQueryString(query, page)}`;
}
