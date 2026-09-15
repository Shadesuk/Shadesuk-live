"use client";

import Image from "next/image";
import Link from "next/link";
import { cx } from "@/lib/cx";
import { formatGbp } from "@/lib/money";
import {
  getAvailabilityLabel,
  getColourCount,
  getImageFallbackLabel,
  getPrimaryImage,
  getProductBrandName,
  getProductHref,
  getSecondaryImage,
  isProductAvailable,
} from "@/lib/product-display";
import { recordProductView } from "@/lib/recently-viewed";
import type { Product } from "@/types/catalogue";
import styles from "./ProductCard.module.css";

type ProductCardProps = {
  product: Product;
  priority?: boolean;
};

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const href = getProductHref(product);
  const brand = getProductBrandName(product);
  const colourCount = getColourCount(product);
  const primary = getPrimaryImage(product);
  const secondary = getSecondaryImage(product);
  const available = isProductAvailable(product);
  const fallback = getImageFallbackLabel(primary?.role ?? "front");
  const colourLabel = `${colourCount} ${colourCount === 1 ? "colour" : "colours"}`;

  return (
    <article className={cx(styles.card, !available && styles.unavailable)}>
      <Link
        className={styles.link}
        href={href}
        onClick={() => recordProductView(product.id)}
      >
        <div className={styles.media}>
          {primary?.src ? (
            <Image
              src={primary.src}
              alt={primary.alt}
              width={primary.width}
              height={primary.height}
              className={styles.image}
              sizes="(min-width: 1200px) 25vw, (min-width: 768px) 33vw, 50vw"
              priority={priority}
            />
          ) : (
            <span className={`${styles.fallback} text-micro`}>{fallback}</span>
          )}
          {secondary?.src ? (
            <Image
              src={secondary.src}
              alt=""
              width={secondary.width}
              height={secondary.height}
              className={`${styles.image} ${styles.secondary}`}
              sizes="(min-width: 1200px) 25vw, (min-width: 768px) 33vw, 50vw"
            />
          ) : null}
        </div>
        <div className={styles.meta}>
          {product.isNewArrival ? (
            <p className={`text-micro ${styles.badge}`}>New arrival</p>
          ) : null}
          {product.isBestSeller ? (
            <p className={`text-micro ${styles.badge}`}>Best seller</p>
          ) : null}
          <p className={`text-micro ${styles.brand}`}>{brand}</p>
          <h3 className={`text-small ${styles.name}`}>{product.name}</h3>
          <p className={`text-small ${styles.price}`}>{formatGbp(product.price)}</p>
          <p className={`text-micro ${styles.count}`} data-colour-count={colourCount}>{colourLabel}</p>
          {!available ? (
            <p className={`text-micro ${styles.status}`}>
              {getAvailabilityLabel(product.availability)}
            </p>
          ) : null}
        </div>
      </Link>
      {product.colours.length > 0 ? (
        <ul className={styles.swatches} aria-label="Available colours">
          {product.colours.map((colour) => (
            <li key={colour.id}>
              <span
                className={styles.swatch}
                style={colour.hex ? { background: colour.hex } : undefined}
              >
                <span className="visually-hidden">{colour.name}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
