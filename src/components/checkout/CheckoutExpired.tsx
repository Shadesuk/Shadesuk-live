import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  CHECKOUT_EXPIRED_BODY,
  CHECKOUT_EXPIRED_TITLE,
  RETURN_TO_BAG,
} from "@/lib/checkout-copy";
import { routes } from "@/lib/navigation";
import styles from "./CheckoutExpired.module.css";

export function CheckoutExpired() {
  return (
    <div className={styles.page} data-checkout-expired>
      <h1 className="text-h2">{CHECKOUT_EXPIRED_TITLE}</h1>
      <p className="text-body">{CHECKOUT_EXPIRED_BODY}</p>
      <ButtonLink href={routes.cart} variant="secondary">
        {RETURN_TO_BAG}
      </ButtonLink>
    </div>
  );
}
