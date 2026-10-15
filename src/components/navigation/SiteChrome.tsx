"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnalyticsPageView } from "@/components/analytics/AnalyticsPageView";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { BagDrawer } from "@/components/cart/BagDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { routes } from "@/lib/navigation";
import type { MenuBrandLink } from "@/lib/menu-brands";
import type { SearchDiscoveryLink } from "@/lib/search-query";
import type { PublicCart } from "@/types/cart";
import { CookieConsent } from "@/components/consent/CookieConsent";
import { MarketProvider } from "@/components/market/MarketProvider";
import type { PublicFxRate } from "@/lib/market/prices";
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
  initialCountry,
  countryChosen = false,
  fxRates = [],
}: {
  children: ReactNode;
  initialCart: PublicCart;
  brandLinks?: MenuBrandLink[];
  searchDiscovery?: SearchDiscoveryLink[];
  signedIn?: boolean;
  initialCountry: string;
  countryChosen?: boolean;
  fxRates?: readonly PublicFxRate[];
}) {
  const { pageLocked, value } = useChromeLocks();
  const checkout = useCheckoutRoute();

  return (
    <ChromeProvider value={value}>
      <CartProvider initialCart={initialCart}>
        <MarketProvider initialCountry={initialCountry} hasChoice={countryChosen} rates={fxRates}>
        <div className={styles.shell} data-checkout={checkout ? "" : undefined}>
          <Suspense fallback={null}>
            <AnalyticsPageView />
            <MetaPixel />
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
        <CookieConsent />
        <BagDrawer />
        </MarketProvider>
      </CartProvider>
    </ChromeProvider>
  );
}

function isCheckoutPath(pathname: string | null | undefined): boolean {
  return (
    pathname === routes.checkout ||
    (typeof pathname === "string" && pathname.startsWith(`${routes.checkout}/`))
  );
}

function useCheckoutRoute(): boolean {
  // usePathname() is the rendered App Router URL. It updates when Next commits
  // a route, including a logo click to home, before the address bar catches up.
  return isCheckoutPath(usePathname());
}
