import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { NO_ORDERS_BODY, NO_ORDERS_TITLE, ORDERS_LABEL, SHOP_SHADES } from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import styles from "./Account.module.css";

export function OrdersPlaceholder() {
  return (
    <div className={styles.form}>
      <h1 className="text-h2">{ORDERS_LABEL}</h1>
      <EmptyState
        title={NO_ORDERS_TITLE}
        description={NO_ORDERS_BODY}
        actions={<ButtonLink href={routes.shop}>{SHOP_SHADES}</ButtonLink>}
      />
    </div>
  );
}
