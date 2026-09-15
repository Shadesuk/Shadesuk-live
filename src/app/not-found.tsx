import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/navigation";
import {
  PAGE_NOT_FOUND_CTA,
  PAGE_NOT_FOUND_DESCRIPTION,
  PAGE_NOT_FOUND_TITLE,
} from "@/lib/ui-state-copy";

export default function NotFound() {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <EmptyState
            title={PAGE_NOT_FOUND_TITLE}
            description={PAGE_NOT_FOUND_DESCRIPTION}
            titleAs="h1"
            actions={
              <ButtonLink href={routes.shop} variant="secondary">
                {PAGE_NOT_FOUND_CTA}
              </ButtonLink>
            }
          />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
