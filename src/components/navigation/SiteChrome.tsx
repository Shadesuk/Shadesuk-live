"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BagDrawer } from "@/components/cart/BagDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { routes } from "@/lib/navigation";
import type { MenuBrandLink } from "@/lib/menu-brands";
import type { SearchDiscoveryLink } from "@/lib/search-query";
import type { PublicCart } from "@/types/cart";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { ChromeProvider, useChromeLocks } from "./ChromeContext";
import styles from "./SiteChrome.module.css";

export function SiteChrome({
  children,
  initialCart,
  brandLinks = [],
  searchDiscovery = [],
}: {
  children: ReactNode;
  initialCart: PublicCart;
  brandLinks?: MenuBrandLink[];
  searchDiscovery?: SearchDiscoveryLink[];
}) {
  const { pageLocked, value } = useChromeLocks();
  const pathname = usePathname();
  const checkout = pathname === routes.checkout || pathname.startsWith(`${routes.checkout}/`);

  return (
    <ChromeProvider value={value}>
      <CartProvider initialCart={initialCart}>
        <div className={styles.shell}>
          <div className={styles.lock} inert={pageLocked || undefined}>
            <SiteHeader
              reduced={checkout}
              brandLinks={brandLinks}
              searchDiscovery={searchDiscovery}
            />
            <div className={styles.page}>{children}</div>
            <SiteFooter reduced={checkout} />
          </div>
        </div>
        <BagDrawer />
      </CartProvider>
    </ChromeProvider>
  );
}
