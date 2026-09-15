"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ProductGrid } from "@/components/product/ProductGrid";
import {
  getRecentlyViewedIds,
  getRecentlyViewedServerSnapshot,
  subscribeRecentlyViewed,
} from "@/lib/recently-viewed";
import { loadProductsByIdsAction } from "@/app/product/actions";
import type { Product } from "@/types/catalogue";
import styles from "@/components/discovery/RecentlyViewed.module.css";

type LiveRecentlyViewedProps = {
  currentId?: string;
};

export function LiveRecentlyViewed({ currentId }: LiveRecentlyViewedProps) {
  const ids = useSyncExternalStore(
    subscribeRecentlyViewed,
    getRecentlyViewedIds,
    getRecentlyViewedServerSnapshot,
  );
  const wantedKey = ids
    .filter((id) => (currentId ? id !== currentId : true))
    .slice(0, 4)
    .join("|");
  const wanted = useMemo(
    () => (wantedKey ? wantedKey.split("|") : []),
    [wantedKey],
  );
  const [fetched, setFetched] = useState<Product[]>([]);

  useEffect(() => {
    if (wanted.length === 0) {
      return;
    }
    let cancelled = false;
    loadProductsByIdsAction(wanted).then((next) => {
      if (!cancelled) {
        setFetched(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  const products =
    wanted.length === 0
      ? []
      : fetched.filter((product) => wanted.includes(product.id));

  if (products.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="recently-viewed-heading">
      <h2 id="recently-viewed-heading" className="text-micro">
        Recently viewed
      </h2>
      <ProductGrid products={products} imagePriorityCount={0} />
    </section>
  );
}
