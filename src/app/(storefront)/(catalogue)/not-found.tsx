import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/navigation";
import { UNAVAILABLE_DESCRIPTION, UNAVAILABLE_TITLE } from "@/lib/ui-state-copy";

export default function CatalogueNotFound() {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <EmptyState
            title={UNAVAILABLE_TITLE}
            description={UNAVAILABLE_DESCRIPTION}
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
