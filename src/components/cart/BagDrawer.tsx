"use client";

import { useEffect, useId, useState } from "react";
import { useChrome } from "@/components/navigation/ChromeContext";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Drawer } from "@/components/ui/Drawer";
import { EMPTY_BAG_CTA, EMPTY_BAG_DESCRIPTION, EMPTY_BAG_TITLE } from "@/lib/cart-copy";
import { DisplayPrice } from "@/components/market/DisplayPrice";
import { routes } from "@/lib/navigation";
import { CartLine } from "./CartLine";
import { useCart } from "./CartProvider";
import styles from "./BagDrawer.module.css";

export function BagDrawer() {
  const { acquirePageLock, releasePageLock } = useChrome();
  const { cart, open, closeBag, error, updateQuantity, removeItem } = useCart();
  const titleId = useId();
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1200px)");
    function update() {
      setDesktop(media.matches);
    }
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    acquirePageLock();
    return () => releasePageLock();
  }, [open, acquirePageLock, releasePageLock]);

  const empty = cart.items.length === 0;

  return (
    <Drawer
      open={open}
      onClose={closeBag}
      titleId={titleId}
      side={desktop ? "right" : "bottom"}
      id="site-bag-drawer"
    >
      <div className={styles.sheet} data-bag-drawer>
        <div className={styles.toolbar}>
          <h2 id={titleId} className="text-micro">
            Your bag
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={closeBag}
            aria-label="Close bag"
          >
            Close
          </button>
        </div>
        <div className={styles.body}>
          {error ? (
            <p className={`text-small ${styles.error}`} role="alert">
              We couldn&apos;t complete that request.
            </p>
          ) : null}
          {empty ? (
            <div className={styles.empty}>
              <h3 className="text-h3">{EMPTY_BAG_TITLE}</h3>
              <p className="text-small">{EMPTY_BAG_DESCRIPTION}</p>
              <ButtonLink href={routes.shop} variant="secondary" onClick={closeBag}>
                {EMPTY_BAG_CTA}
              </ButtonLink>
            </div>
          ) : null}
          {cart.items.map((item) => (
            <CartLine
              key={item.id}
              item={item}
              onQuantity={updateQuantity}
              onRemove={removeItem}
              onNavigate={closeBag}
            />
          ))}
        </div>
        {!empty ? (
          <div className={styles.footer}>
            <div className={styles.total}>
              <p className="text-micro">Subtotal</p>
              <p className="text-small">
                <DisplayPrice amountMajor={cart.subtotal} />
              </p>
            </div>
            <div className={styles.actions}>
              <ButtonLink href={routes.checkout} onClick={closeBag}>
                Checkout
              </ButtonLink>
              <ButtonLink href={routes.cart} variant="secondary" onClick={closeBag}>
                View bag
              </ButtonLink>
              <Button variant="tertiary" onClick={closeBag}>
                Continue shopping
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
