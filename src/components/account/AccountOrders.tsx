import { AccountOrderCard } from "@/components/account/AccountOrderCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import type { CustomerOrderListItem } from "@/contracts";
import {
  NO_ORDERS_BODY,
  NO_ORDERS_TITLE,
  ORDERS_LABEL,
  ORDERS_UNAVAILABLE_BODY,
  ORDERS_UNAVAILABLE_TITLE,
  SHOP_SHADES,
  TRY_AGAIN,
} from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import styles from "./Account.module.css";

export function AccountOrders({
  orders,
  error,
}: {
  orders: CustomerOrderListItem[];
  error?: boolean;
}) {
  return (
    <div className={styles.form}>
      <h1 className="text-h2">{ORDERS_LABEL}</h1>
      {error ? (
        <ErrorState
          title={ORDERS_UNAVAILABLE_TITLE}
          description={ORDERS_UNAVAILABLE_BODY}
          titleAs="h2"
          actions={
            <ButtonLink href={routes.accountOrders} variant="secondary">
              {TRY_AGAIN}
            </ButtonLink>
          }
        />
      ) : orders.length === 0 ? (
        <EmptyState
          title={NO_ORDERS_TITLE}
          description={NO_ORDERS_BODY}
          actions={<ButtonLink href={routes.shop}>{SHOP_SHADES}</ButtonLink>}
        />
      ) : (
        <div className={styles.cardList}>
          {orders.map((order) => (
            <AccountOrderCard key={order.orderReference} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
