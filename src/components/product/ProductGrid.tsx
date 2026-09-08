import type { ReactNode } from "react";
import { Grid, GridItem } from "@/components/layout/Grid";
import type { Product } from "@/types/catalogue";
import { LoadMoreButton } from "./LoadMoreButton";
import { ProductCard } from "./ProductCard";
import styles from "./ProductGrid.module.css";

export type ProductGridInsert = {
  afterIndex: number;
  key: string;
  content: ReactNode;
};

type ProductGridProps = {
  products: Product[];
  loading?: boolean;
  emptyMessage?: string;
  emptyContent?: ReactNode;
  inserts?: ProductGridInsert[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  imagePriorityCount?: number;
};

function SkeletonCard() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skeletonMedia} />
      <div className={styles.skeletonLine} />
      <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
    </div>
  );
}

export function ProductGrid({
  products,
  loading = false,
  emptyMessage = "No shades to show yet.",
  emptyContent,
  inserts = [],
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  imagePriorityCount = 0,
}: ProductGridProps) {
  if (loading && products.length === 0) {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="visually-hidden">Loading products</span>
        <Grid variant="product" className={styles.list}>
          {Array.from({ length: 4 }, (_, index) => (
            <GridItem key={index}>
              <SkeletonCard />
            </GridItem>
          ))}
        </Grid>
      </div>
    );
  }

  if (!loading && products.length === 0) {
    if (emptyContent) {
      return <>{emptyContent}</>;
    }
    return (
      <p className={`text-body ${styles.status}`} role="status">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div data-product-grid>
      <Grid variant="product" className={styles.list} as="ul">
        {products.flatMap((product, index) => {
          const insert = inserts.find((item) => item.afterIndex === index);
          const item = (
            <GridItem key={product.id} as="li">
              <ProductCard
                product={product}
                priority={index < imagePriorityCount}
              />
            </GridItem>
          );

          if (!insert) {
            return [item];
          }

          return [
            item,
            <GridItem key={insert.key} spanAll as="li">
              {insert.content}
            </GridItem>,
          ];
        })}
      </Grid>
      {hasMore && onLoadMore ? (
        <div className={styles.footer}>
          <LoadMoreButton onClick={onLoadMore} loading={loadingMore} />
        </div>
      ) : null}
    </div>
  );
}
