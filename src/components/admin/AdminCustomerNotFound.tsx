import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_CUSTOMER_BACK,
  ADMIN_CUSTOMER_NOT_FOUND_BODY,
  ADMIN_CUSTOMER_NOT_FOUND_TITLE,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import styles from "./AdminCustomers.module.css";

export function AdminCustomerNotFound() {
  return (
    <div className={styles.unavailable}>
      <h1 className="text-h2">{ADMIN_CUSTOMER_NOT_FOUND_TITLE}</h1>
      <p className={`text-body ${styles.quietBody}`}>{ADMIN_CUSTOMER_NOT_FOUND_BODY}</p>
      <ButtonLink href={routes.adminCustomers} variant="secondary">
        {ADMIN_CUSTOMER_BACK}
      </ButtonLink>
    </div>
  );
}
