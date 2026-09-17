"use client";

import { useRef } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/Button";
import type { Product } from "@/types/catalogue";
import styles from "./ProductRail.module.css";

type ProductRailProps = {
  products: Product[];
  imagePriorityCount?: number;
  list?: string;
};

export function ProductRail({
  products,
  imagePriorityCount = 0,
  list,
}: ProductRailProps) {
  const trackRef = useRef<HTMLUListElement>(null);

  function scroll(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const amount = Math.max(track.clientWidth * 0.8, 240);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: amount * direction, behavior: reduce ? "auto" : "smooth" });
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div className={styles.rail} data-product-rail>
      <div className={styles.controls}>
        <Button type="button" variant="secondary" onClick={() => scroll(-1)} aria-label="Previous products">
          Previous
        </Button>
        <Button type="button" variant="secondary" onClick={() => scroll(1)} aria-label="Next products">
          Next
        </Button>
      </div>
      <ul ref={trackRef} className={styles.track}>
        {products.map((product, index) => (
          <li key={product.id} className={styles.item}>
            <ProductCard product={product} priority={index < imagePriorityCount} list={list} />
          </li>
        ))}
      </ul>
    </div>
  );
}
