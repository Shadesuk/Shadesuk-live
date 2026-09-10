import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { shadeCountLabel } from "@/components/discovery/ProductCount";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/navigation";
import {
  getCollectionProducts,
  getPopulatedCollections,
} from "@/services/collections";
import { DiscoveryIndex, DiscoveryIndexSection } from "./DiscoveryIndexShell";
import { DiscoveryList } from "./DiscoveryList";

export function CollectionsHub() {
  const collections = getPopulatedCollections();
  const items = collections.map((collection) => ({
    href: collection.href,
    title: collection.title,
    meta: shadeCountLabel(getCollectionProducts(collection).length),
  }));

  return (
    <PageContainer>
      <main id="main" data-collections-hub>
        <ContentWidth>
          <DiscoveryIndex
            title="Collections"
            description="Explore our collections."
          >
            {items.length > 0 ? (
              <DiscoveryIndexSection headingId="shapes-heading" title="Shapes">
                <DiscoveryList items={items} labelledBy="shapes-heading" />
              </DiscoveryIndexSection>
            ) : (
              <EmptyState
                title="No collections available."
                description="Explore all shades."
                actions={
                  <ButtonLink href={routes.shop} variant="secondary">
                    View all shades
                  </ButtonLink>
                }
              />
            )}
          </DiscoveryIndex>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
