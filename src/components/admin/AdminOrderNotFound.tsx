import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_ORDER_BACK,
  ADMIN_ORDER_NOT_FOUND_BODY,
  ADMIN_ORDER_NOT_FOUND_TITLE,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import styles from "./AdminOrders.module.css";

export function AdminOrderNotFound() {
  return (
    <div className={styles.unavailable}>
      <h1 className="text-h2">{ADMIN_ORDER_NOT_FOUND_TITLE}</h1>
      <p className={`text-body ${styles.quietBody}`}>{ADMIN_ORDER_NOT_FOUND_BODY}</p>
      <ButtonLink href={routes.adminOrders} variant="secondary">
        {ADMIN_ORDER_BACK}
      </ButtonLink>
    </div>
  );
}
