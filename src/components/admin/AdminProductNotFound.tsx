import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_PRODUCT_BACK,
  ADMIN_PRODUCT_NOT_FOUND_BODY,
  ADMIN_PRODUCT_NOT_FOUND_TITLE,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import styles from "./AdminProducts.module.css";

export function AdminProductNotFound() {
  return (
    <div className={styles.unavailable}>
      <h1 className="text-h2">{ADMIN_PRODUCT_NOT_FOUND_TITLE}</h1>
      <p className={`text-body ${styles.quietBody}`}>{ADMIN_PRODUCT_NOT_FOUND_BODY}</p>
      <ButtonLink href={routes.adminProducts} variant="secondary">
        {ADMIN_PRODUCT_BACK}
      </ButtonLink>
    </div>
  );
}
