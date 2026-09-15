import type { ReactNode } from "react";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { LiveRecentlyViewed } from "@/components/pdp/LiveRecentlyViewed";
import { hasUserFilters } from "@/lib/collection-query";
import type { CatalogueFilters, Product, StorefrontCatalogueSource } from "@/types/catalogue";
import { COLLECTION_PAGE_SIZE, type CollectionDefinition, type CollectionQuery } from "@/types/collection";
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
  const initialSearch =
    Boolean(query.q) &&
    !hasUserFilters(query, collection) &&
    query.sort === "featured" &&
    query.limit === COLLECTION_PAGE_SIZE;

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
          {initialSearch ? (
            <>
              <AnalyticsBeacon
                event="search"
                payload={{ query: query.q, result_count: total, collection: collection.id }}
              />
              {total > 0 ? (
                <AnalyticsBeacon
                  event="search_result_view"
                  payload={{ query: query.q, result_count: total }}
                />
              ) : null}
            </>
          ) : null}
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
            list={query.q ? "search" : collection.id}
            emptyContent={emptyContent}
          />
          <LiveRecentlyViewed />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
