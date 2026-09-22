import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageContainer } from "@/components/layout/PageContainer";
import { routes } from "@/lib/navigation";
import type { Product, Shape, StorefrontCatalogueSource } from "@/types/catalogue";
import { HomepageCatalogueError } from "./HomepageCatalogueError";
import { EditorialBrandMoment } from "./EditorialBrandMoment";
import { FinalCta } from "./FinalCta";
import { GenderDiscovery } from "./GenderDiscovery";
import { HeroCampaign } from "./HeroCampaign";
import { ProductSection } from "./ProductSection";
import { ProductStory } from "./ProductStory";
import { ShapeDiscovery } from "./ShapeDiscovery";
import { TrustSection } from "./TrustSection";
import styles from "./Homepage.module.css";

type HomepageProps = {
  featured: Product[];
  bestSellers: Product[];
  newArrivals: Product[];
  storyProduct?: Product;
  shapes: Shape[];
  catalogueSource?: StorefrontCatalogueSource;
  catalogueUnavailable?: boolean;
};

export function Homepage({
  featured,
  bestSellers,
  newArrivals,
  storyProduct,
  shapes,
  catalogueSource,
  catalogueUnavailable = false,
}: HomepageProps) {
  return (
    <PageContainer>
      <main
        id="main"
        className={styles.main}
        data-catalogue-source={catalogueSource}
        data-catalogue-unavailable={catalogueUnavailable ? "true" : undefined}
      >
        <HeroCampaign />
        {catalogueUnavailable ? (
          <HomepageCatalogueError />
        ) : (
          <ProductSection
            id="featured-heading"
            title="The shades people are wearing"
            products={featured}
            mobileCount={2}
            imagePriorityCount={2}
            list="homepage_featured"
            action={
              <ButtonLink href={routes.shop} variant="tertiary">
                Shop all shades
              </ButtonLink>
            }
          />
        )}
        <EditorialBrandMoment />
        <GenderDiscovery />
        {catalogueUnavailable ? null : (
          <>
            <ProductSection
              id="best-sellers-heading"
              title="The most wanted"
              products={bestSellers}
              list="homepage_best_sellers"
              action={
                <ButtonLink href={routes.bestSellers} variant="tertiary">
                  View best sellers
                </ButtonLink>
              }
            />
            <ShapeDiscovery shapes={shapes} />
            <ProductSection
              id="new-arrivals-heading"
              title="Just in"
              products={newArrivals}
              mobileCount={2}
              list="homepage_new_arrivals"
              action={
                <ButtonLink href={routes.newArrivals} variant="tertiary">
                  View new arrivals
                </ButtonLink>
              }
            />
          </>
        )}
        <TrustSection />
        {catalogueUnavailable || !storyProduct ? null : <ProductStory product={storyProduct} />}
        <FinalCta />
      </main>
    </PageContainer>
  );
}
