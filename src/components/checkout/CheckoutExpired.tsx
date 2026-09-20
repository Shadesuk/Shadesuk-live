"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restartCheckoutDraftAction } from "@/app/(storefront)/checkout/actions";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  CHECKOUT_EXPIRED_BODY,
  CHECKOUT_EXPIRED_TITLE,
  CHECKOUT_START_AGAIN,
  RETURN_TO_BAG,
} from "@/lib/checkout-copy";
import { routes } from "@/lib/navigation";
import styles from "./CheckoutExpired.module.css";

export function CheckoutExpired() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function restart() {
    if (pending) {
      return;
    }
    setPending(true);
    setFailed(false);
    try {
      const result = await restartCheckoutDraftAction();
      if (result.status === "ok") {
        router.replace(routes.checkout);
        router.refresh();
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.page} data-checkout-expired>
      <h1 className="text-h2">{CHECKOUT_EXPIRED_TITLE}</h1>
      <p className="text-body">{CHECKOUT_EXPIRED_BODY}</p>
      <Button type="button" loading={pending} onClick={() => void restart()}>
        {CHECKOUT_START_AGAIN}
      </Button>
      <ButtonLink href={routes.cart} variant="secondary">
        {RETURN_TO_BAG}
      </ButtonLink>
      {failed ? (
        <p className="text-small" role="alert">
          We could not restart checkout. Return to your bag and try again.
        </p>
      ) : null}
    </div>
  );
}
