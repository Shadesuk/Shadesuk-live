"use client";

import { genderLinks, routes, shapeLinks } from "@/lib/navigation";
import { getMenuBrandLinks } from "@/services/catalogue";
import { NavLink } from "./NavLink";
import styles from "./ShopMenu.module.css";

type ShopMenuProps = {
  id: string;
  onNavigate?: () => void;
};

export function ShopMenu({ id, onNavigate }: ShopMenuProps) {
  const brandLinks = getMenuBrandLinks();

  return (
    <div className={styles.menu} id={id}>
      <div className={styles.group}>
        <p className={`text-micro ${styles.heading}`} id={`${id}-gender`}>
          Gender
        </p>
        <div className={styles.row} role="group" aria-labelledby={`${id}-gender`}>
          {genderLinks.map((item) => (
            <NavLink key={item.href} href={item.href} onClick={onNavigate}>
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <p className={`text-micro ${styles.heading}`} id={`${id}-brands`}>
          Brands
        </p>
        {brandLinks.length > 0 ? (
          <div className={styles.row} role="group" aria-labelledby={`${id}-brands`}>
            {brandLinks.map((item) => (
              <NavLink key={item.href} href={item.href} onClick={onNavigate}>
                {item.label}
              </NavLink>
            ))}
          </div>
        ) : null}
        <NavLink href={routes.brands} onClick={onNavigate}>
          View all brands
        </NavLink>
      </div>

      <div className={styles.group}>
        <p className={`text-micro ${styles.heading}`} id={`${id}-shapes`}>
          Shapes
        </p>
        <div className={styles.row} role="group" aria-labelledby={`${id}-shapes`}>
          {shapeLinks.map((item) => (
            <NavLink key={item.href} href={item.href} onClick={onNavigate}>
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <p className={`text-micro ${styles.heading}`} id={`${id}-styles`}>
          Styles
        </p>
        <NavLink href={routes.collections} onClick={onNavigate}>
          View collections
        </NavLink>
      </div>

      <div className={styles.group}>
        <NavLink href={routes.shop} onClick={onNavigate}>
          All shades
        </NavLink>
      </div>
    </div>
  );
}
