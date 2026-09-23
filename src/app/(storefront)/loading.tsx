import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProductGrid } from "@/components/product/ProductGrid";
import { LOADING_PAGE } from "@/lib/ui-state-copy";
import styles from "./loading.module.css";

export default function Loading() {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <div className={styles.intro} aria-busy="true">
            <p className="visually-hidden" role="status">
              {LOADING_PAGE}
            </p>
            <div className={styles.campaign} aria-hidden="true" />
          </div>
        </ContentWidth>
        <ContentWidth>
          <ProductGrid products={[]} loading />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
