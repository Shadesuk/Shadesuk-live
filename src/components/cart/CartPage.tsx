"use client";

import { useEffect } from "react";
import { LiveRecentlyViewed } from "@/components/pdp/LiveRecentlyViewed";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineError } from "@/components/ui/InlineError";
import { ProductGrid } from "@/components/product/ProductGrid";
import { track } from "@/lib/analytics";
import {
  EMPTY_BAG_CTA,
  EMPTY_BAG_DESCRIPTION,
  EMPTY_BAG_TITLE,
} from "@/lib/cart-copy";
import { formatGbp } from "@/lib/money";
import { routes } from "@/lib/navigation";
import type { PublicCart } from "@/types/cart";
import type { Product } from "@/types/catalogue";
import { CartLine } from "./CartLine";
import { useCart } from "./CartProvider";
import styles from "./CartPage.module.css";

type CartPageProps = {
  initialCart: PublicCart;
  suggestions: Product[];
};

export function CartPage({ initialCart, suggestions }: CartPageProps) {
  const { cart, updateQuantity, removeItem, error } = useCart();

  const view = cart.items.length > 0 || cart.issues.length > 0 ? cart : initialCart;
  const empty = view.items.length === 0;

  useEffect(() => {
    track("view_cart", { count: view.items.length, value: view.subtotal, currency: "GBP" });
    // Fire once per bag visit, not on each quantity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.page} data-cart>
      {error ? <InlineError /> : null}
      {empty ? (
        <EmptyState
          className={styles.empty}
          title={EMPTY_BAG_TITLE}
          description={EMPTY_BAG_DESCRIPTION}
          titleAs="h1"
          actions={
            <ButtonLink href={routes.shop} variant="secondary">
              {EMPTY_BAG_CTA}
            </ButtonLink>
          }
        />
      ) : (
        <>
          <header className={styles.intro}>
            <h1 className={`text-h2 ${styles.heading}`}>Your bag</h1>
            <p className={`text-micro ${styles.count}`}>
              {view.itemCount} {view.itemCount === 1 ? "item" : "items"}
            </p>
          </header>
          {view.issues.length > 0 ? (
            <ul className={styles.issues} role="status">
              {view.issues.map((issue, index) => (
                <li key={`${issue.issue}-${issue.itemId ?? index}`} className="text-small">
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          <div className={styles.layout}>
            <div className={styles.lines}>
              {view.items.map((item) => (
                <CartLine
                  key={item.id}
                  item={item}
                  onQuantity={updateQuantity}
                  onRemove={removeItem}
                />
              ))}
            </div>
            <aside className={styles.summary} aria-labelledby="order-summary-heading">
              <h2 id="order-summary-heading" className="text-micro">
                Order summary
              </h2>
              <div className={styles.summaryRow}>
                <p className="text-small">Subtotal</p>
                <p className="text-small">{formatGbp(view.subtotal)}</p>
              </div>
              <div className={styles.summaryRow}>
                <p className="text-small">Shipping</p>
                <p className="text-small">Calculated at checkout</p>
              </div>
              <div className={styles.summaryTotal}>
                <p className="text-micro">Total</p>
                <p className="text-small">{formatGbp(view.subtotal)}</p>
              </div>
              <p className={`text-micro ${styles.note}`}>Secure card payment</p>
              <p className={`text-small ${styles.note}`}>All major cards accepted</p>
              <div className={styles.actions}>
                <ButtonLink href={routes.checkout}>Checkout</ButtonLink>
                <ButtonLink href={routes.shop} variant="tertiary">
                  Continue shopping
                </ButtonLink>
              </div>
            </aside>
          </div>
        </>
      )}
      {suggestions.length > 0 ? (
        <section className={styles.related} aria-labelledby="cart-you-may-also-like">
          <h2 id="cart-you-may-also-like" className="text-micro">
            You may also like
          </h2>
          <ProductGrid products={suggestions} imagePriorityCount={0} list="you_may_also_like" />
        </section>
      ) : null}
      <LiveRecentlyViewed />
    </div>
  );
}
