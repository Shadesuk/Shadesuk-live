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
import { listPublishedAssignedCollections } from "@/services/storefront-collections";
import type { Brand, Product } from "@/types/catalogue";
import { DiscoveryIndex, DiscoveryIndexSection } from "./DiscoveryIndexShell";
import { DiscoveryList } from "./DiscoveryList";

export async function CollectionsHub({
  products,
  brands,
}: {
  products: Product[];
  brands: Brand[];
}) {
  const shapeCollections = getPopulatedCollections(products);
  const shapeItems = shapeCollections.map((collection) => ({
    href: collection.href,
    title: collection.title,
    meta: shadeCountLabel(getCollectionProducts(collection, products, brands).length),
  }));
  const assigned = await listPublishedAssignedCollections(products);
  const assignedItems = assigned.map((collection) => ({
    href: collection.href,
    title: collection.title,
    meta: shadeCountLabel(getCollectionProducts(collection, products, brands).length),
  }));

  return (
    <PageContainer>
      <main id="main" data-collections-hub>
        <ContentWidth>
          <DiscoveryIndex
            title="Collections"
            description="Explore our collections."
          >
            {shapeItems.length > 0 ? (
              <DiscoveryIndexSection headingId="shapes-heading" title="Shapes">
                <DiscoveryList items={shapeItems} labelledBy="shapes-heading" />
              </DiscoveryIndexSection>
            ) : null}
            {assignedItems.length > 0 ? (
              <DiscoveryIndexSection headingId="assigned-heading" title="Collections">
                <DiscoveryList items={assignedItems} labelledBy="assigned-heading" />
              </DiscoveryIndexSection>
            ) : null}
            {shapeItems.length === 0 && assignedItems.length === 0 ? (
              <EmptyState
                title="No collections available."
                description="Explore all shades."
                actions={
                  <ButtonLink href={routes.shop} variant="secondary">
                    View all shades
                  </ButtonLink>
                }
              />
            ) : null}
          </DiscoveryIndex>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
