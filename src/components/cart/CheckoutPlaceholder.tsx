import { ButtonLink } from "@/components/ui/ButtonLink";
import { CHECKOUT_NEXT_COPY, CHECKOUT_NEXT_TITLE } from "@/lib/cart-copy";
import { routes } from "@/lib/navigation";
import styles from "./CheckoutPlaceholder.module.css";

export function CheckoutPlaceholder() {
  return (
    <div className={styles.page} data-checkout-placeholder>
      <h1 className="text-h2">{CHECKOUT_NEXT_TITLE}</h1>
      <p className="text-body">{CHECKOUT_NEXT_COPY}</p>
      <p className="text-small">Your bag is still available.</p>
      <div className={styles.actions}>
        <ButtonLink href={routes.cart} variant="secondary">
          Return to bag
        </ButtonLink>
        <ButtonLink href={routes.shop} variant="tertiary">
          Continue shopping
        </ButtonLink>
      </div>
    </div>
  );
}
