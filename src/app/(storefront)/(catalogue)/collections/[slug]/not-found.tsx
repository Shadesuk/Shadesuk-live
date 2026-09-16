import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/navigation";

export default function CollectionNotFound() {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <EmptyState
            title="This collection isn’t available."
            description="That collection isn’t part of the current SHADESUK catalogue."
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
