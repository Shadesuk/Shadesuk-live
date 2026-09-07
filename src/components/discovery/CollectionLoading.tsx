import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProductGrid } from "@/components/product/ProductGrid";

export function CollectionLoading() {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <ProductGrid products={[]} loading />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
