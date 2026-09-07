import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { getProducts } from "@/services/catalogue";
import type { CatalogueFilters } from "@/types/catalogue";
import type { CollectionDefinition, CollectionQuery } from "@/types/collection";
import type { Product } from "@/types/catalogue";
import { CollectionHeader } from "./CollectionHeader";
import { CollectionResults } from "./CollectionResults";
import { FilterBar } from "./FilterBar";
import { RecentlyViewed } from "./RecentlyViewed";
import styles from "./CollectionTemplate.module.css";

type CollectionTemplateProps = {
  collection: CollectionDefinition;
  query: CollectionQuery;
  products: Product[];
  total: number;
  hasMore: boolean;
  filterOptions: CatalogueFilters;
};

export function CollectionTemplate({
  collection,
  query,
  products,
  total,
  hasMore,
  filterOptions,
}: CollectionTemplateProps) {
  return (
    <PageContainer>
      <main id="main" className={styles.main} data-collection={collection.slug}>
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
            products={products}
            hasMore={hasMore}
            query={query}
          />
          <RecentlyViewed products={getProducts()} />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
