"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import type { MenuBrandLink } from "@/lib/menu-brands";
import { primaryNav } from "@/lib/navigation";
import type { SearchDiscoveryLink } from "@/lib/search-query";
import { useChrome } from "./ChromeContext";
import { BrandMark } from "./BrandMark";
import { AccountMenu } from "./AccountMenu";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { NavLink } from "./NavLink";
import { ShopMenu } from "./ShopMenu";
import { UtilityButton } from "./UtilityButton";
import styles from "./SiteHeader.module.css";

export function SiteHeader({
  reduced = false,
  brandLinks = [],
  searchDiscovery = [],
  signedIn = false,
}: {
  reduced?: boolean;
  brandLinks?: MenuBrandLink[];
  searchDiscovery?: SearchDiscoveryLink[];
  signedIn?: boolean;
}) {
  const { acquirePageLock, releasePageLock } = useChrome();
  const { cart, open: bagOpen, openBag, closeBag } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const shopRef = useRef<HTMLDivElement>(null);
  const shopMenuId = useId();

  const closeShop = useCallback(() => {
    setShopOpen(false);
  }, []);

  useEffect(() => {
    if (!(menuOpen || searchOpen)) {
      return;
    }
    acquirePageLock();
    return () => releasePageLock();
  }, [menuOpen, searchOpen, acquirePageLock, releasePageLock]);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!shopRef.current?.contains(event.target as Node)) {
        setShopOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  useEffect(() => {
    if (!shopOpen) {
      return;
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShopOpen(false);
        shopRef.current?.querySelector("button")?.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [shopOpen]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1200) {
        setMenuOpen(false);
      } else {
        setShopOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <header className={styles.header} data-reduced={reduced || undefined}>
      <ContentWidth className={styles.bar}>
        {reduced ? null : (
          <div className={styles.menu}>
            <UtilityButton
              onClick={() => setMenuOpen(true)}
              expanded={menuOpen}
              controls="site-mobile-nav"
              hasPopup="dialog"
            >
              Menu
            </UtilityButton>
          </div>
        )}

        <div className={styles.brand}>
          <BrandMark priority />
        </div>

        {reduced ? null : (
          <nav className={styles.primary} aria-label="Primary">
            {primaryNav.map((item) =>
              "menu" in item && item.menu === "shop" ? (
                <div key={item.label} className={styles.shop} ref={shopRef}>
                  <UtilityButton
                    onClick={() => setShopOpen((open) => !open)}
                    expanded={shopOpen}
                    controls={shopMenuId}
                    hasPopup="true"
                  >
                    {item.label}
                  </UtilityButton>
                  {shopOpen ? (
                    <ShopMenu
                      id={shopMenuId}
                      onNavigate={closeShop}
                      brandLinks={brandLinks}
                    />
                  ) : null}
                </div>
              ) : (
                <NavLink key={item.href} href={item.href}>
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>
        )}

        <div className={styles.utils}>
          {reduced ? null : (
            <UtilityButton
              onClick={() => setSearchOpen(true)}
              expanded={searchOpen}
              controls="site-search-dialog"
              hasPopup="dialog"
            >
              Search
            </UtilityButton>
          )}
          {reduced ? null : <AccountMenu signedIn={signedIn} />}
          <UtilityButton
            hasPopup="dialog"
            expanded={bagOpen}
            controls="site-bag-drawer"
            count={cart.itemCount}
            onClick={() => {
              if (bagOpen) {
                closeBag();
              } else {
                openBag();
              }
            }}
          >
            Bag
          </UtilityButton>
          <span className="visually-hidden" aria-live="polite">
            {cart.itemCount === 0 ? "Bag is empty" : `${cart.itemCount} items in bag`}
          </span>
        </div>
      </ContentWidth>

      {reduced ? null : (
        <MobileNavDrawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          brandLinks={brandLinks}
          signedIn={signedIn}
        />
      )}

      {reduced ? null : (
        <SearchOverlay
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          discovery={searchDiscovery}
        />
      )}
    </header>
  );
}
