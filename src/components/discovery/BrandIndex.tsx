import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { shadeCountLabel } from "@/components/discovery/ProductCount";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveRecentlyViewed } from "@/components/pdp/LiveRecentlyViewed";
import { brandPath, routes } from "@/lib/navigation";
import type { Brand } from "@/types/catalogue";
import { DiscoveryIndex } from "./DiscoveryIndexShell";
import { DiscoveryList } from "./DiscoveryList";

export function BrandIndex({ brands }: { brands: Brand[] }) {
  const items = brands.map((brand) => ({
    href: brandPath(brand.slug),
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
            <LiveRecentlyViewed />
          </DiscoveryIndex>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
