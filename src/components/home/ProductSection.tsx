import type { ReactNode } from "react";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { Section } from "@/components/layout/Section";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductRail } from "./ProductRail";
import type { Product } from "@/types/catalogue";
import { cx } from "@/lib/cx";
import styles from "./ProductSection.module.css";

type ProductSectionProps = {
  id: string;
  title: string;
  products: Product[];
  action?: ReactNode;
  mobileCount?: number;
  imagePriorityCount?: number;
  layout?: "grid" | "rail";
  list?: string;
};

export function ProductSection({
  id,
  title,
  products,
  action,
  mobileCount,
  imagePriorityCount = 0,
  layout = "grid",
  list,
}: ProductSectionProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <Section labelledBy={id}>
      <ContentWidth className={styles.section}>
        <div className={styles.header}>
          <h2 id={id} className="text-h2">
            {title}
          </h2>
          {action}
        </div>
        {layout === "rail" ? (
          <ProductRail products={products} imagePriorityCount={imagePriorityCount} list={list} />
        ) : (
          <div className={cx(mobileCount === 2 && styles.mobileTwo)}>
            <ProductGrid
              products={products}
              imagePriorityCount={imagePriorityCount}
              list={list}
            />
          </div>
        )}
      </ContentWidth>
    </Section>
  );
}
