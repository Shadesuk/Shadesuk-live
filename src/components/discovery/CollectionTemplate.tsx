import type { ReactNode } from "react";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { LiveRecentlyViewed } from "@/components/pdp/LiveRecentlyViewed";
import type { CatalogueFilters, Product, StorefrontCatalogueSource } from "@/types/catalogue";
import type { CollectionDefinition, CollectionQuery } from "@/types/collection";
import { CollectionHeader } from "./CollectionHeader";
import { CollectionResults } from "./CollectionResults";
import { FilterBar } from "./FilterBar";
import styles from "./CollectionTemplate.module.css";

type CollectionTemplateProps = {
  collection: CollectionDefinition;
  query: CollectionQuery;
  products: Product[];
  total: number;
  hasMore: boolean;
  filterOptions: CatalogueFilters;
  emptyContent?: ReactNode;
  catalogueSource?: StorefrontCatalogueSource;
};

export function CollectionTemplate({
  collection,
  query,
  products,
  total,
  hasMore,
  filterOptions,
  emptyContent,
  catalogueSource,
}: CollectionTemplateProps) {
  return (
    <PageContainer>
      <main
        id="main"
        className={styles.main}
        data-collection={collection.slug}
        data-collection-kind={collection.kind}
        data-catalogue-source={catalogueSource}
      >
        <ContentWidth>
          <CollectionHeader
            title={collection.title}
            description={collection.description}
            count={total}
            controls={
              <FilterBar
                collection={collection}
                query={query}
                options={filterOptions}
              />
            }
          />
          <CollectionResults
            collection={collection}
            products={products}
            hasMore={hasMore}
            query={query}
            emptyContent={emptyContent}
          />
          <LiveRecentlyViewed />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
