import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/navigation";

export default function BrandNotFound() {
  return (
    <PageContainer>
      <main id="main" data-brand-not-found>
        <ContentWidth>
          <EmptyState
            title="This brand isn’t available."
            description="That brand isn’t part of the current SHADESUK catalogue."
            titleAs="h1"
            actions={
              <ButtonLink href={routes.brands} variant="secondary">
                View all brands
              </ButtonLink>
            }
          />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
