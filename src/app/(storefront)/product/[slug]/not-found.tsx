import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/navigation";

export default function ProductNotFound() {
  return (
    <PageContainer>
      <main id="main" data-product-not-found>
        <ContentWidth>
          <EmptyState
            title="This product isn’t available."
            description="That product isn’t part of the current SHADESUK catalogue."
            titleAs="h1"
            actions={
              <ButtonLink href={routes.shop} variant="secondary">
                View all shades
              </ButtonLink>
            }
          />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
