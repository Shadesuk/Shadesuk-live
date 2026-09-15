"use client";

import { type ReactNode } from "react";
import { BagDrawer } from "@/components/cart/BagDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import type { PublicCart } from "@/types/cart";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { ChromeProvider, useChromeLocks } from "./ChromeContext";
import styles from "./SiteChrome.module.css";

export function SiteChrome({
  children,
  initialCart,
}: {
  children: ReactNode;
  initialCart: PublicCart;
}) {
  const { pageLocked, value } = useChromeLocks();

  return (
    <ChromeProvider value={value}>
      <CartProvider initialCart={initialCart}>
        <div className={styles.shell}>
          <div className={styles.lock} inert={pageLocked || undefined}>
            <SiteHeader />
            <div className={styles.page}>{children}</div>
            <SiteFooter />
          </div>
        </div>
        <BagDrawer />
      </CartProvider>
    </ChromeProvider>
  );
}
