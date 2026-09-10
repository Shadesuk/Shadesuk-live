import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { shadeCountLabel } from "@/components/discovery/ProductCount";
import { RecentlyViewed } from "@/components/discovery/RecentlyViewed";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/navigation";
import { getBrandHref, getBrandIndex, getProducts } from "@/services/catalogue";
import { DiscoveryIndex } from "./DiscoveryIndexShell";
import { DiscoveryList } from "./DiscoveryList";

export function BrandIndex() {
  const brands = getBrandIndex();
  const items = brands.map((brand) => ({
    href: getBrandHref(brand),
    title: brand.name,
    meta: shadeCountLabel(brand.productCount),
  }));

  return (
    <PageContainer>
      <main id="main" data-brand-index>
        <ContentWidth>
          <DiscoveryIndex
            title="Brands"
            description="Browse catalogue brands."
          >
            {items.length > 0 ? (
              <DiscoveryList items={items} labelledBy="discovery-index-heading" />
            ) : (
              <EmptyState
                title="No brands available."
                description="Explore all shades."
                actions={
                  <ButtonLink href={routes.shop} variant="secondary">
                    View all shades
                  </ButtonLink>
                }
              />
            )}
            <RecentlyViewed products={getProducts()} />
          </DiscoveryIndex>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
