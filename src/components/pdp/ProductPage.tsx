import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { StorefrontProductPage } from "@/services/product";
import { LiveRecentlyViewed } from "./LiveRecentlyViewed";
import { ProductDisclosure } from "./ProductDisclosure";
import { ProductHero } from "./ProductHero";
import { ProductViewRecorder } from "./ProductViewRecorder";
import styles from "./ProductPage.module.css";

type ProductPageProps = {
  record: StorefrontProductPage;
};

export function ProductPage({ record }: ProductPageProps) {
  const { product, brandName, source, related } = record;

  return (
    <PageContainer>
      <main
        id="main"
        className={styles.page}
        data-pdp
        data-product-slug={product.slug}
        data-product-source={source}
      >
        <ContentWidth>
          <ProductViewRecorder
            productId={product.id}
            productName={product.name}
            price={product.price}
            currency={product.currency}
          />
          <ProductHero product={product} brandName={brandName} />
          <ProductDisclosure disclosure={product.pdp?.disclosure} />
          {related.length > 0 ? (
            <section className={styles.related} aria-labelledby="you-may-also-like">
              <h2 id="you-may-also-like" className="text-micro">
                You may also like
              </h2>
              <ProductGrid products={related} imagePriorityCount={0} list="you_may_also_like" />
            </section>
          ) : null}
          <LiveRecentlyViewed currentId={product.id} />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
