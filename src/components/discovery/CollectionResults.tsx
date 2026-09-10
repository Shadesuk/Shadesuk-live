"use client";

import { useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ProductGrid } from "@/components/product/ProductGrid";
import { COLLECTION_PAGE_SIZE, type CollectionDefinition, type CollectionQuery } from "@/types/collection";
import type { Product } from "@/types/catalogue";
import { collectionQueryPath } from "@/services/collections";
import { CollectionEmptyState } from "./CollectionEmptyState";
import styles from "./CollectionResults.module.css";

type CollectionResultsProps = {
  collection: CollectionDefinition;
  products: Product[];
  hasMore: boolean;
  query: CollectionQuery;
  emptyContent?: ReactNode;
};

export function CollectionResults({
  collection,
  products,
  hasMore,
  query,
  emptyContent,
}: CollectionResultsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div className={styles.results}>
      <h2 className="visually-hidden">Products</h2>
      <ProductGrid
        products={products}
        hasMore={hasMore}
        loadingMore={pending}
        imagePriorityCount={4}
        emptyContent={
          emptyContent ?? (
            <CollectionEmptyState collection={collection} query={query} />
          )
        }
        onLoadMore={() => {
          startTransition(() => {
            router.push(
              collectionQueryPath(pathname, {
                ...query,
                limit: query.limit + COLLECTION_PAGE_SIZE,
              }),
              { scroll: false },
            );
          });
        }}
      />
      {!hasMore && products.length > 0 ? (
        <p className={`text-micro ${styles.end}`} role="status">
          End of collection
        </p>
      ) : null}
    </div>
  );
}
