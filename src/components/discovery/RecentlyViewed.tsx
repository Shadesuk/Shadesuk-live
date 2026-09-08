"use client";

import { useMemo, useSyncExternalStore } from "react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getRecentlyViewedIds } from "@/lib/recently-viewed";
import type { Product } from "@/types/catalogue";
import styles from "./RecentlyViewed.module.css";

type RecentlyViewedProps = {
  products: Product[];
};

function subscribe() {
  return () => undefined;
}

export function RecentlyViewed({ products }: RecentlyViewedProps) {
  const ids = useSyncExternalStore(subscribe, getRecentlyViewedIds, () => []);

  const viewed = useMemo(
    () =>
      ids
        .map((id) => products.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product)),
    [ids, products],
  );

  if (viewed.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="recently-viewed-heading">
      <h2 id="recently-viewed-heading" className="text-micro">
        Recently viewed
      </h2>
      <ProductGrid products={viewed} imagePriorityCount={0} />
    </section>
  );
}
