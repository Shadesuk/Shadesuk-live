import { ButtonLink } from "@/components/ui/ButtonLink";
import { INDIA_CARD_PAYMENT_UNAVAILABLE, RETURN_TO_BAG } from "@/lib/checkout-copy";
import { routes } from "@/lib/navigation";
import styles from "./IndiaCardPaymentNotice.module.css";

type IndiaCardPaymentNoticeProps = {
  returnToBag?: boolean;
};

/** Quiet status. Config availability comes from the server check, not a client mode. */
export function IndiaCardPaymentNotice({ returnToBag = false }: IndiaCardPaymentNoticeProps) {
  return (
    <div className={styles.notice} data-india-card-notice>
      <p className="text-small" role="status">
        {INDIA_CARD_PAYMENT_UNAVAILABLE}
      </p>
      {returnToBag ? (
        <ButtonLink href={routes.cart} variant="tertiary">
          {RETURN_TO_BAG}
        </ButtonLink>
      ) : null}
    </div>
  );
}
