"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnalyticsPageView } from "@/components/analytics/AnalyticsPageView";
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
  signedIn = false,
}: {
  children: ReactNode;
  initialCart: PublicCart;
  brandLinks?: MenuBrandLink[];
  searchDiscovery?: SearchDiscoveryLink[];
  signedIn?: boolean;
}) {
  const { pageLocked, value } = useChromeLocks();
  const pathname = usePathname();
  const checkout = pathname === routes.checkout || pathname.startsWith(`${routes.checkout}/`);

  return (
    <ChromeProvider value={value}>
      <CartProvider initialCart={initialCart}>
        <div className={styles.shell}>
          <Suspense fallback={null}>
            <AnalyticsPageView />
          </Suspense>
          <div className={styles.lock} inert={pageLocked || undefined}>
            <SiteHeader
              reduced={checkout}
              brandLinks={brandLinks}
              searchDiscovery={searchDiscovery}
              signedIn={signedIn}
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
