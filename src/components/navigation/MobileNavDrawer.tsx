"use client";

import { useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import {
  genderLinks,
  routes,
  shapeLinks,
} from "@/lib/navigation";
import { NavLink } from "./NavLink";
import styles from "./MobileNavDrawer.module.css";

type Panel = "root" | "shop" | "brands" | "shapes" | "styles" | "collections";

type MobileNavDrawerProps = {
  open: boolean;
  onClose: () => void;
};

const titles: Record<Panel, string> = {
  root: "Menu",
  shop: "Shop",
  brands: "Brands",
  shapes: "Shapes",
  styles: "Styles",
  collections: "Collections",
};

export function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
  const [panel, setPanel] = useState<Panel>("root");
  const titleId = "mobile-nav-title";

  const parent = useMemo<Panel | null>(() => {
    if (panel === "shop" || panel === "collections") {
      return "root";
    }
    if (panel === "brands" || panel === "shapes" || panel === "styles") {
      return "shop";
    }
    return null;
  }, [panel]);

  function handleClose() {
    setPanel("root");
    onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      titleId={titleId}
      side="left"
      id="site-mobile-nav"
    >
      <div className={styles.toolbar}>
        {parent ? (
          <button
            type="button"
            className={styles.back}
            onClick={() => setPanel(parent)}
          >
            ← {titles[parent]}
          </button>
        ) : (
          <span />
        )}
        <h2 id={titleId} className={`text-micro ${styles.title}`}>
          {titles[panel]}
        </h2>
        <button type="button" className={styles.close} onClick={handleClose}>
          Close
        </button>
      </div>

      {panel === "root" ? (
        <ul className={styles.list}>
          <li>
            <button
              type="button"
              className={styles.advance}
              onClick={() => setPanel("shop")}
            >
              Shop
            </button>
          </li>
          <li>
            <NavLink href={routes.newArrivals} className={styles.item} onClick={handleClose}>
              New Arrivals
            </NavLink>
          </li>
          <li>
            <NavLink href={routes.bestSellers} className={styles.item} onClick={handleClose}>
              Best Sellers
            </NavLink>
          </li>
          <li>
            <button
              type="button"
              className={styles.advance}
              onClick={() => setPanel("collections")}
            >
              Collections
            </button>
          </li>
          <li>
            <NavLink href={routes.about} className={styles.item} onClick={handleClose}>
              About
            </NavLink>
          </li>
          <li>
            <NavLink href={routes.account} className={styles.item} onClick={handleClose}>
              Account
            </NavLink>
          </li>
        </ul>
      ) : null}

      {panel === "shop" ? (
        <ul className={styles.list}>
          {genderLinks.map((item) => (
            <li key={item.href}>
              <NavLink href={item.href} className={styles.item} onClick={handleClose}>
                {item.label}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={styles.advance}
              onClick={() => setPanel("brands")}
            >
              Brands
            </button>
          </li>
          <li>
            <button
              type="button"
              className={styles.advance}
              onClick={() => setPanel("shapes")}
            >
              Shapes
            </button>
          </li>
          <li>
            <button
              type="button"
              className={styles.advance}
              onClick={() => setPanel("styles")}
            >
              Styles
            </button>
          </li>
        </ul>
      ) : null}

      {panel === "brands" ? (
        <ul className={styles.list}>
          <li>
            <NavLink href={routes.brands} className={styles.item} onClick={handleClose}>
              View all brands
            </NavLink>
          </li>
        </ul>
      ) : null}

      {panel === "shapes" ? (
        <ul className={styles.list}>
          {shapeLinks.map((item) => (
            <li key={item.href}>
              <NavLink href={item.href} className={styles.item} onClick={handleClose}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}

      {panel === "styles" ? (
        <ul className={styles.list}>
          <li>
            <NavLink
              href={routes.collections}
              className={styles.item}
              onClick={handleClose}
            >
              View collections
            </NavLink>
          </li>
        </ul>
      ) : null}

      {panel === "collections" ? (
        <ul className={styles.list}>
          <li>
            <NavLink
              href={routes.collections}
              className={styles.item}
              onClick={handleClose}
            >
              All collections
            </NavLink>
          </li>
          {genderLinks.map((item) => (
            <li key={item.href}>
              <NavLink href={item.href} className={styles.item} onClick={handleClose}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </Drawer>
  );
}
